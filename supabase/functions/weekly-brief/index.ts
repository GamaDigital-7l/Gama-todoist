import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { format, subWeeks, isToday, isThisWeek, isThisMonth, parseISO, getDay } from "https://esm.sh/date-fns@2.30.0";
import { utcToZonedTime } from "https://esm.sh/date-fns-tz@2.0.1";
import OpenAI from "https://esm.sh/openai@4.52.2";
import Groq from "https://esm.sh/groq-sdk@0.10.0";
import webpush from "https://esm.sh/web-push@3.6.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SAO_PAULO_TIMEZONE = "America/Sao_Paulo";

// Helper function to get adjusted completion status for recurring tasks
const getAdjustedTaskCompletionStatus = (task: any): boolean => {
  if (task.recurrence_type === "none") {
    return task.is_completed;
  }

  if (!task.last_successful_completion_date) {
    return false; // Never completed in this cycle
  }

  const lastCompletionDate = parseISO(task.last_successful_completion_date);
  const today = new Date();

  switch (task.recurrence_type) {
    case "daily":
      return isToday(lastCompletionDate);
    case "weekly":
      return isThisWeek(lastCompletionDate, { weekStartsOn: 0 });
    case "monthly":
      return isThisMonth(lastCompletionDate);
    default:
      return task.is_completed;
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: userAuth, error: authError } = await supabase.auth.getUser(token);

    if (authError || !userAuth.user) {
      console.error("Erro de autenticação:", authError);
      return new Response(
        JSON.stringify({ error: "Unauthorized: Invalid or missing token." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const userId = userAuth.user.id;

    const { data: settings, error: settingsError } = await supabase
      .from("settings")
      .select("groq_api_key, openai_api_key, ai_provider_preference, notification_channel")
      .eq("user_id", userId)
      .limit(1)
      .single();

    if (settingsError && settingsError.code !== 'PGRST116') {
      console.error("Erro ao buscar configurações:", settingsError);
      return new Response(
        JSON.stringify({ error: "Erro ao buscar configurações." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const NOTIFICATION_CHANNEL = settings?.notification_channel || "web_push";
    const AI_PROVIDER = settings?.ai_provider_preference || 'groq';

    if (NOTIFICATION_CHANNEL === "none") {
      return new Response(
        JSON.stringify({ message: "Nenhum canal de notificação selecionado. Nenhuma notificação enviada." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Configuração do web-push
    const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY");
    const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY");

    if (!VAPID_PRIVATE_KEY || !VAPID_PUBLIC_KEY) {
      return new Response(
        JSON.stringify({ error: "VAPID keys not configured in Supabase secrets for Web Push notifications." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    webpush.setVapidDetails(
      'mailto: <gustavogama099@gmail.com>',
      VAPID_PUBLIC_KEY!,
      VAPID_PRIVATE_KEY!
    );

    const { type } = await req.json(); // 'test_notification' ou 'weekly_brief'

    const nowUtc = new Date();
    const nowSaoPaulo = utcToZonedTime(nowUtc, SAO_PAULO_TIMEZONE);
    const oneWeekAgoSaoPaulo = format(subWeeks(nowSaoPaulo, 1), "yyyy-MM-dd", { timeZone: SAO_PAULO_TIMEZONE });
    const todaySaoPaulo = format(nowSaoPaulo, "yyyy-MM-dd", { timeZone: SAO_PAULO_TIMEZONE });

    let briefMessage = "";
    let notificationTitle = "";
    let notificationUrl = "/dashboard";

    if (type === 'test_notification') {
      notificationTitle = "Notificação de Teste Semanal";
      briefMessage = "Esta é uma notificação de teste semanal enviada com sucesso!";
    } else if (type === 'weekly_brief') {
      // Fetch tasks for the last week
      const { data: tasks, error: tasksError } = await supabase
        .from("tasks")
        .select("title, is_completed, created_at, completed_at, due_date, recurrence_type, last_successful_completion_date, origin_board")
        .eq("user_id", userId)
        .gte("created_at", oneWeekAgoSaoPaulo); // Tasks created in the last week

      if (tasksError) {
        console.error("Erro ao buscar tarefas para o brief semanal:", tasksError);
        throw tasksError;
      }

      const completedTasks = tasks?.filter(task => task.is_completed && task.completed_at && parseISO(task.completed_at) >= parseISO(oneWeekAgoSaoPaulo)) || [];
      const overdueTasks = tasks?.filter(task => task.origin_board === 'atrasadas' && task.due_date && parseISO(task.due_date) < nowSaoPaulo && !task.is_completed) || [];
      const totalTasksCreated = tasks?.length || 0;

      let aiClient;
      let modelName;

      if (AI_PROVIDER === 'groq') {
        const groqApiKey = settings?.groq_api_key || Deno.env.get("GROQ_API_KEY");
        if (!groqApiKey) {
          return new Response(
            JSON.stringify({ error: "Groq API Key not configured for weekly brief." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        aiClient = new Groq({ apiKey: groqApiKey });
        modelName = "llama3-8b-8192";
      } else if (AI_PROVIDER === 'openai') {
        const openaiApiKey = settings?.openai_api_key || Deno.env.get("OPENAI_API_KEY");
        if (!openaiApiKey) {
          return new Response(
            JSON.stringify({ error: "OpenAI API Key not configured for weekly brief." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        aiClient = new OpenAI({ apiKey: openaiApiKey });
        modelName = "gpt-3.5-turbo";
      } else {
        return new Response(
          JSON.stringify({ error: "Provedor de IA não suportado para brief semanal." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const prompt = `
        Generate a weekly summary for the user based on their task performance.
        Here's the data for the last week (from ${oneWeekAgoSaoPaulo} to ${todaySaoPaulo}):
        - Total tasks created: ${totalTasksCreated}
        - Tasks completed: ${completedTasks.length}
        - Tasks overdue: ${overdueTasks.length}
        
        Completed tasks: ${completedTasks.map(t => t.title).join(', ') || 'None'}
        Overdue tasks: ${overdueTasks.map(t => t.title).join(', ') || 'None'}

        Please provide:
        1. A friendly greeting.
        2. A summary of tasks completed and overdue.
        3. The total number of tasks created this week.
        4. A tip for improvement or a suggestion for a new recurring task based on overdue tasks or general productivity.
        5. Keep it concise and encouraging.
      `;

      const chatCompletion = await aiClient.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: modelName,
        temperature: 0.7,
        max_tokens: 500,
      });

      briefMessage = chatCompletion.choices[0].message.content || "Não foi possível gerar o resumo semanal.";
      notificationTitle = "Seu Resumo Semanal com IA";
    } else {
      return new Response(
        JSON.stringify({ error: "Tipo de notificação semanal inválido." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Enviar notificação Web Push
    const { data: subscriptions, error: fetchError } = await supabase
      .from('user_subscriptions')
      .select('subscription')
      .eq('user_id', userId);

    if (fetchError) {
      console.error("Erro ao buscar inscrições de usuário para web push:", fetchError);
      throw new Error("Failed to fetch user subscriptions for web push.");
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log("Nenhuma inscrição de web push encontrada para este usuário.");
      return new Response(
        JSON.stringify({ message: "No web push subscriptions found." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const pushPromises = subscriptions.map(async (subRecord) => {
      try {
        await webpush.sendNotification(
          subRecord.subscription as webpush.PushSubscription,
          JSON.stringify({
            title: notificationTitle,
            body: briefMessage,
            url: notificationUrl,
          })
        );
        console.log(`Notificação web push enviada para o usuário ${userId}.`);
      } catch (pushError: any) {
        console.error(`Erro ao enviar notificação web push para ${userId}:`, pushError);
        if (pushError.statusCode === 410 || pushError.statusCode === 404) {
          console.warn(`Inscrição de web push inválida/expirada para o usuário ${userId}. Removendo...`);
          await supabase.from('user_subscriptions').delete().eq('subscription', subRecord.subscription);
        }
      }
    });
    await Promise.all(pushPromises);

    return new Response(JSON.stringify({ message: "Resumo semanal/notificação de teste enviado com sucesso!" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Erro na Edge Function weekly-brief:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});