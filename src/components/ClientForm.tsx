"use client";

import React, { useState, useEffect } from "react";
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
import { Loader2, Image as ImageIcon, XCircle } from "lucide-react";
import { Client } from "@/types/client";
import { DIALOG_CONTENT_CLASSNAMES } from "@/lib/constants"; // Importar a constante

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const clientSchema = z.object({
  name: z.string().min(1, "O nome do cliente é obrigatório."),
  contact_email: z.string().email("E-mail inválido.").optional().or(z.literal("")),
  contact_phone: z.string().optional().or(z.literal("")),
  description: z.string().optional().or(z.literal("")),
  monthly_delivery_goal: z.preprocess(
    (val) => (val === "" ? null : Number(val)),
    z.number().int().min(0, "A meta deve ser um número positivo.").nullable().optional(),
  ),
  logo_url: z.string().nullable().optional(),
  logo_file: z.any()
    .refine((file) => !file || file.length === 0 || (file.length > 0 && file[0].size <= MAX_FILE_SIZE), `O tamanho máximo da imagem é 5MB.`)
    .refine((file) => !file || file.length === 0 || (file.length > 0 && ["image/jpeg", "image/png", "image/webp"].includes(file[0].type)), "A imagem deve ser JPG, PNG ou WEBP.")
    .optional(),
});

export type ClientFormValues = z.infer<typeof clientSchema>;

interface ClientFormProps {
  initialData?: Client;
  onClientSaved: () => void;
  onClose: () => void;
}

