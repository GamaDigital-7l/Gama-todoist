import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { format, addMinutes, subMinutes, isBefore, isAfter, parseISO, isToday, getDay } from "https://esm.sh/date-fns@2.30.0"; // Mantendo date-fns v2.x.x

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, // Usar service role key para acesso total
    );

    // 1. Obter configurações do Telegram e Evolution API
    const { data: settings, error: settingsError } = await supabase
      .from("settings")
      .select("telegram_api_key, telegram_chat_id, evolution_api_key, whatsapp_phone_number, notification_channel")
      .limit(1)
      .single();

    if (settingsError) {
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

    // 2. Obter tarefas para hoje que não estão completas
    const today = format(new Date(), "yyyy-MM-dd");
    const now = new Date(); // Current time in UTC

    const { data: tasks, error: tasksError } = await supabase
      .from("tasks")
      .select("*")
      .eq("is_completed", false)
      .or(`due_date.eq.${today},recurrence_type.neq.none`); // Tasks due today OR recurring

    if (tasksError) {
      console.error("Erro ao buscar tarefas:", tasksError);
      return new Response(JSON.stringify({ error: tasksError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const notificationsToSend = [];
    const tasksToUpdate = [];

    for (const task of tasks) {
      let taskDueDate: Date | null = null;
      let taskTime: Date | null = null;
      let shouldNotify = false;
      let notificationType = "";

      // Handle recurrence
      if (task.recurrence_type !== "none") {
        const currentDayOfWeek = getDay(now); // 0 for Sunday, 1 for Monday, etc.
        const currentDayOfMonth = now.getDate();

        if (task.recurrence_type === "daily_weekday" && (currentDayOfWeek >= 1 && currentDayOfWeek <= 5)) {
          taskDueDate = now; // Treat as due today
        } else if (task.recurrence_type === "weekly" && task.recurrence_details) {
          const dayMap: { [key: string]: number } = {
            "Sunday": 0, "Monday": 1, "Tuesday": 2, "Wednesday": 3,
            "Thursday": 4, "Friday": 5, "Saturday": 6
          };
          if (dayMap[task.recurrence_details] === currentDayOfWeek) {
            taskDueDate = now; // Treat as due today
          }
        } else if (task.recurrence_type === "monthly" && task.recurrence_details) {
          if (parseInt(task.recurrence_details) === currentDayOfMonth) {
            taskDueDate = now; // Treat as due today
          }
        }
      } else if (task.due_date) {
        // Handle single due date
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

      // Check for 15 minutes before
      if (isAfter(now, time15Before) && isBefore(now, timeAt) && (!lastNotifiedAt || isBefore(lastNotifiedAt, time15Before))) {
        shouldNotify = true;
        notificationType = "15 minutos antes";
      }
      // Check for at time
      else if (isAfter(now, subMinutes(timeAt, 5)) && isBefore(now, addMinutes(timeAt, 5)) && (!lastNotifiedAt || isBefore(lastNotifiedAt, subMinutes(timeAt, 5)))) {
        shouldNotify = true;
        notificationType = "na hora";
      }
      // Check for 30 minutes after
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
          message += `\n(Recorrente: ${task.recurrence_type === "daily_weekday" ? "Dias de Semana" : task.recurrence_type === "weekly" ? `Semanalmente às ${task.recurrence_details}` : `Mensalmente no dia ${task.recurrence_details}`})`;
        } else if (task.due_date) {
          message += `\nEm ${format(parseISO(task.due_date), "dd/MM/yyyy")}`;
        }
        
        notificationsToSend.push({
          task_id: task.id,
          message: message,
        });
        tasksToUpdate.push(task.id);
      }
    }

    // 3. Enviar notificações
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
        const telegramResponseData = await response.json(); // Captura a resposta JSON
        console.log("Telegram API Response OK:", response.ok); // Loga se a resposta HTTP foi 2xx
        console.log("Telegram API Full Response:", telegramResponseData); // Loga a resposta completa da API do Telegram

        if (!response.ok) {
          console.error("Erro ao enviar notificação para o Telegram:", telegramResponseData);
          throw new Error(`Telegram API error: ${telegramResponseData.description || JSON.stringify(telegramResponseData)}`);
        }
        return telegramResponseData;
      } else if (NOTIFICATION_CHANNEL === "whatsapp") {
        const evolutionApiUrl = `https://api.evolution-api.com/message/sendText/instanceName`; // Substitua 'instanceName' e o domínio se necessário
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
              text: notification.message.replace(/\*/g, "").replace(/_/g, "") // Remover Markdown para WhatsApp simples
            }
          }),
        });
        const whatsappResponseData = await response.json(); // Captura a resposta JSON
        console.log("Evolution API Response OK:", response.ok); // Loga se a resposta HTTP foi 2xx
        console.log("Evolution API Full Response:", whatsappResponseData); // Loga a resposta completa da Evolution API

        if (!response.ok) {
          console.error("Erro ao enviar notificação para o WhatsApp (Evolution API):", whatsappResponseData);
          throw new Error(`Evolution API error: ${whatsappResponseData.message || JSON.stringify(whatsappResponseData)}`);
        }
        return whatsappResponseData;
      }
      return Promise.resolve(null);
    });

    await Promise.all(sendPromises);

    // 4. Atualizar last_notified_at para as tarefas notificadas
    if (tasksToUpdate.length > 0) {
      const { error: updateError } = await supabase
        .from("tasks")
        .update({ last_notified_at: now.toISOString() })
        .in("id", tasksToUpdate);

      if (updateError) {
        console.error("Erro ao atualizar last_notified_at:", updateError);
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