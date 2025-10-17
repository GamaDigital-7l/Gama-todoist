import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import webpush from "https://esm.sh/web-push@3.6.2";
import { format, isSameMinute, parseISO, setHours, setMinutes, isBefore, startOfDay } from "https://esm.sh/date-fns@2.30.0";
import { utcToZonedTime, zonedTimeToUtc } from "https://esm.sh/date-fns-tz@2.0.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SAO_PAULO_TIMEZONE = "America/Sao_Paulo"; // Fallback timezone

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseServiceRole = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Obter a chave privada VAPID dos segredos
    const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY");
    const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY");

    if (!VAPID_PRIVATE_KEY || !VAPID_PUBLIC_KEY) {
      return new Response(
        JSON.stringify({ error: "VAPID keys not configured in Supabase secrets." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    webpush.setVapidDetails(
      'mailto: <gustavogama099@gmail.com>',
      VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY
    );

    const { taskId, userId: bodyUserId } = await req.json(); // Obter userId do corpo

    if (!bodyUserId || !taskId) {
      return new Response(
        JSON.stringify({ error: "Missing userId or taskId." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const userId = bodyUserId;

    // Obter o fuso horário do usuário
    const { data: profile, error: profileError } = await supabaseServiceRole
      .from('profiles')
      .select('timezone')
      .eq('id', userId)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      console.error(`[User ${userId}] Erro ao buscar fuso horário do perfil:`, profileError);
      throw profileError;
    }
    const userTimezone = profile?.timezone || SAO_PAULO_TIMEZONE;

    // Buscar a tarefa específica
    const { data: task, error: fetchTaskError } = await supabaseServiceRole
      .from('tasks')
      .select('id, title, recurrence_time')
      .eq('id', taskId)
      .eq('user_id', userId)
      .single();

    if (fetchTaskError) {
      console.error(`[User ${userId}] Erro ao buscar tarefa ${taskId}:`, fetchTaskError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch task." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!task || !task.recurrence_time) {
      return new Response(
        JSON.stringify({ message: "Task not found or no recurrence time set." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const notificationTitle = `Lembrete de Tarefa Recorrente: ${task.title}`;
    const notificationBody = `Sua tarefa "${task.title}" está agendada para agora. Clique para concluir!`;
    const notificationUrl = `/tasks?complete_task_id=${task.id}`; // URL com parâmetro para ação rápida

    const payload = {
      title: notificationTitle,
      body: notificationBody,
      url: notificationUrl,
      actions: [
        {
          action: `complete-task-${task.id}`,
          title: "Concluir Tarefa",
        },
      ],
    };

    // Buscar todas as inscrições de push para o usuário
    const { data: subscriptions, error: fetchSubsError } = await supabaseServiceRole
      .from('user_subscriptions')
      .select('subscription')
      .eq('user_id', userId);

    if (fetchSubsError) {
      console.error(`[User ${userId}] Erro ao buscar inscrições de usuário:`, fetchSubsError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch user subscriptions." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ message: "No push subscriptions found for this user." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const notificationPromises = subscriptions.map(async (subRecord) => {
      try {
        await webpush.sendNotification(
          subRecord.subscription as webpush.PushSubscription,
          JSON.stringify(payload)
        );
        console.log(`[User ${userId}] Notificação push enviada para a tarefa ${task.id}.`);
      } catch (pushError: any) {
        console.error(`[User ${userId}] Erro ao enviar notificação push para a tarefa ${task.id}:`, pushError);
        if (pushError.statusCode === 410 || pushError.statusCode === 404) {
          console.warn(`[User ${userId}] Inscrição de push inválida/expirada. Removendo...`);
          await supabaseServiceRole.from('user_subscriptions').delete().eq('subscription', subRecord.subscription);
        }
      }
    });
    await Promise.all(notificationPromises);

    return new Response(JSON.stringify({ message: "Recurring task notification sent." }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Erro na Edge Function send-recurring-task-notification:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});