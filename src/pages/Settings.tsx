"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { useSession } from "@/integrations/supabase/auth";
import ProfileManagementCard from "@/components/settings/ProfileManagementCard";
import IntegrationsCard from "@/components/settings/IntegrationsCard";
import NotificationSettingsCard from "@/components/settings/NotificationSettingsCard";
import AISettingsCard from "@/components/settings/AISettingsCard";
import TelegramSettingsCard from "@/components/settings/TelegramSettingsCard"; // Importar o novo componente
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button"; // Importar Button

// Lista de fusos horários comuns (pode ser expandida)
const TIMEZONES = [
  { value: "America/Sao_Paulo", label: "America/Sao_Paulo (GMT-3)" },
  { value: "America/New_York", label: "America/New_York (GMT-4)" },
  { value: "America/Los_Angeles", label: "America/Los_Angeles (GMT-7)" },
  { value: "Europe/London", label: "Europe/London (GMT+1)" },
  { value: "Europe/Berlin", label: "Europe/Berlin (GMT+2)" },
  { value: "Asia/Tokyo", label: "Asia/Tokyo (GMT+9)" },
  { value: "Australia/Sydney", label: "Australia/Sydney (GMT+10)" },
  // Adicione mais fusos horários conforme necessário
];

const settingsSchema = z.object({
  groq_api_key: z.string().nullable().optional(),
  openai_api_key: z.string().nullable().optional(),
  ai_provider_preference: z.enum(["groq", "openai"]).optional().default("groq"),
  notification_channel: z.enum(["web_push", "none"]).optional().default("web_push"),
  telegram_bot_token: z.string().nullable().optional(),
  telegram_chat_id: z.string().nullable().optional(),
  telegram_enabled: z.boolean().optional().default(false),
  daily_brief_morning_time: z.string().optional().default("08:00"),
  daily_brief_evening_time: z.string().optional().default("18:00"),
  weekly_brief_day: z.string().optional().default("Sunday"),
  weekly_brief_time: z.string().optional().default("08:00"),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

const Settings: React.FC = () => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const userEmail = session?.user?.email;

  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);
  const [isUpdatingProfileEmail, setIsUpdatingProfileEmail] = useState(false);
  const [userTimezone, setUserTimezone] = useState<string | null>(null); // Estado para o fuso horário

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      groq_api_key: "",
      openai_api_key: "",
      ai_provider_preference: "groq",
      notification_channel: "web_push",
      telegram_bot_token: "", // Default vazio
      telegram_chat_id: "", // Default vazio
      telegram_enabled: false, // Default false
      daily_brief_morning_time: "08:00",
      daily_brief_evening_time: "18:00",
      weekly_brief_day: "Sunday",
      weekly_brief_time: "08:00",
    },
  });

  const fetchSettingsAndGoogleStatus = useCallback(async () => {
    if (!userId) return;

    // Fetch user settings
    const { data: settingsData, error: settingsError } = await supabase
      .from("settings")
      .select("*")
      .eq("user_id", userId)
      .limit(1)
      .single();

    if (settingsError && settingsError.code !== 'PGRST116') {
      showError("Erro ao carregar configurações: " + settingsError.message);
    } else if (settingsData) {
      form.reset(settingsData);
      setSettingsId(settingsData.id);
    }

    // Fetch user profile to check Google connection status, email, and timezone
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("google_access_token, email, timezone")
      .eq("id", userId) // Ensure we query by the user's auth ID
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      // console.error("Erro ao verificar status do Google Calendar ou e-mail do perfil:", profileError); // Removido console.error
    } else if (profileData) {
      setIsGoogleConnected(!!profileData.google_access_token);
      setUserTimezone(profileData.timezone);
    } else {
      setIsGoogleConnected(false);
      setUserTimezone(null);
    }
  }, [userId, form]);

  useEffect(() => {
    fetchSettingsAndGoogleStatus();
  }, [fetchSettingsAndGoogleStatus]);

  const onSubmit = async (values: SettingsFormValues) => {
    if (!userId) {
      showError("Usuário não autenticado.");
      return;
    }

    try {
      const updateSettingsData = {
        groq_api_key: values.groq_api_key || null,
        openai_api_key: values.openai_api_key || null,
        ai_provider_preference: values.ai_provider_preference,
        notification_channel: values.notification_channel,
        telegram_bot_token: values.telegram_bot_token || null, // Novo
        telegram_chat_id: values.telegram_chat_id || null, // Novo
        telegram_enabled: values.telegram_enabled, // Novo
        daily_brief_morning_time: values.daily_brief_morning_time, // Novo
        daily_brief_evening_time: values.daily_brief_evening_time, // Novo
        weekly_brief_day: values.weekly_brief_day, // Novo
        weekly_brief_time: values.weekly_brief_time, // Novo
        updated_at: new Date().toISOString(),
        user_id: userId,
      };

      if (settingsId) {
        const { error } = await supabase
          .from("settings")
          .update(updateSettingsData)
          .eq("id", settingsId)
          .eq("user_id", userId);

        if (error) throw error;
        showSuccess("Configurações atualizadas com sucesso!");
      } else {
        const { data, error } = await supabase
          .from("settings")
          .insert(updateSettingsData)
          .select()
          .single();

        if (error) throw error;
        setSettingsId(data.id);
        showSuccess("Configurações salvas com sucesso!");
      }

      // Atualizar o fuso horário no perfil
      const { error: profileUpdateError } = await supabase
        .from("profiles")
        .update({ timezone: userTimezone, updated_at: new Date().toISOString() })
        .eq("id", userId);

      if (profileUpdateError) throw profileUpdateError;
      showSuccess("Fuso horário atualizado com sucesso!");

    } catch (error: any) {
      showError("Erro ao salvar configurações: " + error.message);
      // console.error("Erro ao salvar configurações:", error); // Removido console.error
    }
  };

  const handleTimezoneChange = async (newTimezone: string) => {
    if (!userId) {
      showError("Usuário não autenticado.");
      return;
    }
    setUserTimezone(newTimezone);
    // O fuso horário será salvo junto com as outras configurações no onSubmit
  };

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6 bg-background text-foreground">
      <h1 className="text-3xl font-bold">Configurações</h1>
      <p className="text-lg text-muted-foreground">
        Gerencie as configurações do seu aplicativo, incluindo chaves de API.
      </p>

      <ProfileManagementCard
        userId={userId}
        userEmail={userEmail}
        isUpdatingProfileEmail={isUpdatingProfileEmail}
        setIsUpdatingProfileEmail={setIsUpdatingProfileEmail}
        onProfileEmailSynced={fetchSettingsAndGoogleStatus} // Re-fetch all settings and status after email sync
      />

      <Card className="w-full max-w-lg bg-card border border-border rounded-lg shadow-sm">
        <CardHeader>
          <CardTitle className="text-foreground">Fuso Horário</CardTitle>
          <CardDescription className="text-muted-foreground">
            Selecione seu fuso horário para notificações e agendamentos precisos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="timezone" className="text-foreground">Seu Fuso Horário</Label>
              <Select
                onValueChange={handleTimezoneChange}
                value={userTimezone || ""}
              >
                <SelectTrigger id="timezone" className="w-full bg-input border-border text-foreground focus-visible:ring-ring">
                  <SelectValue placeholder="Selecionar fuso horário" />
                </SelectTrigger>
                <SelectContent className="bg-popover text-popover-foreground border-border rounded-md shadow-lg">
                  {TIMEZONES.map(tz => (
                    <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <IntegrationsCard
        userId={userId}
        session={session}
        isGoogleConnected={isGoogleConnected}
        setIsGoogleConnected={setIsGoogleConnected}
        isConnectingGoogle={isConnectingGoogle}
        setIsConnectingGoogle={setIsConnectingGoogle}
        onGoogleAuthComplete={fetchSettingsAndGoogleStatus} // Re-fetch all settings and status after Google auth
      />

      <TelegramSettingsCard
        userId={userId}
        session={session}
        form={form}
      />

      <NotificationSettingsCard
        userId={userId}
        session={session}
        form={form}
      />

      <AISettingsCard
        form={form}
        onSubmit={onSubmit}
      />

      <Button type="submit" onClick={form.handleSubmit(onSubmit)} className="w-full max-w-lg bg-primary text-primary-foreground hover:bg-primary/90 self-center mt-6">
        Salvar Todas as Configurações
      </Button>
    </div>
  );
};

export default Settings;