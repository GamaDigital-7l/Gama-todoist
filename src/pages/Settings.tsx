"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BellRing, Sun } from "lucide-react";
import { useSession } from "@/integrations/supabase/auth";
import WebPushToggle from "@/components/WebPushToggle"; // Importar o novo componente

const settingsSchema = z.object({
  groq_api_key: z.string().nullable().optional(),
  openai_api_key: z.string().nullable().optional(),
  ai_provider_preference: z.enum(["groq", "openai"]).default("groq"),
  notification_channel: z.enum(["web_push", "none"]).default("web_push"), // Apenas web_push e none
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

const Settings: React.FC = () => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [isSendingBriefTest, setIsSendingBriefTest] = useState(false);
  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      groq_api_key: "",
      openai_api_key: "",
      ai_provider_preference: "groq",
      notification_channel: "web_push", // Padrão para web_push
    },
  });

  useEffect(() => {
    const fetchSettings = async () => {
      if (!userId) return;

      const { data, error } = await supabase
        .from("settings", { schema: 'public' }) // Especificando o esquema
        .select("*")
        .eq("user_id", userId)
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        showError("Erro ao carregar configurações: " + error.message);
      } else if (data) {
        form.reset(data);
        setSettingsId(data.id);
      }
    };

    fetchSettings();
  }, [form, userId]);

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
          .from("settings", { schema: 'public' }) // Especificando o esquema
          .update(updateData)
          .eq("id", settingsId)
          .eq("user_id", userId);

        if (error) throw error;
        showSuccess("Configurações atualizadas com sucesso!");
      } else {
        const { data, error } = await supabase
          .from("settings", { schema: 'public' }) // Especificando o esquema
          .insert(updateData)
          .select()
          .single();

        if (error) throw error;
        setSettingsId(data.id);
        showSuccess("Configurações salvas com sucesso!");
      }
    } catch (error: any) {
      showError("Erro ao salvar configurações: " + error.message);
      console.error("Erro ao salvar configurações:", error);
    }
  };

  const handleSendTestNotification = async () => {
    if (!userId) {
      showError("Usuário não autenticado. Faça login para enviar notificações de teste.");
      return;
    }
    setIsSendingTest(true);
    try {
      // Invoca a daily-brief com um payload de teste para web push
      const { data, error } = await supabase.functions.invoke('daily-brief', {
        body: { timeOfDay: 'test_notification' }, // Usar um tipo específico para teste
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
        },
      });

      if (error) {
        throw error;
      }
      showSuccess("Notificação de teste enviada com sucesso! Verifique seu navegador/celular.");
      console.log("Resposta da notificação de teste:", data);
    } catch (err: any) {
      showError("Erro ao enviar notificação de teste: " + err.message);
      console.error("Erro ao enviar notificação de teste:", err);
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleSendDailyBriefTest = async () => {
    if (!userId) {
      showError("Usuário não autenticado. Faça login para enviar o brief da manhã.");
      return;
    }
    setIsSendingBriefTest(true);
    try {
      const { data, error } = await supabase.functions.invoke('daily-brief', {
        body: { timeOfDay: 'morning' },
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
        },
      });

      if (error) {
        throw error;
      }
      showSuccess("Brief da manhã enviado com sucesso! Verifique seu navegador/celular.");
      console.log("Resposta do brief da manhã:", data);
    } catch (err: any) {
      showError("Erro ao enviar brief da manhã: " + err.message);
      console.error("Erro ao enviar brief da manhã:", err);
    } finally {
      setIsSendingBriefTest(false);
    }
  };

  const notificationChannel = form.watch("notification_channel");

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6 bg-background text-foreground">
      <h1 className="text-3xl font-bold">Configurações</h1>
      <p className="text-lg text-muted-foreground">
        Gerencie as configurações do seu aplicativo, incluindo chaves de API.
      </p>

      <Card className="w-full max-w-lg bg-card border border-border rounded-lg shadow-sm">
        <CardHeader>
          <CardTitle className="text-foreground">Chaves de API e Preferências de IA</CardTitle>
          <CardDescription className="text-muted-foreground">
            Insira suas chaves de API e escolha seu provedor de IA preferido.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="border-t border-border pt-4 mt-4">
              <h3 className="text-lg font-semibold mb-2 text-foreground">Configurações de Notificação</h3>
              <div>
                <Label htmlFor="notification_channel" className="text-foreground">Canal de Notificação Preferido</Label>
                <Select
                  onValueChange={(value: "web_push" | "none") => // Apenas web_push e none
                    form.setValue("notification_channel", value)
                  }
                  value={notificationChannel}
                >
                  <SelectTrigger id="notification_channel" className="bg-input border-border text-foreground focus-visible:ring-ring">
                    <SelectValue placeholder="Selecionar canal" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover text-popover-foreground border-border rounded-md shadow-lg">
                    <SelectItem value="web_push">Notificação Web Push (Navegador/Celular)</SelectItem>
                    <SelectItem value="none">Nenhum</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {notificationChannel === "web_push" && (
                <div className="mt-4">
                  <WebPushToggle /> {/* Integrar o novo componente aqui */}
                </div>
              )}
              {notificationChannel !== "none" && (
                <div className="flex flex-col gap-2 mt-4">
                  <Button
                    type="button"
                    onClick={handleSendTestNotification}
                    disabled={isSendingTest}
                    className="w-full bg-blue-600 text-white hover:bg-blue-700"
                  >
                    <BellRing className="mr-2 h-4 w-4" />
                    {isSendingTest ? "Enviando Teste..." : "Enviar Notificação de Teste"}
                  </Button>
                  <Button
                    type="button"
                    onClick={handleSendDailyBriefTest}
                    disabled={isSendingBriefTest}
                    className="w-full bg-green-600 text-white hover:bg-green-700"
                  >
                    <Sun className="mr-2 h-4 w-4" />
                    {isSendingBriefTest ? "Enviando Brief..." : "Enviar Brief da Manhã (Teste)"}
                  </Button>
                </div>
              )}
            </div>

            <div className="border-t border-border pt-4 mt-4">
              <h3 className="text-lg font-semibold mb-2 text-foreground">Configurações de IA</h3>
              <div>
                <Label htmlFor="groq_api_key" className="text-foreground">Groq API Key (Grátis)</Label>
                <Input
                  id="groq_api_key"
                  {...form.register("groq_api_key")}
                  placeholder="Sua chave da Groq API"
                  className="bg-input border-border text-foreground focus-visible:ring-ring"
                />
                {form.formState.errors.groq_api_key && (
                  <p className="text-red-500 text-sm mt-1">
                    {form.formState.errors.groq_api_key.message}
                  </p>
                )}
              </div>
              <div className="mt-4">
                <Label htmlFor="openai_api_key" className="text-foreground">OpenAI (ChatGPT) API Key (Pago)</Label>
                <Input
                  id="openai_api_key"
                  {...form.register("openai_api_key")}
                  placeholder="Sua chave da OpenAI API"
                  className="bg-input border-border text-foreground focus-visible:ring-ring"
                />
                {form.formState.errors.openai_api_key && (
                  <p className="text-red-500 text-sm mt-1">
                    {form.formState.errors.openai_api_key.message}
                  </p>
                )}
              </div>
              <div className="mt-4">
                <Label htmlFor="ai_provider_preference" className="text-foreground">Provedor de IA Preferido</Label>
                <Select
                  onValueChange={(value: "groq" | "openai") =>
                    form.setValue("ai_provider_preference", value)
                  }
                  value={form.watch("ai_provider_preference")}
                >
                  <SelectTrigger id="ai_provider_preference" className="bg-input border-border text-foreground focus-visible:ring-ring">
                    <SelectValue placeholder="Selecionar provedor de IA" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover text-popover-foreground border-border rounded-md shadow-lg">
                    <SelectItem value="groq">Groq (Grátis)</SelectItem>
                    <SelectItem value="openai">OpenAI (ChatGPT - Pago)</SelectItem>
                  </SelectContent>
                </Select>
                {form.formState.errors.ai_provider_preference && (
                  <p className="text-red-500 text-sm mt-1">
                    {form.formState.errors.ai_provider_preference.message}
                  </p>
                )}
              </div>
            </div>
            <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90">Salvar Configurações</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Settings;