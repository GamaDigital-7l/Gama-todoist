"use client";

import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { useSession } from "@/integrations/supabase/auth";
import { Moodboard } from "@/types/client";

const moodboardSchema = z.object({
  title: z.string().min(1, "O título do moodboard é obrigatório."),
  description: z.string().optional(),
  thumbnail_url: z.string().url("URL da thumbnail inválida.").optional().or(z.literal("")),
});

export type MoodboardFormValues = z.infer<typeof moodboardSchema>;

interface MoodboardFormProps {
  clientId: string;
  initialData?: Moodboard;
  onMoodboardSaved: () => void;
  onClose: () => void;
}

const MoodboardForm: React.FC<MoodboardFormProps> = ({ clientId, initialData, onMoodboardSaved, onClose }) => {
  const { session } = useSession();
  const userId = session?.user?.id;

  const form = useForm<MoodboardFormValues>({
    resolver: zodResolver(moodboardSchema),
    defaultValues: initialData ? {
      title: initialData.title,
      description: initialData.description || "",
      thumbnail_url: initialData.thumbnail_url || "",
    } : {
      title: "",
      description: "",
      thumbnail_url: "",
    },
  });

  const onSubmit = async (values: MoodboardFormValues) => {
    if (!userId) {
      showError("Usuário não autenticado.");
      return;
    }

    try {
      const dataToSave = {
        title: values.title,
        description: values.description || null,
        thumbnail_url: values.thumbnail_url || null,
        updated_at: new Date().toISOString(),
      };

      if (initialData) {
        const { error } = await supabase
          .from("moodboards")
          .update(dataToSave)
          .eq("id", initialData.id)
          .eq("user_id", userId)
          .eq("client_id", clientId);

        if (error) throw error;
        showSuccess("Moodboard atualizado com sucesso!");
      } else {
        const { error } = await supabase.from("moodboards").insert({
          ...dataToSave,
          user_id: userId,
          client_id: clientId,
        });

        if (error) throw error;
        showSuccess("Moodboard adicionado com sucesso!");
      }
      form.reset();
      onMoodboardSaved();
      onClose();
    } catch (error: any) {
      showError("Erro ao salvar moodboard: " + error.message);
      console.error("Erro ao salvar moodboard:", error);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-4 bg-card">
      <div>
        <Label htmlFor="title" className="text-foreground">Título do Moodboard</Label>
        <Input
          id="title"
          {...form.register("title")}
          placeholder="Ex: Campanha Matrículas 2025"
          className="w-full bg-input border-border text-foreground focus-visible:ring-ring rounded-xl"
        />
        {form.formState.errors.title && (
          <p className="text-red-500 text-sm mt-1">
            {form.formState.errors.title.message}
          </p>
        )}
      </div>
      <div>
        <Label htmlFor="description" className="text-foreground">Descrição (Opcional)</Label>
        <Textarea
          id="description"
          {...form.register("description")}
          placeholder="Detalhes sobre o moodboard..."
          className="w-full bg-input border-border text-foreground focus-visible:ring-ring rounded-xl"
        />
      </div>
      <div>
        <Label htmlFor="thumbnail_url" className="text-foreground">URL da Thumbnail (Opcional)</Label>
        <Input
          id="thumbnail_url"
          {...form.register("thumbnail_url")}
          placeholder="Ex: https://exemplo.com/thumbnail.jpg"
          className="w-full bg-input border-border text-foreground focus-visible:ring-ring rounded-xl"
        />
        {form.formState.errors.thumbnail_url && (
          <p className="text-red-500 text-sm mt-1">
            {form.formState.errors.thumbnail_url.message}
          </p>
        )}
      </div>
      <Button type="submit" className="w-full bg-gradient-primary text-primary-foreground hover:opacity-90 btn-glow">
        {initialData ? "Atualizar Moodboard" : "Adicionar Moodboard"}
      </Button>
    </form>
  );
};

export default MoodboardForm;