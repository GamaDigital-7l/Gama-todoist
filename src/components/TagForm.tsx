"use client";

import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { useSession } from "@/integrations/supabase/auth";

const tagSchema = z.object({
  name: z.string().min(1, "O nome da tag é obrigatório."),
  color: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Cor inválida. Use formato hexadecimal (ex: #RRGGBB).").default("#000000"),
});

export type TagFormValues = z.infer<typeof tagSchema>;

interface TagFormProps {
  initialData?: TagFormValues & { id: string };
  onTagSaved: () => void;
  onClose: () => void;
}

const TagForm: React.FC<TagFormProps> = ({ initialData, onTagSaved, onClose }) => {
  const { session } = useSession();
  const userId = session?.user?.id;

  const form = useForm<TagFormValues>({
    resolver: zodResolver(tagSchema),
    defaultValues: initialData || {
      name: "",
      color: "#000000",
    },
  });

  const onSubmit = async (values: TagFormValues) => {
    if (!userId) {
      showError("Usuário não autenticado.");
      return;
    }

    try {
      if (initialData) {
        const { error } = await supabase
          .from("tags")
          .update({
            name: values.name,
            color: values.color,
            updated_at: new Date().toISOString(),
          })
          .eq("id", initialData.id)
          .eq("user_id", userId);

        if (error) throw error;
        showSuccess("Tag atualizada com sucesso!");
      } else {
        const { error } = await supabase.from("tags").insert({
          name: values.name,
          color: values.color,
          user_id: userId,
        });

        if (error) throw error;
        showSuccess("Tag adicionada com sucesso!");
      }
      form.reset();
      onTagSaved();
      onClose();
    } catch (error: any) {
      showError("Erro ao salvar tag: " + error.message);
      console.error("Erro ao salvar tag:", error);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-4 bg-card">
      <div>
        <Label htmlFor="name" className="text-foreground">Nome da Tag</Label>
        <Input
          id="name"
          {...form.register("name")}
          placeholder="Ex: Trabalho, Pessoal, Urgente"
          className="bg-input border-border text-foreground focus-visible:ring-ring"
        />
        {form.formState.errors.name && (
          <p className="text-red-500 text-sm mt-1">
            {form.formState.errors.name.message}
          </p>
        )}
      </div>
      <div>
        <Label htmlFor="color" className="text-foreground">Cor da Tag</Label>
        <div className="flex items-center gap-2">
          <Input
            id="color"
            type="color"
            {...form.register("color")}
            className="w-12 h-12 p-1 border-border rounded-md cursor-pointer"
          />
          <Input
            type="text"
            {...form.register("color")}
            placeholder="#RRGGBB"
            className="flex-grow bg-input border-border text-foreground focus-visible:ring-ring"
          />
        </div>
        {form.formState.errors.color && (
          <p className="text-red-500 text-sm mt-1">
            {form.formState.errors.color.message}
          </p>
        )}
      </div>
      <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
        {initialData ? "Atualizar Tag" : "Adicionar Tag"}
      </Button>
    </form>
  );
};

export default TagForm;