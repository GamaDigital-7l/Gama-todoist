"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link as LinkIcon, Unlink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { useSearchParams } from "react-router-dom";
import { Session } from "@supabase/supabase-js";

interface IntegrationsCardProps {
  userId: string | undefined;
  session: Session | null;
  isGoogleConnected: boolean;
  setIsGoogleConnected: React.Dispatch<React.SetStateAction<boolean>>;
  isConnectingGoogle: boolean;
  setIsConnectingGoogle: React.Dispatch<React.SetStateAction<boolean>>;
  onGoogleAuthComplete: () => void;
}

const IntegrationsCard: React.FC<IntegrationsCardProps> = ({
  userId,
  session,
  isGoogleConnected,
  setIsGoogleConnected,
  isConnectingGoogle,
  setIsConnectingGoogle,
  onGoogleAuthComplete,
}) => {
  const [searchParams, setSearchParams] = useSearchParams();

  React.useEffect(() => {
    const googleAuthSuccess = searchParams.get("google_auth_success");
    if (googleAuthSuccess === "true") {
      showSuccess("Google Calendar conectado com sucesso!");
      setSearchParams({}, { replace: true });
      onGoogleAuthComplete();
    } else if (searchParams.get("google_auth_error")) {
      showError("Erro ao conectar Google Calendar. Tente novamente.");
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, onGoogleAuthComplete]);

  const handleConnectGoogleCalendar = () => {
    if (!userId) {
      showError("Usuário não autenticado. Faça login para conectar o Google Calendar.");
      return;
    }
    setIsConnectingGoogle(true);
    const googleOAuthInitUrl = `https://qbhwjmwyrkfyxajaksfk.supabase.co/functions/v1/google-oauth/init`;
    window.location.href = googleOAuthInitUrl;
  };

  const handleDisconnectGoogleCalendar = async () => {
    if (!userId) {
      showError("Usuário não autenticado.");
      return;
    }
    if (!window.confirm("Tem certeza que deseja desconectar o Google Calendar?")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          google_access_token: null,
          google_refresh_token: null,
          google_token_expiry: null,
          google_calendar_id: null,
        })
        .eq("id", userId);

      if (error) throw error;
      showSuccess("Google Calendar desconectado com sucesso!");
      setIsGoogleConnected(false);
    } catch (err: any) {
      showError("Erro ao desconectar Google Calendar: " + err.message);
      console.error("Erro ao desconectar Google Calendar:", err);
    }
  };

  return (
    <Card className="w-full max-w-lg bg-card border border-border rounded-lg shadow-sm">
      <CardHeader>
        <CardTitle className="text-foreground">Integrações</CardTitle>
        <CardDescription className="text-muted-foreground">
          Conecte serviços externos para expandir as funcionalidades do Nexus Flow.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="border-b border-border pb-4">
            <h3 className="text-lg font-semibold mb-2 text-foreground">Google Calendar</h3>
            {isGoogleConnected ? (
              <Button
                type="button"
                onClick={handleDisconnectGoogleCalendar}
                variant="destructive"
                className="w-full"
              >
                <Unlink className="mr-2 h-4 w-4" />
                Desconectar Google Calendar
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleConnectGoogleCalendar}
                disabled={isConnectingGoogle}
                className="w-full bg-blue-500 text-white hover:bg-blue-600"
              >
                <LinkIcon className="mr-2 h-4 w-4" />
                {isConnectingGoogle ? "Conectando..." : "Conectar Google Calendar"}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default IntegrationsCard;