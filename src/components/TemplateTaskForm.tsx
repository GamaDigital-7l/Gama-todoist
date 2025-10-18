"use client";

import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { useSession } from "@/integrations/supabase/auth";
import TagSelector from "./TagSelector";
import { OriginBoard, RecurrenceType, TemplateTask, TemplateFormOriginBoard } from "@/types/task";
import { parseISO } from "date-fns";
import TimePicker from "./TimePicker"; // Importar TimePicker

const DAYS_OF_WEEK = [
  { value: "Sunday", label: "Domingo" },
  { value: "Monday", label: "Segunda-feira" },
  { value: "Tuesday", label: "Terça-feira" },
  { value: "Wednesday", label: "Quarta-feira" },
  { value: "Thursday", label: "Quinta-feira" },
  { value: "Friday", label: "Sexta-feira" },
  { value: "Saturday", label: "Sábado" },
];

const templateTaskSchema = z.object({
  title: z.string().min(1, "O título da tarefa padrão é obrigatório."),
  description: z.string().optional(),
  recurrence_type: z.enum(["none", "daily", "weekly", "monthly"]).default("none"),
  recurrence_details: z.string().optional().nullable(),
  recurrence_time: z.string().optional().nullable(), // Novo campo
  origin_board: z.enum(["general", "today_priority", "today_no_priority", "jobs_woe_today"]).default("general"),
  selected_tag_ids: z.array(z.string()).optional(),
});

export type TemplateTaskFormValues = z.infer<typeof templateTaskSchema>;

interface TemplateTaskFormProps {
  initialData?: Omit<TemplateTaskFormValues, 'recurrence_details' | 'origin_board' | 'recurrence_time'> & {
    id: string;
    recurrence_details?: string | null;
    recurrence_time?: string | null; // Novo campo
    tags?: { id: string; name: string; color: string }[];
    origin_board: TemplateFormOriginBoard;
  };
  onTemplateTaskSaved: () => void;
  onClose: () => void;
}

