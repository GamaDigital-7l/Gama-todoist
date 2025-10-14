import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { format, addMinutes, subMinutes, isBefore, isAfter, parseISO, isToday, getDay, subDays } from "https://esm.sh/date-fns@2.30.0";

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
      .select("telegram_api_key, telegram_chat_id, evolution_api_key, whatsapp_phone_number, notification_channel")
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
    const WHATSAPP_PHONE_NUMBER = settings?.whatsapp_phone_number;
    const NOTIFICATION_CHANNEL = settings?.notification_channel || "telegram";

    if (NOTIFICATION_CHANNEL === "telegram" && (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID)) {
      return new Response(
        JSON.stringify({ error: "Telegram API Key or Chat ID not configured for Telegram notifications." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (NOTIFICATION_CHANNEL === "whatsapp" && (!EVOLUTION_API_KEY || !WHATSAPP_PHONE_NUMBER)) {
      return new Response(
        JSON.stringify({ error: "Evolution API Key or WhatsApp Phone Number not configured for WhatsApp notifications." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (NOTIFICATION_CHANNEL === "none") {
      return new Response(
        JSON.stringify({ message: "Nenhum canal de notificação selecionado. Nenhuma notificação enviada." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const today = format(new Date(), "yyyy-MM-dd");
    const yesterday = format(subDays(new Date(), 1), "yyyy-MM-dd");
    const now = new Date();

    const { data: tasks, error: tasksError } = await supabase
      .from("tasks")
      .select("*")
      .eq("user_id", userId)
      .eq("is_completed", false)
      .or(`due_date.eq.${today},recurrence_type.neq.none`);

    if (tasksError) {
      console.error("Erro ao buscar tarefas:", tasksError);
      return new Response(JSON.stringify({ error: tasksError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const notificationsToSend = [];
    const tasksToUpdate = [];

    const isDayIncluded = (details: string | null | undefined, dayIndex: number) => {
      if (!details) return false;
      const days = details.split(',');
      return days.some(day => DAYS_OF_WEEK_MAP[day] === dayIndex);
    };

    for (const task of tasks) {
      let taskDueDate: Date | null = null;
      let taskTime: Date | null = null;
      let shouldNotify = false;
      let notificationType = "";

      let currentTarget = task.current_daily_target || task.target_value;
      const lastCompletionDate = task.last_successful_completion_date ? parseISO(task.last_successful_completion_date) : null;
      const isCompletedYesterday = lastCompletionDate && format(lastCompletionDate, "yyyy-MM-dd") === yesterday;

      if (task.task_type !== "general" && task.target_value !== null && task.target_value !== undefined) {
        if (!isCompletedYesterday && currentTarget !== null && currentTarget !== undefined) {
          currentTarget = currentTarget * 2;
        } else {
          currentTarget = task.target_value;
        }
        tasksToUpdate.push({ id: task.id, current_daily_target: currentTarget });
      }

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

      if (taskDueDate && task.time) {
        const [hour, minute] = task.time.split(":").map(Number);
        taskTime = new Date(taskDueDate.getFullYear(), taskDueDate.getMonth(), taskDueDate.getDate(), hour, minute, 0);
      } else if (taskDueDate && !task.time) {
        continue;
      } else {
        continue;
      }

      if (!taskTime) continue;

      const time15Before = subMinutes(taskTime, 15);
      const timeAt = taskTime;
      const time30After = addMinutes(taskTime, 30);

      const lastNotifiedAt = task.last_notified_at ? parseISO(task.last_notified_at) : null;

      if (isAfter(now, time15Before) && isBefore(now, timeAt) && (!lastNotifiedAt || isBefore(lastNotifiedAt, time15Before))) {
        shouldNotify = true;
        notificationType = "15 minutos antes";
      }
      else if (isAfter(now, subMinutes(timeAt, 5)) && isBefore(now, addMinutes(timeAt, 5)) && (!lastNotifiedAt || isBefore(lastNotifiedAt, subMinutes(timeAt, 5)))) {
        shouldNotify = true;
        notificationType = "na hora";
      }
      else if (isAfter(now, timeAt) && isBefore(now, time30After) && (!lastNotifiedAt || isBefore(lastNotifiedAt, timeAt))) {
        shouldNotify = true;
        notificationType = "30 minutos depois";
      }

      if (shouldNotify) {
        let message = `⏰ Lembrete de Tarefa (${notificationType}):\n\n*${task.title}*`;
        if (task.description) {
          message += `\n_${task.description}_`;
        }
        if (task.time) {
          message += `\nÀs ${task.time}`;
        }
        if (task.recurrence_type !== "none") {
          message += `\n(Recorrente: ${task.recurrence_type === "daily" ? "Diariamente" : task.recurrence_type === "weekly" ? `Semanalmente nos dias ${task.recurrence_details?.split(',').map(day => DAYS_OF_WEEK_LABELS_SHORT[day] || day).join(', ')}` : `Mensalmente no dia ${task.recurrence_details}`})`;
        } else if (task.due_date) {
          message += `\nEm ${format(parseISO(task.due_date), "dd/MM/yyyy")}`;
        }
        if (task.task_type !== "general" && currentTarget !== null && currentTarget !== undefined) {
          let targetUnit = "";
          if (task.task_type === "reading") targetUnit = "páginas";
          else if (task.task_type === "exercise") targetUnit = "minutos/reps";
          else if (task.task_type === "study") targetUnit = "minutos de estudo"; // Novo
          message += `\n*Meta de Hoje:* ${currentTarget} ${targetUnit}`;
        }
        
        notificationsToSend.push({
          task_id: task.id,
          message: message,
          title: `Lembrete: ${task.title}`,
          url: `/tasks`,
        });
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
        const evolutionApiUrl = `https://api.evolution-api.com/message/sendText/instanceName`;
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
        const { error: pushError } = await supabase.functions.invoke('send-web-push-notification', {
          body: {
            userId: userId,
            payload: {
              title: notification.title,
              body: notification.message.replace(/\*/g, "").replace(/_/g, ""),
              url: notification.url,
            }
          },
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (pushError) {
          console.error("Erro ao invocar send-web-push-notification:", pushError);
          throw new Error(`Web Push Function error: ${pushError.message}`);
        }
        return { message: "Web Push notification sent." };
      }
      return Promise.resolve(null);
    });

    await Promise.all(sendPromises);

    if (tasksToUpdate.length > 0) {
      for (const taskUpdate of tasksToUpdate) {
        const { error: updateError } = await supabase
          .from("tasks")
          .update({ 
            last_notified_at: now.toISOString(),
            current_daily_target: taskUpdate.current_daily_target
          })
          .eq("id", taskUpdate.id);

        if (updateError) {
          console.error("Erro ao atualizar last_notified_at ou current_daily_target:", updateError);
        }
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