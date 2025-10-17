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

const settingsSchema = z.object({
  groq_api_key: z.string().nullable().optional(),
  openai_api_key: z.string().nullable().optional(),
  ai_provider_preference: z.enum(["groq", "openai"]).default("groq"),
  notification_channel: z.enum(["web_push", "none"]).default("web_push"),
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

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      groq_api_key: "",
      openai_api_key: "",
      ai_provider_preference: "groq",
      notification_channel: "web_push",
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

    // Fetch user profile to check Google connection status and email
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("google_access_token, email")
      .eq("id", userId) // Ensure we query by the user's auth ID
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      // console.error("Erro ao verificar status do Google Calendar ou e-mail do perfil:", profileError); // Removido console.error
    } else if (profileData) {
      setIsGoogleConnected(!!profileData.google_access_token);
      // No need to update form.setValue for email here, as it's handled by ProfileManagementCard
    } else {
      setIsGoogleConnected(false);
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
      const updateData = {
        groq_api_key: values.groq_api_key || null,
        openai_api_key: values.openai_api_key || null,
        ai_provider_preference: values.ai_provider_preference,
        notification_channel: values.notification_channel,
        updated_at: new Date().toISOString(),
        user_id: userId,
      };

      if (settingsId) {
        const { error } = await supabase
          .from("settings")
          .update(updateData)
          .eq("id", settingsId)
          .eq("user_id", userId);

        if (error) throw error;
        showSuccess("Configurações atualizadas com sucesso!");
      } else {
        const { data, error } = await supabase
          .from("settings")
          .insert(updateData)
          .select()
          .single();

        if (error) throw error;
        setSettingsId(data.id);
        showSuccess("Configurações salvas com sucesso!");
      }
    } catch (error: any) {
      showError("Erro ao salvar configurações: " + error.message);
      // console.error("Erro ao salvar configurações:", error); // Removido console.error
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6 bg-background text-foreground">
      <h1 className="text-3xl font-extrabold">Configurações</h1>
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

      <IntegrationsCard
        userId={userId}
        session={session}
        isGoogleConnected={isGoogleConnected}
        setIsGoogleConnected={setIsGoogleConnected}
        isConnectingGoogle={isConnectingGoogle}
        setIsConnectingGoogle={setIsConnectingGoogle}
        onGoogleAuthComplete={fetchSettingsAndGoogleStatus} // Re-fetch all settings and status after Google auth
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
    </div>
  );
};

export default Settings;