import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import Groq from "https://esm.sh/groq-sdk@0.4.0";
import OpenAI from "https://esm.sh/openai@4.52.2";
import { format, utcToZonedTime } from "https://esm.sh/date-fns-tz@2.0.1"; // Importar date-fns-tz
import webpush from "https://esm.sh/web-push@3.6.2";

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

    // Autenticação do usuário
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

    // 1. Obter configurações do usuário
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
    const AI_PROVIDER = settings?.ai_provider_preference || "groq";

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

    let aiClient;
    if (AI_PROVIDER === "groq") {
      if (!settings?.groq_api_key) {
        return new Response(
          JSON.stringify({ error: "Groq API Key not configured." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      aiClient = new Groq({ apiKey: settings.groq_api_key });
    } else { // AI_PROVIDER === "openai"
      if (!settings?.openai_api_key) {
        return new Response(
          JSON.stringify({ error: "OpenAI API Key not configured." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      aiClient = new OpenAI({ apiKey: settings.openai_api_key });
    }

    const { timeOfDay } = await req.json(); // 'morning' or 'evening'

    // 2. Gerar conteúdo com IA
    const prompt = `Gere um versículo bíblico inspirador, uma sugestão de oração curta baseada no versículo e uma mensagem motivacional de Deus para o dia.
    ${timeOfDay === 'evening' ? 'Inclua também uma sugestão de agradecimento pelo dia.' : ''}
    Formate a resposta em JSON com as chaves: "verse", "prayer_suggestion", "motivational_message", "gratitude_suggestion" (se for noite).`;

    const chatCompletion = await aiClient.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: AI_PROVIDER === "groq" ? "llama3-8b-8192" : "gpt-3.5-turbo",
      response_format: { type: "json_object" },
    });

    const aiResponse = JSON.parse(chatCompletion.choices[0].message.content || '{}');

    let messageText = `🙏 *Sua Dose Diária de Fé e Motivação (${timeOfDay === 'morning' ? 'Manhã' : 'Noite'})*\n\n`;
    if (aiResponse.verse) {
      messageText += `📖 *Versículo do Dia:*\n_${aiResponse.verse}_\n\n`;
    }
    if (aiResponse.prayer_suggestion) {
      messageText += `🛐 *Sugestão de Oração:*\n_${aiResponse.prayer_suggestion}_\n\n`;
    }
    if (aiResponse.motivational_message) {
      messageText += `✨ *Mensagem Motivacional:*\n_${aiResponse.motivational_message}_\n\n`;
    }
    if (timeOfDay === 'evening' && aiResponse.gratitude_suggestion) {
      messageText += `💖 *Sugestão de Agradecimento:*\n_${aiResponse.gratitude_suggestion}_\n\n`;
    }

    // 3. Enviar notificação Web Push
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
            title: `Motivação da ${timeOfDay === 'morning' ? 'Manhã' : 'Noite'}`,
            body: messageText.replace(/\*/g, "").replace(/_/g, ""), // Remover Markdown para o corpo da notificação
            url: `/motivation`,
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

    // 4. Salvar a motivação gerada pela IA na tabela daily_motivations
    const nowUtc = new Date();
    const nowSaoPaulo = utcToZonedTime(nowUtc, SAO_PAULO_TIMEZONE);
    const { error: insertMotivationError } = await supabase
      .from("daily_motivations")
      .insert({
        message: aiResponse.motivational_message || "Nenhuma mensagem motivacional.",
        author: "IA",
        verse: aiResponse.verse || null,
        prayer_suggestion: aiResponse.prayer_suggestion || null,
        motivational_message: aiResponse.motivational_message || null,
        gratitude_suggestion: aiResponse.gratitude_suggestion || null,
        created_at: nowSaoPaulo.toISOString(), // Salvar com o fuso horário de São Paulo
      });

    if (insertMotivationError) {
      console.error("Erro ao salvar motivação na tabela:", insertMotivationError);
    }

    return new Response(JSON.stringify({ message: "Motivação e oração enviadas e salvas com sucesso!" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Erro na Edge Function daily-prayer-motivation:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});