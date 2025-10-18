import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { addMinutes } from "https://esm.sh/date-fns@3.6.0"; // Importar addMinutes (versão atualizada)

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

    const url = new URL(req.url);
    const path = url.pathname;

    const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
    const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");
    const GOOGLE_REDIRECT_URI = Deno.env.get("GOOGLE_REDIRECT_URI"); // Deve ser a URL desta Edge Function

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
      return new Response(
        JSON.stringify({ error: "Google OAuth environment variables are not set." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 1. Iniciar o fluxo OAuth (redirecionar para o Google)
    if (path.endsWith("/init")) {
      const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      authUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID);
      authUrl.searchParams.set("redirect_uri", GOOGLE_REDIRECT_URI);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("scope", "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly profile email");
      authUrl.searchParams.set("access_type", "offline"); // Para obter o refresh token
      authUrl.searchParams.set("prompt", "consent"); // Para garantir que o usuário sempre veja a tela de consentimento

      return new Response(null, {
        status: 302,
        headers: {
          Location: authUrl.toString(),
          ...corsHeaders,
        },
      });
    }

    // 2. Callback do Google (receber o código e trocar por tokens)
    if (path.endsWith("/callback")) {
      const code = url.searchParams.get("code");
      // const state = url.searchParams.get("state"); // Opcional, para segurança CSRF

      if (!code) {
        return new Response(
          JSON.stringify({ error: "Authorization code not found." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Trocar o código por tokens
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          code: code,
          redirect_uri: GOOGLE_REDIRECT_URI,
          grant_type: "authorization_code",
        }).toString(),
      });

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json();
        console.error("Erro ao trocar código por tokens:", errorData);
        return new Response(
          JSON.stringify({ error: "Failed to exchange code for tokens.", details: errorData }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const tokens = await tokenResponse.json();
      const accessToken = tokens.access_token;
      const refreshToken = tokens.refresh_token; // Importante para manter o acesso
      const expiresIn = tokens.expires_in; // Tempo de expiração em segundos

      // Obter informações do usuário para associar os tokens
      const userinfoResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!userinfoResponse.ok) {
        const errorData = await userinfoResponse.json();
        console.error("Erro ao buscar userinfo:", errorData);
        return new Response(
          JSON.stringify({ error: "Failed to fetch user info.", details: errorData }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const userInfo = await userinfoResponse.json();
      // const googleUserId = userInfo.sub; // ID único do usuário Google

      // Encontrar o user_id do Supabase associado ao email do Google
      const { data: supabaseProfile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', userInfo.email)
        .single();

      let userIdToUpdate = null;
      if (profileError && profileError.code !== 'PGRST116') { // PGRST116 = no rows found
        console.error("Erro ao buscar perfil do Supabase por email:", profileError);
        throw profileError;
      } else if (supabaseProfile) {
        userIdToUpdate = supabaseProfile.id; // O 'id' da tabela profiles é o user_id do Supabase
      } else {
        // Se não encontrar um perfil existente, o usuário precisa estar logado no Nexus Flow
        // com o mesmo email antes de tentar conectar o Google Calendar.
        return new Response(
          JSON.stringify({ error: "Could not link Google account. Please ensure you are logged in to Nexus Flow with the same email." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Calcular a data de expiração
      const expiryDate = addMinutes(new Date(), expiresIn / 60); // expiresIn is in seconds

      // Buscar a lista de calendários do usuário para obter o ID do calendário principal
      let primaryCalendarId = null;
      try {
        const calendarListResponse = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList", {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        });

        if (calendarListResponse.ok) {
          const calendarListData = await calendarListResponse.json();
          const primaryCalendar = calendarListData.items.find((cal: any) => cal.primary);
          primaryCalendarId = primaryCalendar ? primaryCalendar.id : calendarListData.items[0]?.id; // Pega o primeiro se não houver primário
        } else {
          console.warn("Não foi possível buscar a lista de calendários do Google. Continuar sem calendar_id.");
        }
      } catch (calendarError) {
        console.error("Erro ao buscar lista de calendários do Google:", calendarError);
      }

      // Armazenar os tokens e o ID do calendário no banco de dados do Supabase
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          google_access_token: accessToken,
          google_refresh_token: refreshToken,
          google_token_expiry: expiryDate.toISOString(),
          google_calendar_id: primaryCalendarId, // Salvar o ID do calendário principal
        })
        .eq("id", userIdToUpdate); // Usar o ID do perfil encontrado

      if (updateError) {
        console.error("Erro ao salvar tokens e calendar_id no Supabase:", updateError);
        return new Response(
          JSON.stringify({ error: "Failed to save Google tokens and calendar ID.", details: updateError }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Redirecionar de volta para o aplicativo (ex: página de configurações)
      return new Response(null, {
        status: 302,
        headers: {
          Location: `${Deno.env.get("APP_BASE_URL")}/settings?google_auth_success=true`,
          ...corsHeaders,
        },
      });
    }

    return new Response(
      JSON.stringify({ error: "Invalid Google OAuth endpoint." }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );

  } catch (error) {
    console.error("Erro na Edge Function google-oauth:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});