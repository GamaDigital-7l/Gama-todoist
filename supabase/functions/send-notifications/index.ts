import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { format, addMinutes, subMinutes, isBefore, isAfter, parseISO, isToday, getDay, subDays } from "https://esm.sh/date-fns@2.30.0";
import webpush from "https://esm.sh/web-push@3.6.2"; // Importar a biblioteca web-push

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DAYS_OF_WEEK_MAP: { [key: string]: number } = {
  "Sunday": 0, "Monday": 1, "Tuesday": 2, "Wednesday": 3,
  "Thursday": 4, "Friday": 5, "Saturday": 6
};

const DAYS_OF_WEEK_LABELS_SHORT: { [key: string]: string } = {
  "Sunday": "Dom", "Monday": "Seg", "Tuesday": "Ter", "Wednesday": "Qua",
  "Thursday": "Qui", "Friday": "Sex", "Saturday": "Sáb"
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
      .select("telegram_api_key, telegram_chat_id, evolution_api_key, evolution_api_instance_name, whatsapp_phone_number, notification_channel")
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

    const TELEGRAM_BOT_TOKEN = settings?.telegram_api_key;
    const TELEGRAM_CHAT_ID = settings?.telegram_chat_id;
    const EVOLUTION_API_KEY = settings?.evolution_api_key;
    const EVOLUTION_API_INSTANCE_NAME = settings?.evolution_api_instance_name;
    const WHATSAPP_PHONE_NUMBER = settings?.whatsapp_phone_number;
    const NOTIFICATION_CHANNEL = settings?.notification_channel || "telegram";

    if (NOTIFICATION_CHANNEL === "telegram" && (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID)) {
      return new Response(
        JSON.stringify({ error: "Telegram API Key or Chat ID not configured for Telegram notifications." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (NOTIFICATION_CHANNEL === "whatsapp" && (!EVOLUTION_API_KEY || !EVOLUTION_API_INSTANCE_NAME || !WHATSAPP_PHONE_NUMBER)) {
      return new Response(
        JSON.stringify({ error: "Evolution API Key, Instance Name, or WhatsApp Phone Number not configured for WhatsApp notifications." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (NOTIFICATION_CHANNEL === "none") {
      return new Response(
        JSON.stringify({ message: "Nenhum canal de notificação selecionado. Nenhuma notificação enviada." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Configuração do web-push para notificações web_push
    const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY");
    const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY");

    if (NOTIFICATION_CHANNEL === "web_push" && (!VAPID_PRIVATE_KEY || !VAPID_PUBLIC_KEY)) {
      return new Response(
        JSON.stringify({ error: "VAPID keys not configured in Supabase secrets for Web Push notifications." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (NOTIFICATION_CHANNEL === "web_push") {
      webpush.setVapidDetails(
        'mailto: <gustavogama099@gmail.com>', // Seu e-mail de contato
        VAPID_PUBLIC_KEY!,
        VAPID_PRIVATE_KEY!
      );
    }

    const today = format(new Date(), "yyyy-MM-dd");
    const yesterday = format(subDays(new Date(), 1), "yyyy-MM-dd");
    const now = new Date();

    const { data: tasks, error: tasksError } = await supabase
      .from("tasks")
      .select("*")
      .eq("user_id", userId)
      .or(`due_date.eq.${today},recurrence_type.neq.none`); // Inclui tarefas concluídas para o lembrete de 1h depois

    if (tasksError) {
      console.error("Erro ao buscar tarefas:", tasksError);
      return new Response(JSON.stringify({ error: tasksError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const notificationsToSend = [];
    const tasksToUpdateCurrentTarget = []; // Para atualizar current_daily_target
    const tasksToUpdateLastNotified = new Map<string, Date>(); // Para atualizar last_notified_at

    const isDayIncluded = (details: string | null | undefined, dayIndex: number) => {
      if (!details) return false;
      const days = details.split(',');
      return days.some(day => DAYS_OF_WEEK_MAP[day] === dayIndex);
    };

    for (const task of tasks) {
      let taskDueDate: Date | null = null;
      let taskTime: Date | null = null;

      // Lógica para calcular current_daily_target
      let currentTarget = task.current_daily_target || task.target_value;
      const lastCompletionDate = task.last_successful_completion_date ? parseISO(task.last_successful_completion_date) : null;
      const isCompletedYesterday = lastCompletionDate && format(lastCompletionDate, "yyyy-MM-dd") === yesterday;

      if (task.task_type !== "general" && task.target_value !== null && task.target_value !== undefined) {
        if (!isCompletedYesterday && currentTarget !== null && currentTarget !== undefined) {
          currentTarget = currentTarget * 2;
        } else {
          currentTarget = task.target_value;
        }
        tasksToUpdateCurrentTarget.push({ id: task.id, current_daily_target: currentTarget });
      }

      // Determinar se a tarefa é para hoje
      if (task.recurrence_type !== "none") {
        const currentDayOfWeek = getDay(now);
        const currentDayOfMonth = now.getDate();

        if (task.recurrence_type === "daily") {
          taskDueDate = now;
        } else if (task.recurrence_type === "weekly" && task.recurrence_details) {
          if (isDayIncluded(task.recurrence_details, currentDayOfWeek)) {
            taskDueDate = now;
          }
        } else if (task.recurrence_type === "monthly" && task.recurrence_details) {
          if (parseInt(task.recurrence_details) === currentDayOfMonth) {
            taskDueDate = now;
          }
        }
      } else if (task.due_date) {
        const parsedDueDate = parseISO(task.due_date);
        if (isToday(parsedDueDate)) {
          taskDueDate = parsedDueDate;
        }
      }

      if (!taskDueDate || !task.time) continue; // A tarefa não é para hoje ou não tem horário

      const [hour, minute] = task.time.split(":").map(Number);
      taskTime = new Date(taskDueDate.getFullYear(), taskDueDate.getMonth(), taskDueDate.getDate(), hour, minute, 0);

      const lastNotifiedAt = task.last_notified_at ? parseISO(task.last_notified_at) : null;

      // Lógica de notificação para 15 minutos antes
      const time15Before = subMinutes(taskTime, 15);
      if (isAfter(now, time15Before) && isBefore(now, taskTime) && (!lastNotifiedAt || isBefore(lastNotifiedAt, time15Before))) {
        let message = `⏰ Lembrete de Tarefa (15 minutos antes):\n\n*${task.title}*`;
        if (task.description) message += `\n_${task.description}_`;
        if (task.time) message += `\nÀs ${task.time}`;
        if (task.recurrence_type !== "none") {
          message += `\n(Recorrente: ${task.recurrence_type === "daily" ? "Diariamente" : task.recurrence_type === "weekly" ? `Semanalmente nos dias ${task.recurrence_details?.split(',').map(day => DAYS_OF_WEEK_LABELS_SHORT[day] || day).join(', ')}` : `Mensalmente no dia ${task.recurrence_details}`})`;
        } else if (task.due_date) {
          message += `\nEm ${format(parseISO(task.due_date), "dd/MM/yyyy")}`;
        }
        if (task.task_type !== "general" && currentTarget !== null && currentTarget !== undefined) {
          let targetUnit = "";
          if (task.task_type === "reading") targetUnit = "páginas";
          else if (task.task_type === "exercise") targetUnit = "minutos/reps";
          else if (task.task_type === "study") targetUnit = "minutos de estudo";
          message += `\n*Meta de Hoje:* ${currentTarget} ${targetUnit}`;
        }
        notificationsToSend.push({
          task_id: task.id,
          message: message,
          title: `Lembrete: ${task.title}`,
          url: `/tasks`,
          triggerTime: time15Before,
        });
        tasksToUpdateLastNotified.set(task.id, time15Before);
      }

      // Lógica de notificação na hora
      const timeAtWindowStart = subMinutes(taskTime, 5);
      const timeAtWindowEnd = addMinutes(taskTime, 5);
      if (isAfter(now, timeAtWindowStart) && isBefore(now, timeAtWindowEnd) && (!lastNotifiedAt || isBefore(lastNotifiedAt, timeAtWindowStart))) {
        let message = `🔔 Lembrete de Tarefa (na hora):\n\n*${task.title}*`;
        if (task.description) message += `\n_${task.description}_`;
        if (task.time) message += `\nÀs ${task.time}`;
        if (task.recurrence_type !== "none") {
          message += `\n(Recorrente: ${task.recurrence_type === "daily" ? "Diariamente" : task.recurrence_type === "weekly" ? `Semanalmente nos dias ${task.recurrence_details?.split(',').map(day => DAYS_OF_WEEK_LABELS_SHORT[day] || day).join(', ')}` : `Mensalmente no dia ${task.recurrence_details}`})`;
        } else if (task.due_date) {
          message += `\nEm ${format(parseISO(task.due_date), "dd/MM/yyyy")}`;
        }
        if (task.task_type !== "general" && currentTarget !== null && currentTarget !== undefined) {
          let targetUnit = "";
          if (task.task_type === "reading") targetUnit = "páginas";
          else if (task.task_type === "exercise") targetUnit = "minutos/reps";
          else if (task.task_type === "study") targetUnit = "minutos de estudo";
          message += `\n*Meta de Hoje:* ${currentTarget} ${targetUnit}`;
        }
        notificationsToSend.push({
          task_id: task.id,
          message: message,
          title: `Lembrete: ${task.title}`,
          url: `/tasks`,
          triggerTime: taskTime,
        });
        tasksToUpdateLastNotified.set(task.id, taskTime);
      }

      // Lógica de notificação 1 hora depois se não concluída
      const time60After = addMinutes(taskTime, 60);
      if (!task.is_completed && isAfter(now, taskTime) && isBefore(now, time60After) && (!lastNotifiedAt || isBefore(lastNotifiedAt, taskTime))) {
        let message = `⚠️ Tarefa Pendente (1 hora depois):\n\n*${task.title}* ainda não foi concluída!`;
        if (task.description) message += `\n_${task.description}_`;
        if (task.time) message += `\nÀs ${task.time}`;
        if (task.recurrence_type !== "none") {
          message += `\n(Recorrente: ${task.recurrence_type === "daily" ? "Diariamente" : task.recurrence_type === "weekly" ? `Semanalmente nos dias ${task.recurrence_details?.split(',').map(day => DAYS_OF_WEEK_LABELS_SHORT[day] || day).join(', ')}` : `Mensalmente no dia ${task.recurrence_details}`})`;
        } else if (task.due_date) {
          message += `\nEm ${format(parseISO(task.due_date), "dd/MM/yyyy")}`;
        }
        if (task.task_type !== "general" && currentTarget !== null && currentTarget !== undefined) {
          let targetUnit = "";
          if (task.task_type === "reading") targetUnit = "páginas";
          else if (task.task_type === "exercise") targetUnit = "minutos/reps";
          else if (task.task_type === "study") targetUnit = "minutos de estudo";
          message += `\n*Meta de Hoje:* ${currentTarget} ${targetUnit}`;
        }
        notificationsToSend.push({
          task_id: task.id,
          message: message,
          title: `Tarefa Pendente: ${task.title}`,
          url: `/tasks`,
          triggerTime: time60After,
        });
        tasksToUpdateLastNotified.set(task.id, time60After);
      }
    }

    const sendPromises = notificationsToSend.map(async (notification) => {
      if (NOTIFICATION_CHANNEL === "telegram") {
        const telegramApiUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        const response = await fetch(telegramApiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            chat_id: TELEGRAM_CHAT_ID,
            text: notification.message,
            parse_mode: "Markdown",
          }),
        });
        const telegramResponseData = await response.json();
        console.log("Telegram API Response OK:", response.ok);
        console.log("Telegram API Full Response:", telegramResponseData);

        if (!response.ok) {
          console.error("Erro ao enviar notificação para o Telegram:", telegramResponseData);
          throw new Error(`Telegram API error: ${telegramResponseData.description || JSON.stringify(telegramResponseData)}`);
        }
        return telegramResponseData;
      } else if (NOTIFICATION_CHANNEL === "whatsapp") {
        const evolutionApiUrl = `https://api.evolution-api.com/message/sendText/${EVOLUTION_API_INSTANCE_NAME}`;
        console.log("Evolution API URL:", evolutionApiUrl);
        const response = await fetch(evolutionApiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": EVOLUTION_API_KEY!,
          },
          body: JSON.stringify({
            number: WHATSAPP_PHONE_NUMBER!,
            options: {
              delay: 1200,
              presence: "composing",
              linkPreview: false
            },
            textMessage: {
              text: notification.message.replace(/\*/g, "").replace(/_/g, "")
            }
          }),
        });
        const whatsappResponseData = await response.json();
        console.log("Evolution API Response OK:", response.ok);
        console.log("Evolution API Full Response:", whatsappResponseData);

        if (!response.ok) {
          console.error("Erro ao enviar notificação para o WhatsApp (Evolution API):", whatsappResponseData);
          throw new Error(`Evolution API error: ${whatsappResponseData.message || JSON.stringify(whatsappResponseData)}`);
        }
        return whatsappResponseData;
      } else if (NOTIFICATION_CHANNEL === "web_push") {
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
          return { message: "No web push subscriptions found." };
        }

        const pushPromises = subscriptions.map(async (subRecord) => {
          try {
            await webpush.sendNotification(
              subRecord.subscription as webpush.PushSubscription,
              JSON.stringify({
                title: notification.title,
                body: notification.message.replace(/\*/g, "").replace(/_/g, ""),
                url: notification.url,
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
        return { message: "Web Push notifications processed." };
      }
      return Promise.resolve(null);
    });

    await Promise.all(sendPromises);

    // Atualizar current_daily_target
    if (tasksToUpdateCurrentTarget.length > 0) {
      for (const taskUpdate of tasksToUpdateCurrentTarget) {
        const { error: updateError } = await supabase
          .from("tasks")
          .update({ current_daily_target: taskUpdate.current_daily_target })
          .eq("id", taskUpdate.id);

        if (updateError) {
          console.error("Erro ao atualizar current_daily_target:", updateError);
        }
      }
    }

    // Atualizar last_notified_at para as tarefas que tiveram notificações enviadas
    for (const [taskId, triggerTime] of tasksToUpdateLastNotified.entries()) {
      const { error: updateError } = await supabase
        .from("tasks")
        .update({ last_notified_at: triggerTime.toISOString() })
        .eq("id", taskId);
      if (updateError) {
        console.error(`Erro ao atualizar last_notified_at para tarefa ${taskId}:`, updateError);
      }
    }

    return new Response(JSON.stringify({ message: "Notificações enviadas com sucesso!" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Erro na Edge Function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});