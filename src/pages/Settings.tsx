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

const settingsSchema = z.object({
  evolution_api_key: z.string().optional(),
  telegram_api_key: z.string().optional(),
  telegram_chat_id: z.string().optional(),
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
      if (settingsId) {
        const { error } = await supabase
          .from("settings")
          .update({
            evolution_api_key: values.evolution_api_key,
            telegram_api_key: values.telegram_api_key,
            telegram_chat_id: values.telegram_chat_id,
            updated_at: new Date().toISOString(),
          })
          .eq("id", settingsId);

        if (error) throw error;
        showSuccess("Configurações atualizadas com sucesso!");
      } else {
        const { data, error } = await supabase
          .from("settings")
          .insert({
            evolution_api_key: values.evolution_api_key,
            telegram_api_key: values.telegram_api_key,
            telegram_chat_id: values.telegram_chat_id,
          })
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
          <CardTitle className="text-foreground">Chaves de API</CardTitle>
          <CardDescription className="text-muted-foreground">
            Insira suas chaves de API para integrar com outros serviços.
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
            <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90">Salvar Configurações</Button>
          </form>
        </CardContent>
      </Card>

      {/* MadeWithDyad removido */}
    </div>
  );
};

export default Settings;