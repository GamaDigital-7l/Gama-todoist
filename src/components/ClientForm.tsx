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
import { Client } from "@/types/client";

const clientSchema = z.object({
  name: z.string().min(1, "O nome do cliente é obrigatório."),
  logo_file: z
    .instanceof(File)
    .optional()
    .refine((file) => !file || (file.type.startsWith("image/") && file.size <= 5 * 1024 * 1024), "Apenas imagens (max 5MB) são permitidas."),
  logo_url: z.string().url("URL da logo inválida.").optional().or(z.literal("")),
  description: z.string().optional(),
  color: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Cor inválida. Use formato hexadecimal (ex: #RRGGBB).").default("#FFFFFF"),
});

export type ClientFormValues = z.infer<typeof clientSchema>;

interface ClientFormProps {
  initialData?: Client;
  onClientSaved: () => void;
  onClose: () => void;
}

const sanitizeFilename = (filename: string) => {
  return filename
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9.]/g, "-")
    .replace(/--+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
};

const BUCKET_NAME = "client-visual-references"; // Define o nome do bucket como uma constante

const ClientForm: React.FC<ClientFormProps> = ({ initialData, onClientSaved, onClose }) => {
  const { session } = useSession();
  const userId = session?.user?.id;

  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: initialData ? {
      ...initialData,
      logo_file: undefined,
      logo_url: initialData.logo_url || "",
    } : {
      name: "",
      logo_file: undefined,
      logo_url: "",
      description: "",
      color: "#FFFFFF",
    },
  });

  const onSubmit = async (values: ClientFormValues) => {
    if (!userId) {
      showError("Usuário não autenticado.");
      return;
    }

    try {
      let finalLogoUrl: string | null = values.logo_url || null;

      if (values.logo_file) {
        const file = values.logo_file;
        const sanitizedFilename = sanitizeFilename(file.name);
        const filePath = `client_logos/${userId}/${Date.now()}-${sanitizedFilename}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from(BUCKET_NAME) // Usando a constante do bucket
          .upload(filePath, file, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) {
          throw new Error("Erro ao fazer upload da logo: " + uploadError.message);
        }

        const { data: publicUrlData } = supabase.storage
          .from(BUCKET_NAME)
          .getPublicUrl(filePath);
        
        finalLogoUrl = publicUrlData.publicUrl;
      }

      const dataToSave = {
        name: values.name,
        logo_url: finalLogoUrl,
        description: values.description || null,
        color: values.color,
        updated_at: new Date().toISOString(),
      };

      if (initialData) {
        const { error } = await supabase
          .from("clients")
          .update(dataToSave)
          .eq("id", initialData.id)
          .eq("user_id", userId);

        if (error) throw error;
        showSuccess("Cliente atualizado com sucesso!");
      } else {
        const { error } = await supabase.from("clients").insert({
          ...dataToSave,
          user_id: userId,
        });

        if (error) throw error;
        showSuccess("Cliente adicionado com sucesso!");
      }
      form.reset();
      onClientSaved();
      onClose();
    } catch (error: any) {
      showError("Erro ao salvar cliente: " + error.message);
      console.error("Erro ao salvar cliente:", error);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-4 bg-card">
      <div>
        <Label htmlFor="name" className="text-foreground">Nome do Cliente</Label>
        <Input
          id="name"
          {...form.register("name")}
          placeholder="Ex: Rutherford"
          className="w-full bg-input border-border text-foreground focus-visible:ring-ring"
        />
        {form.formState.errors.name && (
          <p className="text-red-500 text-sm mt-1">
            {form.formState.errors.name.message}
          </p>
        )}
      </div>
      <div>
        <Label htmlFor="logo_file" className="text-foreground">Logo (Upload de Arquivo, Opcional)</Label>
        <Input
          id="logo_file"
          type="file"
          accept="image/*"
          onChange={(e) => form.setValue("logo_file", e.target.files?.[0])}
          className="w-full bg-input border-border text-foreground focus-visible:ring-ring"
        />
        {form.formState.errors.logo_file && (
          <p className="text-red-500 text-sm mt-1">
            {form.formState.errors.logo_file.message}
          </p>
        )}
      </div>
      <div>
        <Label htmlFor="logo_url" className="text-foreground">Logo (URL, Opcional)</Label>
        <Input
          id="logo_url"
          {...form.register("logo_url")}
          placeholder="Ex: https://exemplo.com/logo.png"
          className="w-full bg-input border-border text-foreground focus-visible:ring-ring"
        />
        {form.formState.errors.logo_url && (
          <p className="text-red-500 text-sm mt-1">
            {form.formState.errors.logo_url.message}
          </p>
        )}
      </div>
      <div>
        <Label htmlFor="description" className="text-foreground">Descrição (Opcional)</Label>
        <Textarea
          id="description"
          {...form.register("description")}
          placeholder="Breve descrição do cliente..."
          className="w-full bg-input border-border text-foreground focus-visible:ring-ring"
        />
      </div>
      <div>
        <Label htmlFor="color" className="text-foreground">Cor do Cliente</Label>
        <Input
          id="color"
          type="color"
          {...form.register("color")}
          className="w-full h-12 p-1 border-border rounded-md cursor-pointer"
        />
        {form.formState.errors.color && (
          <p className="text-red-500 text-sm mt-1">
            {form.formState.errors.color.message}
          </p>
        )}
      </div>
      <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
        {initialData ? "Atualizar Cliente" : "Adicionar Cliente"}
      </Button>
    </form>
  );
};

export default ClientForm;