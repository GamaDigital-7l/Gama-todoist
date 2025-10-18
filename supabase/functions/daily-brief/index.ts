import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { format, isToday, getDay, parseISO, isThisWeek, isThisMonth, isBefore, startOfDay, setHours, setMinutes } from "https://esm.sh/date-fns@3.6.0"; // Versão atualizada
import { utcToZonedTime, formatInTimeZone } from "https://esm.sh/date-fns-tz@2.0.1";
import webpush from "https://esm.sh/web-push@3.6.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DAYS_OF_WEEK_MAP: { [key: string]: number } = {
  "Sunday": 0, "Monday": 1, "Tuesday": 2, "Wednesday": 3,
  "Thursday": 4, "Friday": 5, "Saturday": 6
};

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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 200 }); // Adicionado status: 200
  }

  try {
    const supabaseServiceRole = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let userId: string;
    const { timeOfDay, userId: bodyUserId } = await req.json(); // Obter userId do corpo se for chamada de serviço

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
    const userTimezone = profile?.timezone || 'America/Sao_Paulo';

    const { data: settings, error: settingsError } = await supabaseServiceRole
      .from("settings")
      .select("telegram_bot_token, telegram_chat_id, telegram_enabled, webpush_enabled, daily_brief_morning_time, daily_brief_evening_time")
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

    if (!telegramEnabled && !webpushEnabled) {
      return new Response(
        JSON.stringify({ message: "Nenhum canal de notificação habilitado. Nenhuma notificação enviada." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Configuração do web-push
    const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY");
    const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY");

    if (webpushEnabled) { // Only set VAPID details if webpush is enabled
      if (!VAPID_PRIVATE_KEY || !VAPID_PUBLIC_KEY) {
        console.error("VAPID keys not configured in Supabase secrets for Web Push notifications.");
        webpushEnabled = false; // Disable webpush for this user if keys are missing
      } else {
        webpush.setVapidDetails(
          'mailto: <gustavogama099@gmail.com>',
          VAPID_PUBLIC_KEY!,
          VAPID_PRIVATE_KEY!
        );
      }
    }

    // Obter a data e hora atual no fuso horário do usuário
    const nowUtc = new Date();
    const nowInUserTimezone = utcToZonedTime(nowUtc, userTimezone);
    const todayInUserTimezone = format(nowInUserTimezone, "yyyy-MM-dd", { timeZone: userTimezone });
    const currentDayOfWeekInUserTimezone = getDay(nowInUserTimezone); // 0 para domingo, 1 para segunda, etc.

    let briefMessage = "";
    let notificationTitle = "";
    let notificationUrl = "/dashboard";

    if (timeOfDay === 'test_notification') {
      notificationTitle = "Notificação de Teste";
      briefMessage = "Esta é uma notificação de teste enviada com sucesso!";
    } else {
      const { data: tasks, error: tasksError } = await supabaseServiceRole
        .from("tasks")
        .select("id, title, description, due_date, time, recurrence_type, recurrence_details, is_completed, last_successful_completion_date, is_priority, current_board")
        .eq("user_id", userId)
        .or(`due_date.eq.${todayInUserTimezone},recurrence_type.neq.none`); // Filter by due_date OR recurring

      if (tasksError) {
        console.error("Erro ao buscar tarefas para o brief:", tasksError);
        throw tasksError;
      }

      const isDayIncluded = (details: string | null | undefined, dayIndex: number) => {
        if (!details) return false;
        const days = details.split(',');
        return days.some(day => DAYS_OF_WEEK_MAP[day] === dayIndex);
      };

      const relevantTasks = (tasks || []).filter(task => {
        let isTaskDueToday = false;

        if (task.recurrence_type !== "none") {
          if (task.recurrence_type === "daily") {
            isTaskDueToday = true;
          }
          if (task.recurrence_type === "weekly" && task.recurrence_details) {
            if (isDayIncluded(task.recurrence_details, currentDayOfWeekInUserTimezone)) {
              isTaskDueToday = true;
            }
          }
          if (task.recurrence_type === "monthly" && task.recurrence_details) {
            if (parseInt(task.recurrence_details) === nowInUserTimezone.getDate()) {
              isTaskDueToday = true;
            }
          }
        } else if (task.due_date) {
          return format(parseISO(task.due_date), "yyyy-MM-dd") === todayInUserTimezone;
        }
        return isTaskDueToday;
      });

      const pendingTasks = relevantTasks.filter(task => !getAdjustedTaskCompletionStatus(task, nowInUserTimezone));
      const completedTasks = relevantTasks.filter(task => getAdjustedTaskCompletionStatus(task, nowInUserTimezone));
      const overdueTasks = (tasks || []).filter(task => task.current_board === 'overdue');
      const priorityTasks = pendingTasks.filter(task => task.is_priority);

      notificationTitle = timeOfDay === 'morning' ? "Seu Brief da Manhã" : "Seu Brief da Noite";
      briefMessage = `Olá! Aqui está seu resumo para a ${timeOfDay === 'morning' ? 'manhã' : 'noite'}:\n\n`;

      if (timeOfDay === 'morning') {
        briefMessage += `Você tem ${pendingTasks.length} tarefas pendentes para hoje.\n`;
        if (priorityTasks.length > 0) {
          briefMessage += `Prioridades:\n`;
          priorityTasks.slice(0, 3).forEach(task => {
            briefMessage += `- ${task.title}${task.time ? ` às ${task.time}` : ''}\n`;
          });
          if (priorityTasks.length > 3) {
            briefMessage += `...e mais ${priorityTasks.length - 3} prioridades!\n`;
          }
        }
        if (overdueTasks.length > 0) {
          briefMessage += `\n⚠️ Você tem ${overdueTasks.length} tarefas atrasadas!\n`;
          overdueTasks.slice(0, 3).forEach(task => {
            briefMessage += `- ${task.title}\n`;
          });
          if (overdueTasks.length > 3) {
            briefMessage += `...e mais ${overdueTasks.length - 3} atrasadas!\n`;
          }
        }
      } else { // evening brief
        if (pendingTasks.length === 0 && overdueTasks.length === 0) {
          briefMessage += "🎉 Parabéns! Todas as suas tarefas de hoje foram concluídas!\n";
        } else {
          briefMessage += `Você concluiu ${completedTasks.length} tarefas hoje.\n`;
          briefMessage += `Ainda faltam ${pendingTasks.length} tarefas para hoje.\n`;
          if (overdueTasks.length > 0) {
            briefMessage += `⚠️ E você tem ${overdueTasks.length} tarefas atrasadas.\n`;
          }
          briefMessage += `\nContinue firme! 💪`;
        }
      }
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

    return new Response(JSON.stringify({ message: "Brief diário/notificação de teste processado com sucesso!" }), {
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