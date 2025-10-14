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

const settingsSchema = z.object({
  evolution_api_key: z.string().optional(),
  telegram_api_key: z.string().optional(),
  telegram_chat_id: z.string().optional(),
  groq_api_key: z.string().optional(),
  openai_api_key: z.string().optional(),
  ai_provider_preference: z.enum(["groq", "openai"]).default("groq"),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

const Settings: React.FC = () => {
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      evolution_api_key: "",
      telegram_api_key: "",
      telegram_chat_id: "",
      groq_api_key: "",
      openai_api_key: "",
      ai_provider_preference: "groq",
    },
  });

  useEffect(() => {
    const fetchSettings = async () => {
      const { data, error } = await supabase
        .from("settings")
        .select("*")
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
  }, [form]);

  const onSubmit = async (values: SettingsFormValues) => {
    try {
      const updateData = {
        evolution_api_key: values.evolution_api_key || null,
        telegram_api_key: values.telegram_api_key || null,
        telegram_chat_id: values.telegram_chat_id || null,
        groq_api_key: values.groq_api_key || null,
        openai_api_key: values.openai_api_key || null,
        ai_provider_preference: values.ai_provider_preference,
        updated_at: new Date().toISOString(),
      };

      if (settingsId) {
        const { error } = await supabase
          .from("settings")
          .update(updateData)
          .eq("id", settingsId);

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
      console.error("Erro ao salvar configurações:", error);
    }
  };

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
            <div>
              <Label htmlFor="evolution_api_key" className="text-foreground">Evolution API Key</Label>
              <Input
                id="evolution_api_key"
                {...form.register("evolution_api_key")}
                placeholder="Sua chave da Evolution API"
                className="bg-input border-border text-foreground focus-visible:ring-ring"
              />
              {form.formState.errors.evolution_api_key && (
                <p className="text-red-500 text-sm mt-1">
                  {form.formState.errors.evolution_api_key.message}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="telegram_api_key" className="text-foreground">Telegram API Key</Label>
              <Input
                id="telegram_api_key"
                {...form.register("telegram_api_key")}
                placeholder="Sua chave da Telegram API"
                className="bg-input border-border text-foreground focus-visible:ring-ring"
              />
              {form.formState.errors.telegram_api_key && (
                <p className="text-red-500 text-sm mt-1">
                  {form.formState.errors.telegram_api_key.message}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="telegram_chat_id" className="text-foreground">Telegram Chat ID</Label>
              <Input
                id="telegram_chat_id"
                {...form.register("telegram_chat_id")}
                placeholder="Seu ID de Chat do Telegram"
                className="bg-input border-border text-foreground focus-visible:ring-ring"
              />
              {form.formState.errors.telegram_chat_id && (
                <p className="text-red-500 text-sm mt-1">
                  {form.formState.errors.telegram_chat_id.message}
                </p>
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