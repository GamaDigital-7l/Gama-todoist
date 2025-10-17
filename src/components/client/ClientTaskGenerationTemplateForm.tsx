"use client";

import React, { useState, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { useSession } from "@/integrations/supabase/auth";
import { ClientTaskGenerationTemplate, ClientTaskGenerationPattern } from "@/types/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PlusCircle, XCircle } from "lucide-react";

const DAYS_OF_WEEK_OPTIONS = [
  { value: "Sunday", label: "Domingo" },
  { value: "Monday", label: "Segunda-feira" },
  { value: "Tuesday", label: "Terça-feira" },
  { value: "Wednesday", label: "Quarta-feira" },
  { value: "Thursday", label: "Quinta-feira" },
  { value: "Friday", label: "Sexta-feira" },
  { value: "Saturday", label: "Sábado" },
];

const generationPatternSchema = z.object({
  week: z.number().int().min(1, "A semana deve ser 1-4.").max(4, "A semana deve ser 1-4."),
  day_of_week: z.enum(["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]),
  count: z.number().int().min(1, "A quantidade deve ser pelo menos 1."),
});

const clientTaskGenerationTemplateSchema = z.object({
  template_name: z.string().min(1, "O nome do template é obrigatório."),
  delivery_count: z.preprocess(
    (val) => (val === "" ? 0 : Number(val)),
    z.number().int().min(0, "A meta deve ser um número positivo.").default(0),
  ),
  generation_pattern: z.array(generationPatternSchema).min(1, "Deve haver pelo menos um padrão de geração."),
});

export type ClientTaskGenerationTemplateFormValues = z.infer<typeof clientTaskGenerationTemplateSchema>;

interface ClientTaskGenerationTemplateFormProps {
  clientId: string;
  initialData?: ClientTaskGenerationTemplate;
  onTemplateSaved: () => void;
  onClose: () => void;
}

const ClientTaskGenerationTemplateForm: React.FC<ClientTaskGenerationTemplateFormProps> = ({ clientId, initialData, onTemplateSaved, onClose }) => {
  const { session } = useSession();
  const userId = session?.user?.id;

  const form = useForm<ClientTaskGenerationTemplateFormValues>({
    resolver: zodResolver(clientTaskGenerationTemplateSchema),
    defaultValues: initialData ? {
      ...initialData,
      generation_pattern: initialData.generation_pattern || [{ week: 1, day_of_week: "Monday", count: 1 }],
    } : {
      template_name: "",
      delivery_count: 0,
      generation_pattern: [{ week: 1, day_of_week: "Monday", count: 1 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "generation_pattern",
  });

  const onSubmit = async (values: ClientTaskGenerationTemplateFormValues) => {
    if (!userId) {
      showError("Usuário não autenticado.");
      return;
    }

    try {
      const dataToSave = {
        template_name: values.template_name,
        delivery_count: values.delivery_count,
        generation_pattern: values.generation_pattern,
        updated_at: new Date().toISOString(),
      };

      if (initialData?.id) {
        const { error } = await supabase
          .from("client_task_generation_templates")
          .update(dataToSave)
          .eq("id", initialData.id)
          .eq("client_id", clientId)
          .eq("user_id", userId);

        if (error) throw error;
        showSuccess("Template de geração atualizado com sucesso!");
      } else {
        const { error } = await supabase.from("client_task_generation_templates").insert({
          ...dataToSave,
          client_id: clientId,
          user_id: userId,
        });

        if (error) throw error;
        showSuccess("Template de geração adicionado com sucesso!");
      }
      form.reset();
      onTemplateSaved();
      onClose();
    } catch (error: any) {
      showError("Erro ao salvar template de geração: " + error.message);
      console.error("Erro ao salvar template de geração:", error);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-4 bg-card">
      <div>
        <Label htmlFor="template_name" className="text-foreground">Nome do Template</Label>
        <Input
          id="template_name"
          {...form.register("template_name")}
          placeholder="Ex: Padrão 8 Posts/Mês"
          className="w-full bg-input border-border text-foreground focus-visible:ring-ring"
        />
        {form.formState.errors.template_name && (
          <p className="text-red-500 text-sm mt-1">
            {form.formState.errors.template_name.message}
          </p>
        )}
      </div>
      <div>
        <Label htmlFor="delivery_count" className="text-foreground">Total de Entregas (Mês)</Label>
        <Input
          id="delivery_count"
          type="number"
          {...form.register("delivery_count", { valueAsNumber: true })}
          placeholder="Ex: 8"
          className="w-full bg-input border-border text-foreground focus-visible:ring-ring"
        />
        {form.formState.errors.delivery_count && (
          <p className="text-red-500 text-sm mt-1">
            {form.formState.errors.delivery_count.message}
          </p>
        )}
      </div>

      <h3 className="text-lg font-semibold text-foreground mt-4">Padrões de Geração</h3>
      <div className="space-y-3">
        {fields.map((field, index) => (
          <div key={field.id} className="flex flex-col sm:flex-row gap-2 items-end p-3 border border-border rounded-md bg-background">
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <Label htmlFor={`generation_pattern.${index}.week`} className="text-foreground">Semana (1-4)</Label>
                <Input
                  id={`generation_pattern.${index}.week`}
                  type="number"
                  {...form.register(`generation_pattern.${index}.week`, { valueAsNumber: true })}
                  min={1}
                  max={4}
                  className="w-full bg-input border-border text-foreground focus-visible:ring-ring"
                />
                {form.formState.errors.generation_pattern?.[index]?.week && (
                  <p className="text-red-500 text-xs mt-1">
                    {form.formState.errors.generation_pattern[index]?.week?.message}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor={`generation_pattern.${index}.day_of_week`} className="text-foreground">Dia da Semana</Label>
                <Select
                  onValueChange={(value: ClientTaskGenerationPattern['day_of_week']) => form.setValue(`generation_pattern.${index}.day_of_week`, value)}
                  value={form.watch(`generation_pattern.${index}.day_of_week`)}
                >
                  <SelectTrigger id={`generation_pattern.${index}.day_of_week`} className="w-full bg-input border-border text-foreground focus-visible:ring-ring">
                    <SelectValue placeholder="Selecionar dia" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover text-popover-foreground border-border rounded-md shadow-lg">
                    {DAYS_OF_WEEK_OPTIONS.map(day => (
                      <SelectItem key={day.value} value={day.value}>{day.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.generation_pattern?.[index]?.day_of_week && (
                  <p className="text-red-500 text-xs mt-1">
                    {form.formState.errors.generation_pattern[index]?.day_of_week?.message}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor={`generation_pattern.${index}.count`} className="text-foreground">Quantidade</Label>
                <Input
                  id={`generation_pattern.${index}.count`}
                  type="number"
                  {...form.register(`generation_pattern.${index}.count`, { valueAsNumber: true })}
                  min={1}
                  className="w-full bg-input border-border text-foreground focus-visible:ring-ring"
                />
                {form.formState.errors.generation_pattern?.[index]?.count && (
                  <p className="text-red-500 text-xs mt-1">
                    {form.formState.errors.generation_pattern[index]?.count?.message}
                  </p>
                )}
              </div>
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} className="text-red-500 hover:bg-red-500/10">
              <XCircle className="h-4 w-4" />
              <span className="sr-only">Remover Padrão</span>
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" onClick={() => append({ week: 1, day_of_week: "Monday", count: 1 })} className="w-full border-dashed border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground">
          <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Padrão
        </Button>
        {form.formState.errors.generation_pattern && (
          <p className="text-red-500 text-sm mt-1">
            {form.formState.errors.generation_pattern.message}
          </p>
        )}
      </div>

      <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
        {initialData?.id ? "Atualizar Template" : "Adicionar Template"}
      </Button>
    </form>
  );
};

export default ClientTaskGenerationTemplateForm;