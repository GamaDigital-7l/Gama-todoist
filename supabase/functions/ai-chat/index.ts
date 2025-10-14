import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import Groq from "https://esm.sh/groq-sdk@0.4.0";
import OpenAI from "https://esm.sh/openai@4.52.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Obter configurações do usuário para chaves de API de IA
    const { data: settings, error: settingsError } = await supabase
      .from("settings")
      .select("groq_api_key, openai_api_key, ai_provider_preference")
      .limit(1)
      .single();

    if (settingsError) {
      console.error("Erro ao buscar configurações de IA:", settingsError);
      return new Response(
        JSON.stringify({ error: "AI settings not configured." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const AI_PROVIDER = settings?.ai_provider_preference || "groq";
    let aiClient;

    if (AI_PROVIDER === "groq") {
      if (!settings?.groq_api_key) {
        return new Response(
          JSON.stringify({ error: "Groq API Key not configured." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      aiClient = new Groq({ apiKey: settings.groq_api_key });
    } else if (AI_PROVIDER === "openai") {
      if (!settings?.openai_api_key) {
        return new Response(
          JSON.stringify({ error: "OpenAI API Key not configured." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      aiClient = new OpenAI({ apiKey: settings.openai_api_key });
    } else {
      return new Response(
        JSON.stringify({ error: "Invalid AI provider preference." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { messages } = await req.json(); // Array de mensagens no formato { role: "user" | "assistant", content: string }

    // Check if the prompt is for task suggestions (heuristic: check for specific keywords or structure)
    const isTaskSuggestionPrompt = messages.some((msg: any) =>
      typeof msg.content === 'string' && msg.content.includes("sugira uma descrição mais detalhada") && msg.content.includes("tipo de recorrência")
    );

    let modelToUse = AI_PROVIDER === "groq" ? "llama3-8b-8192" : "gpt-3.5-turbo";
    let responseFormat: { type: "json_object" } | undefined = undefined;

    if (isTaskSuggestionPrompt) {
      // For task suggestions, we want JSON output
      responseFormat = { type: "json_object" };
      // Adjust the prompt to reflect the new recurrence types for AI
      messages[0].content = messages[0].content.replace(
        /tipo de recorrência \(none, daily_weekday, weekly, monthly\)/,
        "tipo de recorrência (none, daily, weekly, monthly)"
      );
      messages[0].content = messages[0].content.replace(
        /ex: 'Monday' para semanal, '15' para mensal, caso contrário null/,
        "ex: 'Monday,Wednesday' para semanal, '15' para mensal, caso contrário null"
      );
    }

    const chatCompletion = await aiClient.chat.completions.create({
      messages: messages,
      model: modelToUse,
      response_format: responseFormat, // Apply response_format conditionally
    });

    return new Response(JSON.stringify({ response: chatCompletion.choices[0].message.content }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Erro na Edge Function ai-chat:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});