import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import Groq from "https://esm.sh/groq-sdk@0.4.0";
import OpenAI from "https://esm.sh/openai@4.52.2";

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
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Obter configurações do usuário
    const { data: settings, error: settingsError } = await supabase
      .from("settings")
      .select("telegram_api_key, telegram_chat_id, groq_api_key, openai_api_key, ai_provider_preference, notification_channel, evolution_api_key, whatsapp_phone_number")
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
    const AI_PROVIDER = settings?.ai_provider_preference || "groq";

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
    if (AI_PROVIDER === "groq" && !settings?.groq_api_key) {
      return new Response(
        JSON.stringify({ error: "Groq API Key not configured." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (AI_PROVIDER === "openai" && !settings?.openai_api_key) {
      return new Response(
        JSON.stringify({ error: "OpenAI API Key not configured." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let aiClient;
    if (AI_PROVIDER === "groq") {
      aiClient = new Groq({ apiKey: settings!.groq_api_key! });
    } else { // AI_PROVIDER === "openai"
      aiClient = new OpenAI({ apiKey: settings!.openai_api_key! });
    }

    const { timeOfDay } = await req.json(); // 'morning' or 'evening'

    // 2. Gerar conteúdo com IA
    const prompt = `Gere um versículo bíblico inspirador, uma sugestão de oração curta baseada no versículo e uma mensagem motivacional de Deus para o dia.
    ${timeOfDay === 'evening' ? 'Inclua também uma sugestão de agradecimento pelo dia.' : ''}
    Formate a resposta em JSON com as chaves: "verse", "prayer_suggestion", "motivational_message", "gratitude_suggestion" (se for noite).`;

    const chatCompletion = await aiClient.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: AI_PROVIDER === "groq" ? "llama3-8b-8192" : "gpt-3.5-turbo", // Escolha o modelo apropriado
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

    // 3. Enviar notificação para o canal preferido
    if (NOTIFICATION_CHANNEL === "telegram") {
      const telegramApiUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
      const response = await fetch(telegramApiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: messageText,
          parse_mode: "Markdown",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Erro ao enviar notificação para o Telegram:", errorData);
        throw new Error(`Telegram API error: ${errorData.description}`);
      }
    } else if (NOTIFICATION_CHANNEL === "whatsapp") {
      // Assumindo um endpoint genérico da Evolution API para envio de texto
      // Você pode precisar ajustar o URL e o corpo da requisição com base na sua documentação específica da Evolution API
      const evolutionApiUrl = `https://api.evolution-api.com/message/sendText/instanceName`; // Substitua 'instanceName' e o domínio se necessário
      const response = await fetch(evolutionApiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": EVOLUTION_API_KEY!, // A Evolution API geralmente usa 'apikey' no header
        },
        body: JSON.stringify({
          number: WHATSAPP_PHONE_NUMBER!,
          options: {
            delay: 1200,
            presence: "composing",
            linkPreview: false
          },
          textMessage: {
            text: messageText.replace(/\*/g, "").replace(/_/g, "") // Remover Markdown para WhatsApp simples
          }
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Erro ao enviar notificação para o WhatsApp (Evolution API):", errorData);
        throw new Error(`Evolution API error: ${errorData.message || JSON.stringify(errorData)}`);
      }
    }

    // 4. Salvar a motivação gerada pela IA na tabela daily_motivations
    const { error: insertMotivationError } = await supabase
      .from("daily_motivations")
      .insert({
        message: aiResponse.motivational_message || "Nenhuma mensagem motivacional.",
        author: "IA",
        verse: aiResponse.verse || null,
        prayer_suggestion: aiResponse.prayer_suggestion || null,
        motivational_message: aiResponse.motivational_message || null,
        gratitude_suggestion: aiResponse.gratitude_suggestion || null,
        created_at: new Date().toISOString(),
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