const TemplateTaskForm: React.FC<TemplateTaskFormProps> = ({ clientId, initialData, onTemplateTaskSaved, onClose }) => {
  const { session } = useSession();
  const userId = session?.user?.id;

  const form = useForm<TemplateTaskFormValues>({
    resolver: zodResolver(templateTaskSchema),
    defaultValues: initialData ? {
      ...initialData,
      generation_pattern: initialData.generation_pattern || [{ week: 1, day_of_week: "Monday", count: 1 }],
      is_active: initialData.is_active,
      default_due_days: initialData.default_due_days || undefined,
      is_standard_task: initialData.is_standard_task || false, // Novo campo
    } : {
      template_name: "",
      delivery_count: 0,
      generation_pattern: [{ week: 1, day_of_week: "Monday", count: 1 }],
      is_active: true,
      default_due_days: undefined,
      is_standard_task: false, // Novo campo
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "generation_pattern",
  });

  const onSubmit = async (values: TemplateTaskFormValues) => {
    if (!userId) {
      showError("Usuário não autenticado.");
      return;
    }

    try {
      const dataToSave = {
        template_name: values.template_name,
        delivery_count: values.delivery_count,
        generation_pattern: values.generation_pattern,
        is_active: values.is_active,
        default_due_days: values.default_due_days || null,
        is_standard_task: values.is_standard_task, // Novo campo
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
      onTemplateTaskSaved();
      onClose();
    } catch (error: any) {
      showError("Erro ao salvar template de geração: " + error.message);
      console.error("Erro ao salvar template de geração:", error);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-4 bg-card rounded-xl frosted-glass card-hover-effect">
      <div>
        <Label htmlFor="title" className="text-foreground">Título</Label>
        <Input
          id="title"
          {...form.register("title")}
          placeholder="Ex: Fazer exercícios matinais"
          className="w-full bg-input border-border text-foreground focus-visible:ring-ring"
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
          placeholder="Detalhes da tarefa padrão (ex: 30 minutos de leitura, 10 páginas, 1h de estudo)..."
          className="w-full bg-input border-border text-foreground focus-visible:ring-ring"
        />
      </div>
      
      <div>
        <Label htmlFor="recurrence_type" className="text-foreground">Recorrência</Label>
        <Select
          onValueChange={(value: RecurrenceType) => {
            form.setValue("recurrence_type", value);
            form.setValue("recurrence_details", null);
            form.setValue("recurrence_time", null); // Resetar recurrence_time
            setSelectedDays([]);
          }}
          value={recurrenceType}
        >
          <SelectTrigger id="recurrence_type" className="w-full bg-input border-border text-foreground focus-visible:ring-ring">
            <SelectValue placeholder="Selecionar tipo de recorrência" />
          </SelectTrigger>
          <SelectContent className="bg-popover text-popover-foreground border-border rounded-md shadow-lg">
            <SelectItem value="none">Nenhuma</SelectItem>
            <SelectItem value="daily">Diário</SelectItem>
            <SelectItem value="weekly">Semanal (selecionar dias)</SelectItem>
            <SelectItem value="monthly">Mensal</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {recurrenceType !== "none" && (
        <div>
          <Label htmlFor="recurrence_time" className="text-foreground">Horário de Recorrência (Opcional)</Label>
          <TimePicker
            value={form.watch("recurrence_time") || undefined}
            onChange={(time) => form.setValue("recurrence_time", time || null)}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Se definido, a tarefa será criada com este horário e você receberá uma notificação.
          </p>
        </div>
      )}

      {recurrenceType === "weekly" && (
        <div>
          <Label className="text-foreground">Dias da Semana</Label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2"> {/* Ajustado para grid responsivo */}
            {DAYS_OF_WEEK.map((day) => (
              <div key={day.value} className="flex items-center space-x-2">
                <Checkbox
                  id={`day-${day.value}`}
                  checked={selectedDays.includes(day.value)}
                  onCheckedChange={() => handleDayToggle(day.value)}
                  className="border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground flex-shrink-0"
                />
                <Label htmlFor={`day-${day.value}`} className="text-foreground">
                  {day.label}
                </Label>
              </div>
            ))}
          </div>
          {form.formState.errors.recurrence_details && (
            <p className="text-red-500 text-sm mt-1">
              {form.formState.errors.recurrence_details.message}
            </p>
          )}
        </div>
      )}

      {recurrenceType === "monthly" && (
        <div>
          <Label htmlFor="recurrence_details_monthly" className="text-foreground">Dia do Mês</Label>
          <Input
            id="recurrence_details_monthly"
            type="number"
            min="1"
            max="31"
            {...form.register("recurrence_details", { valueAsNumber: true })}
            placeholder="Ex: 15"
            className="w-full bg-input border-border text-foreground focus-visible:ring-ring"
          />
          {form.formState.errors.recurrence_details && (
            <p className="text-red-500 text-sm mt-1">
              {form.formState.errors.recurrence_details.message}
            </p>
          )}
        </div>
      )}

      <div>
        <Label htmlFor="origin_board" className="text-foreground">Quadro de Origem</Label>
        <Select
          onValueChange={(value: TemplateFormOriginBoard) => form.setValue("origin_board", value)}
          value={form.watch("origin_board")}
        >
          <SelectTrigger id="origin_board" className="w-full bg-input border-border text-foreground focus-visible:ring-ring">
            <SelectValue placeholder="Selecionar quadro" />
          </SelectTrigger>
          <SelectContent className="bg-popover text-popover-foreground border-border rounded-md shadow-lg">
            <SelectItem value="general">Geral</SelectItem>
            <SelectItem value="today_priority">Hoje - Prioridade</SelectItem>
            <SelectItem value="today_no_priority">Hoje - Sem Prioridade</SelectItem>
            <SelectItem value="jobs_woe_today">Jobs Woe hoje</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="is_active"
          checked={form.watch("is_active")}
          onCheckedChange={(checked) => form.setValue("is_active", checked as boolean)}
          className="border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground flex-shrink-0"
        />
        <Label htmlFor="is_active" className="text-foreground">Template Ativo</Label>
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="is_standard_task"
          checked={form.watch("is_standard_task")}
          onCheckedChange={(checked) => form.setValue("is_standard_task", checked as boolean)}
          className="border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground flex-shrink-0"
        />
        <Label htmlFor="is_standard_task" className="text-foreground">Gerar como Tarefa Padrão (aparece no Dashboard Principal)</Label>
      </div>

      <div>
        <Label htmlFor="default_due_days" className="text-foreground">Prazo Padrão (dias para entrega, opcional)</Label>
        <Input
          id="default_due_days"
          type="number"
          {...form.register("default_due_days", { valueAsNumber: true })}
          placeholder="Ex: 5"
          className="w-full bg-input border-border text-foreground focus-visible:ring-ring"
        />
        {form.formState.errors.default_due_days && (
          <p className="text-red-500 text-sm mt-1">
            {form.formState.errors.default_due_days.message}
          </p>
        )}
      </div>

      <h3 className="text-lg font-semibold text-foreground mt-4">Padrões de Geração</h3>
      <div className="space-y-3">
        {fields.map((field, index) => (
          <div key={field.id} className="flex flex-col sm:flex-row gap-2 items-end p-3 border border-border rounded-md bg-background">
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2"> {/* Ajustado para grid responsivo */}
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
            <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} className="text-red-500 hover:bg-red-500/10 flex-shrink-0">
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