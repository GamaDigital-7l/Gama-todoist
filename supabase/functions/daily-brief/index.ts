import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import Groq from "https://esm.sh/groq-sdk@0.4.0";
import OpenAI from "https://esm.sh/openai@4.52.2";
import { format, isToday, getDay } from "https://esm.sh/date-fns@2.30.0";

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
      .select("telegram_api_key, telegram_chat_id, groq_api_key, openai_api_key, ai_provider_preference, notification_channel, evolution_api_key, whatsapp_phone_number")
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
    if (NOTIFICATION_CHANNEL === "none") {
      return new Response(
        JSON.stringify({ message: "Nenhum canal de notificação selecionado. Nenhuma notificação enviada." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let aiClient;
    if (AI_PROVIDER === "groq") {
      aiClient = new Groq({ apiKey: settings!.groq_api_key! });
    } else {
      aiClient = new OpenAI({ apiKey: settings!.openai_api_key! });
    }

    // 2. Obter tarefas incompletas para hoje
    const today = format(new Date(), "yyyy-MM-dd");
    const now = new Date();
    const currentDayOfWeek = getDay(now); // 0 = Dom, 1 = Seg, ..., 6 = Sáb

    const { data: tasks, error: tasksError } = await supabase
      .from("tasks")
      .select("title, description, due_date, time, recurrence_type, recurrence_details")
      .eq("user_id", userId)
      .eq("is_completed", false)
      .or(`due_date.eq.${today},recurrence_type.neq.none`);

    if (tasksError) {
      console.error("Erro ao buscar tarefas para o brief:", tasksError);
      throw tasksError;
    }

    const todayTasks = (tasks || []).filter(task => {
      if (task.recurrence_type !== "none") {
        if (task.recurrence_type === "daily_weekday" && (currentDayOfWeek >= 1 && currentDayOfWeek <= 5)) {
          return true;
        }
        if (task.recurrence_type === "weekly" && task.recurrence_details) {
          const dayMap: { [key: string]: number } = {
            "Sunday": 0, "Monday": 1, "Tuesday": 2, "Wednesday": 3,
            "Thursday": 4, "Friday": 5, "Saturday": 6
          };
          if (dayMap[task.recurrence_details] === currentDayOfWeek) {
            return true;
          }
        }
        if (task.recurrence_type === "monthly" && task.recurrence_details) {
          if (parseInt(task.recurrence_details) === now.getDate()) {
            return true;
          }
        }
      } else if (task.due_date) {
        return isToday(new Date(task.due_date));
      }
      return false;
    });

    const taskList = todayTasks.map(task => `- ${task.title}${task.time ? ` às ${task.time}` : ''}`).join("\n");

    // 3. Gerar o brief com IA
    const prompt = `Crie um breve resumo motivacional para a manhã. Inclua:
    - 3 pontos principais para focar hoje (baseado nas tarefas: ${taskList || 'Nenhuma tarefa importante.'}).
    - 1 hábito sagrado para praticar hoje.
    - 1 micro-meta alcançável para o dia.
    - Uma previsão de bloqueios potenciais (ex: "Cuidado com distrações no meio da tarde").
    Formate a resposta em JSON com as chaves: "main_points", "sacred_habit", "micro_goal", "potential_blockages".`;

    const chatCompletion = await aiClient.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: AI_PROVIDER === "groq" ? "llama3-8b-8192" : "gpt-3.5-turbo",
      response_format: { type: "json_object" },
    });

    const aiResponse = JSON.parse(chatCompletion.choices[0].message.content || '{}');

    let briefMessage = `☀️ *Seu Brief da Manhã*\n\n`;
    if (aiResponse.main_points) {
      briefMessage += `🎯 *Foco do Dia:*\n${aiResponse.main_points.map((p: string) => `• ${p}`).join('\n')}\n\n`;
    }
    if (aiResponse.sacred_habit) {
      briefMessage += `🧘‍♀️ *Hábito Sagrado:*\n_${aiResponse.sacred_habit}_\n\n`;
    }
    if (aiResponse.micro_goal) {
      briefMessage += `🚀 *Micro-Meta:*\n_${aiResponse.micro_goal}_\n\n`;
    }
    if (aiResponse.potential_blockages) {
      briefMessage += `🚧 *Atenção:*\n_${aiResponse.potential_blockages}_\n\n`;
    }
    briefMessage += `Tenha um dia produtivo!`;

    // 4. Enviar notificação
    if (NOTIFICATION_CHANNEL === "telegram") {
      const telegramApiUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
      const response = await fetch(telegramApiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: briefMessage,
          parse_mode: "Markdown",
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        console.error("Erro ao enviar brief para o Telegram:", errorData);
        throw new Error(`Telegram API error: ${errorData.description}`);
      }
    } else if (NOTIFICATION_CHANNEL === "whatsapp") {
      const evolutionApiUrl = `https://api.evolution-api.com/message/sendText/instanceName`;
      const response = await fetch(evolutionApiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": EVOLUTION_API_KEY! },
        body: JSON.stringify({
          number: WHATSAPP_PHONE_NUMBER!,
          options: { delay: 1200, presence: "composing", linkPreview: false },
          textMessage: { text: briefMessage.replace(/\*/g, "").replace(/_/g, "") }
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        console.error("Erro ao enviar brief para o WhatsApp (Evolution API):", errorData);
        throw new Error(`Evolution API error: ${errorData.message || JSON.stringify(errorData)}`);
      }
    } else if (NOTIFICATION_CHANNEL === "web_push") {
      const { error: pushError } = await supabase.functions.invoke('send-web-push-notification', {
        body: {
          userId: userId,
          payload: {
            title: "Seu Brief da Manhã",
            body: briefMessage.replace(/\*/g, "").replace(/_/g, ""),
            url: `/dashboard`,
          }
        },
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (pushError) {
        console.error("Erro ao invocar send-web-push-notification para o brief:", pushError);
        throw new Error(`Web Push Function error: ${pushError.message}`);
      }
    }

    return new Response(JSON.stringify({ message: "Brief da manhã enviado com sucesso!" }), {
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