const ClientForm: React.FC<ClientFormProps> = ({ initialData, onClientSaved, onClose }) => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const [isLoading, setIsLoading] = useState(false);
  const [previewLogo, setPreviewLogo] = useState<string | null>(initialData?.logo_url || null);

  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: initialData ? {
      ...initialData,
      contact_email: initialData.contact_email || "",
      contact_phone: initialData.contact_phone || "",
      description: initialData.description || "",
      monthly_delivery_goal: initialData.monthly_delivery_goal || undefined,
      logo_url: initialData.logo_url || null,
    } : {
      name: "",
      contact_email: "",
      contact_phone: "",
      description: "",
      monthly_delivery_goal: undefined,
      logo_url: null,
    },
  });

  useEffect(() => {
    if (initialData?.logo_url) {
      setPreviewLogo(initialData.logo_url);
    }
  }, [initialData]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewLogo(reader.result as string);
      };
      reader.readAsDataURL(file);
      form.setValue("logo_file", e.target.files);
    } else {
      setPreviewLogo(initialData?.logo_url || null);
      form.setValue("logo_file", undefined);
    }
  };

  const handleRemoveLogo = () => {
    setPreviewLogo(null);
    form.setValue("logo_file", undefined);
    form.setValue("logo_url", null); // Clear existing URL if any
  };

  const onSubmit = async (values: ClientFormValues) => {
    if (!userId) {
      showError("Usuário não autenticado.");
      return;
    }
    setIsLoading(true);

    let logoUrl = values.logo_url;

    try {
      // Handle logo upload if a new file is selected
      if (values.logo_file && values.logo_file.length > 0) {
        const file = values.logo_file[0];
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const filePath = `${userId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('client-logos')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: true,
          });

        if (uploadError) {
          throw new Error('Erro ao fazer upload do logo: ' + uploadError.message);
        }

        const { data: publicUrlData } = supabase.storage
          .from('client-logos')
          .getPublicUrl(filePath);
        
        logoUrl = publicUrlData.publicUrl;
      } else if (previewLogo === null && values.logo_url) {
        // If logo was removed and there was an old URL, delete from storage
        const oldFilePath = values.logo_url.split('/').pop(); // Simple extraction, might need refinement
        if (oldFilePath) {
          await supabase.storage.from('client-logos').remove([`${userId}/${oldFilePath}`]);
        }
        logoUrl = null;
      }

      const dataToSave = {
        name: values.name,
        contact_email: values.contact_email || null,
        contact_phone: values.contact_phone || null,
        description: values.description || null,
        monthly_delivery_goal: values.monthly_delivery_goal || null,
        logo_url: logoUrl,
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
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-4 bg-card rounded-xl frosted-glass card-hover-effect">
      <div>
        <Label htmlFor="name" className="text-foreground">Nome do Cliente</Label>
        <Input
          id="name"
          {...form.register("name")}
          placeholder="Ex: Empresa X"
          className="w-full bg-input border-border text-foreground focus-visible:ring-ring"
        />
        {form.formState.errors.name && (
          <p className="text-red-500 text-sm mt-1">
            {form.formState.errors.name.message}
          </p>
        )}
      </div>
      <div>
        <Label htmlFor="contact_email" className="text-foreground">E-mail de Contato (Opcional)</Label>
        <Input
          id="contact_email"
          {...form.register("contact_email")}
          placeholder="Ex: contato@empresa.com"
          className="w-full bg-input border-border text-foreground focus-visible:ring-ring"
        />
        {form.formState.errors.contact_email && (
          <p className="text-red-500 text-sm mt-1">
            {form.formState.errors.contact_email.message}
          </p>
        )}
      </div>
      <div>
        <Label htmlFor="contact_phone" className="text-foreground">Telefone de Contato (Opcional)</Label>
        <Input
          id="contact_phone"
          {...form.register("contact_phone")}
          placeholder="Ex: (XX) XXXXX-XXXX"
          className="w-full bg-input border-border text-foreground focus-visible:ring-ring"
        />
        {form.formState.errors.contact_phone && (
          <p className="text-red-500 text-sm mt-1">
            {form.formState.errors.contact_phone.message}
          </p>
        )}
      </div>
      <div>
        <Label htmlFor="description" className="text-foreground">Descrição (Opcional)</Label>
        <Textarea
          id="description"
          {...form.register("description")}
          placeholder="Detalhes sobre o cliente ou projeto..."
          className="w-full bg-input border-border text-foreground focus-visible:ring-ring"
        />
      </div>
      <div>
        <Label htmlFor="monthly_delivery_goal" className="text-foreground">Meta de Entregas Mensais (Opcional)</Label>
        <Input
          id="monthly_delivery_goal"
          type="number"
          {...form.register("monthly_delivery_goal", { valueAsNumber: true })}
          placeholder="Ex: 10"
          className="w-full bg-input border-border text-foreground focus-visible:ring-ring"
        />
        {form.formState.errors.monthly_delivery_goal && (
          <p className="text-red-500 text-sm mt-1">
            {form.formState.errors.monthly_delivery_goal.message}
          </p>
        )}
      </div>
      <div>
        <Label htmlFor="logo_file" className="text-foreground">Logo do Cliente (Opcional)</Label>
        <Input
          id="logo_file"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileChange}
          className="w-full bg-input border-border text-foreground file:text-primary file:bg-primary-foreground hover:file:bg-primary-foreground/90 focus-visible:ring-ring"
        />
        {form.formState.errors.logo_file && (
          <p className="text-red-500 text-sm mt-1">
            {form.formState.errors.logo_file.message as string}
          </p>
        )}
        {(previewLogo || form.watch("logo_url")) && (
          <div className="relative w-32 h-32 mt-4 border border-border rounded-md overflow-hidden">
            <img src={previewLogo || form.watch("logo_url") || ""} alt="Logo Preview" className="w-full h-full object-cover" />
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="absolute top-1 right-1 h-6 w-6 rounded-full"
              onClick={handleRemoveLogo}
            >
              <XCircle className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
      <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={isLoading}>
        {isLoading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          initialData ? "Atualizar Cliente" : "Adicionar Cliente"
        )}
      </Button>
    </form>
  );
};

export default ClientForm;