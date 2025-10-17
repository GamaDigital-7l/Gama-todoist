import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { format, isToday, getDay, parseISO, isThisWeek, isThisMonth } from "https://esm.sh/date-fns@2.30.0"; // Adicionado isThisWeek, isThisMonth
import { utcToZonedTime, formatInTimeZone } from "https://esm.sh/date-fns-tz@2.0.1"; // Importar date-fns-tz
import webpush from "https://esm.sh/web-push@3.6.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DAYS_OF_WEEK_MAP: { [key: string]: number } = {
  "Sunday": 0, "Monday": 1, "Tuesday": 2, "Wednesday": 3,
  "Thursday": 4, "Friday": 5, "Saturday": 6
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
  if (req.method === "OPTIONS") {
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
      .select("notification_channel")
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

    const { timeOfDay } = await req.json();

    // Obter a data e hora atual no fuso horário de São Paulo
    const nowUtc = new Date();
    const nowSaoPaulo = utcToZonedTime(nowUtc, SAO_PAULO_TIMEZONE);
    const todaySaoPaulo = format(nowSaoPaulo, "yyyy-MM-dd", { timeZone: SAO_PAULO_TIMEZONE });
    const currentDayOfWeekSaoPaulo = getDay(nowSaoPaulo); // 0 para domingo, 1 para segunda, etc.

    let briefMessage = "";
    let notificationTitle = "";
    let notificationUrl = "/dashboard";

    if (timeOfDay === 'test_notification') {
      notificationTitle = "Notificação de Teste";
      briefMessage = "Esta é uma notificação de teste enviada com sucesso!";
    } else {
      const { data: tasks, error: tasksError } = await supabase
        .from("tasks")
        .select("title, description, due_date, time, recurrence_type, recurrence_details, is_completed, last_successful_completion_date")
        .eq("user_id", userId)
        .or(`due_date.eq.${todaySaoPaulo},recurrence_type.neq.none`);

      if (tasksError) {
        console.error("Erro ao buscar tarefas para o brief:", tasksError);
        throw tasksError;
      }

      const isDayIncluded = (details: string | null | undefined, dayIndex: number) => {
        if (!details) return false;
        const days = details.split(',');
        return days.some(day => DAYS_OF_WEEK_MAP[day] === dayIndex);
      };

      const todayTasks = (tasks || []).filter(task => {
        let isTaskDueToday = false;

        if (task.recurrence_type !== "none") {
          if (task.recurrence_type === "daily") {
            isTaskDueToday = true;
          }
          if (task.recurrence_type === "weekly" && task.recurrence_details) {
            if (isDayIncluded(task.recurrence_details, currentDayOfWeekSaoPaulo)) {
              isTaskDueToday = true;
            }
          }
          if (task.recurrence_type === "monthly" && task.recurrence_details) {
            if (parseInt(task.recurrence_details) === nowSaoPaulo.getDate()) {
              isTaskDueToday = true;
            }
          }
        } else if (task.due_date) {
          return format(parseISO(task.due_date), "yyyy-MM-dd") === todaySaoPaulo;
        }
        return isTaskDueToday && !getAdjustedTaskCompletionStatus(task);
      });

      // Geração de mensagem estática ou simplificada, sem IA
      notificationTitle = timeOfDay === 'morning' ? "Seu Brief da Manhã" : "Seu Brief da Noite";
      briefMessage = `Olá! Aqui está seu resumo para a ${timeOfDay === 'morning' ? 'manhã' : 'noite'}:\n\n`;

      if (todayTasks.length > 0) {
        briefMessage += `Você tem ${todayTasks.length} tarefas pendentes para hoje:\n`;
        todayTasks.slice(0, 3).forEach(task => {
          briefMessage += `- ${task.title}${task.time ? ` às ${task.time}` : ''}\n`;
        });
        if (todayTasks.length > 3) {
          briefMessage += `...e mais ${todayTasks.length - 3} tarefas!\n`;
        }
      } else {
        briefMessage += "Nenhuma tarefa pendente para hoje. Ótimo trabalho!\n";
      }
      briefMessage += `\nTenha um dia produtivo!`;
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

    return new Response(JSON.stringify({ message: "Brief da manhã/notificação de teste enviado com sucesso!" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Erro na Edge Function daily-brief:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});