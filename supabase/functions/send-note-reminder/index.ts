import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import webpush from "https://esm.sh/web-push@3.6.2";
import { format, parseISO, isSameDay, isBefore, setHours, setMinutes } from "https://esm.sh/date-fns@2.30.0";
import { utcToZonedTime } from "https://esm.sh/date-fns-tz@2.0.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SAO_PAULO_TIMEZONE = "America/Sao_Paulo";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
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

    const { noteId, userId } = await req.json();

    if (!noteId || !userId) {
      return new Response(
        JSON.stringify({ error: "Missing noteId or userId." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Buscar a nota específica
    const { data: note, error: fetchNoteError } = await supabase
      .from('notes')
      .select('title, content, reminder_date, reminder_time, type')
      .eq('id', noteId)
      .eq('user_id', userId)
      .single();

    if (fetchNoteError) {
      console.error("Erro ao buscar nota:", fetchNoteError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch note." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!note || !note.reminder_date || !note.reminder_time) {
      return new Response(
        JSON.stringify({ message: "Note not found or no reminder set." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Construir o corpo da notificação
    let notificationBody = "";
    if (note.type === "checklist" && Array.isArray(note.content)) {
      const completedItems = note.content.filter(item => item.completed).length;
      const totalItems = note.content.length;
      notificationBody = `Checklist: ${completedItems}/${totalItems} itens concluídos.`;
    } else {
      notificationBody = String(note.content).substring(0, 100) + (String(note.content).length > 100 ? '...' : '');
    }

    const payload = {
      title: `Lembrete: ${note.title || 'Sua Nota'}`,
      body: notificationBody,
      url: `/notes`, // Redirecionar para a página de notas
    };

    // Buscar todas as inscrições de push para o usuário
    const { data: subscriptions, error: fetchError } = await supabase
      .from('user_subscriptions')
      .select('subscription')
      .eq('user_id', userId);

    if (fetchError) {
      console.error("Erro ao buscar inscrições de usuário:", fetchError);
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
        console.log(`Notificação push de lembrete enviada para o usuário ${userId} para a nota ${noteId}.`);
      } catch (pushError: any) {
        console.error(`Erro ao enviar notificação push para ${userId} (nota ${noteId}):`, pushError);
        // Se a inscrição for inválida ou expirar, podemos removê-la do banco de dados
        if (pushError.statusCode === 410 || pushError.statusCode === 404) { // Gone or Not Found
          console.warn(`Inscrição de push inválida/expirada para o usuário ${userId}. Removendo...`);
          await supabase.from('user_subscriptions').delete().eq('subscription', subRecord.subscription);
        }
      }
    });

    await Promise.all(notificationPromises);

    return new Response(JSON.stringify({ message: "Notificação de lembrete processada." }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Erro na Edge Function send-note-reminder:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});