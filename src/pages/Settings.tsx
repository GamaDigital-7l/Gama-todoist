"use client";

import React, { useEffect, useState } from "react";
import { MadeWithDyad } from "@/components/made-with-dyad";
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
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

const Settings: React.FC = () => {
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      evolution_api_key: "",
      telegram_api_key: "",
    },
  });

  useEffect(() => {
    const fetchSettings = async () => {
      // Por enquanto, como não há autenticação, vamos buscar a primeira configuração disponível.
      // Em um cenário com autenticação, você buscaria as configurações do usuário logado.
      const { data, error } = await supabase
        .from("settings")
        .select("*")
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 means no rows found
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
        // Atualizar configurações existentes
        const { error } = await supabase
          .from("settings")
          .update({
            evolution_api_key: values.evolution_api_key,
            telegram_api_key: values.telegram_api_key,
            updated_at: new Date().toISOString(),
          })
          .eq("id", settingsId);

        if (error) throw error;
        showSuccess("Configurações atualizadas com sucesso!");
      } else {
        // Inserir novas configurações
        const { data, error } = await supabase
          .from("settings")
          .insert({
            evolution_api_key: values.evolution_api_key,
            telegram_api_key: values.telegram_api_key,
            // user_id: auth.uid() // Adicionar user_id aqui quando a autenticação for reativada
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
    <div className="flex flex-1 flex-col gap-4">
      <h1 className="text-3xl font-bold">Configurações</h1>
      <p className="text-lg text-muted-foreground">
        Gerencie as configurações do seu aplicativo, incluindo chaves de API.
      </p>

      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Chaves de API</CardTitle>
          <CardDescription>
            Insira suas chaves de API para integrar com outros serviços.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="evolution_api_key">Evolution API Key</Label>
              <Input
                id="evolution_api_key"
                {...form.register("evolution_api_key")}
                placeholder="Sua chave da Evolution API"
              />
              {form.formState.errors.evolution_api_key && (
                <p className="text-red-500 text-sm mt-1">
                  {form.formState.errors.evolution_api_key.message}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="telegram_api_key">Telegram API Key</Label>
              <Input
                id="telegram_api_key"
                {...form.register("telegram_api_key")}
                placeholder="Sua chave da Telegram API"
              />
              {form.formState.errors.telegram_api_key && (
                <p className="text-red-500 text-sm mt-1">
                  {form.formState.errors.telegram_api_key.message}
                </p>
              )}
            </div>
            <Button type="submit">Salvar Configurações</Button>
          </form>
        </CardContent>
      </Card>

      <div className="flex-1 flex items-end justify-center">
        <MadeWithDyad />
      </div>
    </div>
  );
};

export default Settings;