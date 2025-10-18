import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { format, subWeeks, isToday, isThisWeek, isThisMonth, parseISO, getDay, isBefore, startOfDay } from "https://esm.sh/date-fns@3.6.0"; // Versão atualizada
import { utcToZonedTime, formatInTimeZone } from "https://esm.sh/date-fns-tz@2.0.1";
import OpenAI from "https://esm.sh/openai@4.52.2";
import Groq from "https://esm.sh/groq-sdk@0.10.0";
import webpush from "https://esm.sh/web-push@3.6.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SAO_PAULO_TIMEZONE = "America/Sao_Paulo"; // Fallback timezone

// Helper function to get adjusted completion status for recurring tasks
const getAdjustedTaskCompletionStatus = (task: any, nowInUserTimezone: Date): boolean => {
  if (task.recurrence_type === "none") {
    return task.is_completed;
  }

  if (!task.last_successful_completion_date) {
    return false; // Never completed in this cycle
  }

  const lastCompletionDate = parseISO(task.last_successful_completion_date);
  const startOfTodayInUserTimezone = startOfDay(nowInUserTimezone);

  switch (task.recurrence_type) {
    case "daily":
      return !isBefore(lastCompletionDate, startOfTodayInUserTimezone);
    case "weekly":
      return isThisWeek(lastCompletionDate, { weekStartsOn: 0 }); // Assuming week starts on Sunday
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
    const supabaseServiceRole = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let userId: string;
    const { type, userId: bodyUserId } = await req.json(); // Obter userId do corpo se for chamada de serviço

    if (bodyUserId) {
      userId = bodyUserId;
    } else {
      // Se não houver userId no corpo, tentar autenticar via cabeçalho (chamada do frontend)
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return new Response('Unauthorized', { status: 401, headers: corsHeaders });
      }
      const token = authHeader.replace('Bearer ', '');
      const { data: userAuth, error: authError } = await supabaseServiceRole.auth.getUser(token);

      if (authError || !userAuth.user) {
        console.error("Erro de autenticação:", authError);
        return new Response(
          JSON.stringify({ error: "Unauthorized: Invalid or missing token." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      userId = userAuth.user.id;
    }

    const { data: profile, error: profileError } = await supabaseServiceRole
      .from('profiles')
      .select('timezone')
      .eq('id', userId)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      console.error("Erro ao buscar perfil do usuário:", profileError);
      throw profileError;
    }
    const userTimezone = profile?.timezone || SAO_PAULO_TIMEZONE;

    const { data: settings, error: settingsError } = await supabaseServiceRole
      .from("settings")
      .select("groq_api_key, openai_api_key, ai_provider_preference, telegram_bot_token, telegram_chat_id, telegram_enabled, webpush_enabled, weekly_brief_day, weekly_brief_time")
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

    let telegramEnabled = settings?.telegram_enabled || false;
    let webpushEnabled = settings?.webpush_enabled || false;
    const telegramBotToken = settings?.telegram_bot_token;
    const telegramChatId = settings?.telegram_chat_id;
    const AI_PROVIDER = settings?.ai_provider_preference || 'groq';

    if (!telegramEnabled && !webpushEnabled) {
      return new Response(
        JSON.stringify({ message: "Nenhum canal de notificação habilitado. Nenhuma notificação enviada." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Configuração do web-push
    const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY");
    const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY");

    if (webpushEnabled && (!VAPID_PRIVATE_KEY || !VAPID_PUBLIC_KEY)) {
      console.error("VAPID keys not configured in Supabase secrets for Web Push notifications.");
      // Não lançar erro fatal, apenas desabilitar webpush para este usuário
      webpushEnabled = false;
    }
    if (webpushEnabled) {
      webpush.setVapidDetails(
        'mailto: <gustavogama099@gmail.com>',
        VAPID_PUBLIC_KEY!,
        VAPID_PRIVATE_KEY!
      );
    }

    const nowUtc = new Date();
    const nowInUserTimezone = utcToZonedTime(nowUtc, userTimezone);
    const oneWeekAgoInUserTimezone = format(subWeeks(nowInUserTimezone, 1), "yyyy-MM-dd", { timeZone: userTimezone });
    const todayInUserTimezoneFormatted = format(nowInUserTimezone, "yyyy-MM-dd", { timeZone: userTimezone });

    let briefMessage = "";
    let notificationTitle = "";
    let notificationUrl = "/dashboard";

    if (type === 'test_notification') {
      notificationTitle = "Notificação de Teste Semanal";
      briefMessage = "Esta é uma notificação de teste semanal enviada com sucesso!";
    } else if (type === 'weekly_brief') {
      // Fetch tasks for the last week
      const { data: tasks, error: tasksError } = await supabaseServiceRole
        .from("tasks")
        .select("title, is_completed, created_at, completed_at, due_date, recurrence_type, last_successful_completion_date, current_board, is_priority")
        .eq("user_id", userId)
        .gte("created_at", oneWeekAgoInUserTimezone); // Tasks created in the last week

      if (tasksError) {
        console.error("Erro ao buscar tarefas para o brief semanal:", tasksError);
        throw tasksError;
      }

      const completedTasks = tasks?.filter(task => task.is_completed && task.completed_at && parseISO(task.completed_at) >= parseISO(oneWeekAgoInUserTimezone)) || [];
      const overdueTasks = tasks?.filter(task => task.current_board === 'overdue' && task.due_date && parseISO(task.due_date) < nowInUserTimezone && !task.is_completed) || [];
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
        Here's the data for the last week (from ${oneWeekAgoInUserTimezone} to ${todayInUserTimezoneFormatted}):
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
    if (webpushEnabled) {
      const { data: subscriptions, error: fetchError } = await supabaseServiceRole
        .from('user_subscriptions')
        .select('subscription')
        .eq('user_id', userId);

      if (fetchError) {
        console.error("Erro ao buscar inscrições de usuário para web push:", fetchError);
        // Não lançar erro fatal, apenas continuar sem web push
      } else if (subscriptions && subscriptions.length > 0) {
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
              await supabaseServiceRole.from('user_subscriptions').delete().eq('subscription', subRecord.subscription);
            }
          }
        });
        await Promise.all(pushPromises);
      } else {
        console.log(`[User ${userId}] Nenhuma inscrição de web push encontrada.`);
      }
    }

    // Enviar notificação Telegram
    if (telegramEnabled && telegramBotToken && telegramChatId) {
      try {
        const telegramResponse = await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chat_id: telegramChatId,
            text: briefMessage,
            parse_mode: 'Markdown', // Ou 'HTML' se preferir
          }),
        });

        if (!telegramResponse.ok) {
          const errorData = await telegramResponse.json();
          console.error("Erro ao enviar mensagem para o Telegram:", errorData);
          throw new Error(errorData.description || "Erro desconhecido ao enviar para o Telegram.");
        }
        console.log(`Mensagem Telegram enviada para o usuário ${userId}.`);
      } catch (telegramError: any) {
        console.error(`Erro ao enviar mensagem Telegram para ${userId}:`, telegramError);
      }
    }

    return new Response(JSON.stringify({ message: "Resumo semanal/notificação de teste processado com sucesso!" }), {
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