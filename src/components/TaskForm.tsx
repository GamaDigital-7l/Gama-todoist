"use client";

import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import TimePicker from "./TimePicker";
import { useSession } from "@/integrations/supabase/auth";

const taskSchema = z.object({
  title: z.string().min(1, "O título da tarefa é obrigatório."),
  description: z.string().optional(),
  due_date: z.date().optional().nullable(),
  time: z.string().optional().nullable(),
  recurrence_type: z.enum(["none", "daily_weekday", "weekly", "monthly"]).default("none"),
  recurrence_details: z.string().optional().nullable(),
});

export type TaskFormValues = z.infer<typeof taskSchema>;

interface TaskFormProps {
  initialData?: TaskFormValues & { id: string };
  onTaskSaved: () => void;
  onClose: () => void;
}

const TaskForm: React.FC<TaskFormProps> = ({ initialData, onTaskSaved, onClose }) => {
  const { session } = useSession();
  const userId = session?.user?.id;

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: initialData ? {
      ...initialData,
      due_date: initialData.due_date ? new Date(initialData.due_date) : undefined,
      time: initialData.time || undefined,
      recurrence_details: initialData.recurrence_details || undefined,
    } : {
      title: "",
      description: "",
      due_date: undefined,
      time: undefined,
      recurrence_type: "none",
      recurrence_details: undefined,
    },
  });

  const recurrenceType = form.watch("recurrence_type");

  const onSubmit = async (values: TaskFormValues) => {
    if (!userId) {
      showError("Usuário não autenticado.");
      return;
    }

    try {
      if (initialData) {
        const { error } = await supabase
          .from("tasks")
          .update({
            title: values.title,
            description: values.description,
            due_date: values.due_date ? format(values.due_date, "yyyy-MM-dd") : null,
            time: values.time || null,
            recurrence_type: values.recurrence_type,
            recurrence_details: values.recurrence_details || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", initialData.id)
          .eq("user_id", userId);

        if (error) throw error;
        showSuccess("Tarefa atualizada com sucesso!");
      } else {
        const { error } = await supabase.from("tasks").insert({
          title: values.title,
          description: values.description,
          due_date: values.due_date ? format(values.due_date, "yyyy-MM-dd") : null,
          time: values.time || null,
          is_completed: false,
          recurrence_type: values.recurrence_type,
          recurrence_details: values.recurrence_details || null,
          user_id: userId,
        });

        if (error) throw error;
        showSuccess("Tarefa adicionada com sucesso!");
      }
      form.reset();
      onTaskSaved();
      onClose();
    } catch (error: any) {
      showError("Erro ao salvar tarefa: " + error.message);
      console.error("Erro ao salvar tarefa:", error);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-4 bg-card">
      <div>
        <Label htmlFor="title" className="text-foreground">Título</Label>
        <Input
          id="title"
          {...form.register("title")}
          placeholder="Ex: Fazer exercícios"
          className="bg-input border-border text-foreground focus-visible:ring-ring"
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
          placeholder="Detalhes da tarefa..."
          className="bg-input border-border text-foreground focus-visible:ring-ring"
        />
      </div>
      <div>
        <Label htmlFor="due_date" className="text-foreground">Data de Vencimento (Opcional)</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={"outline"}
              className={cn(
                "w-full justify-start text-left font-normal bg-input border-border text-foreground hover:bg-accent hover:text-accent-foreground",
                !form.watch("due_date") && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {form.watch("due_date") ? (
                format(form.watch("due_date")!, "PPP")
              ) : (
                <span>Escolha uma data</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 bg-popover border-border rounded-md shadow-lg">
            <Calendar
              mode="single"
              selected={form.watch("due_date") || undefined}
              onSelect={(date) => form.setValue("due_date", date || null)}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      <div>
        <Label htmlFor="time" className="text-foreground">Horário (Opcional)</Label>
        <TimePicker
          value={form.watch("time") || undefined}
          onChange={(time) => form.setValue("time", time || null)}
        />
      </div>

      <div>
        <Label htmlFor="recurrence_type" className="text-foreground">Recorrência</Label>
        <Select
          onValueChange={(value: "none" | "daily_weekday" | "weekly" | "monthly") => {
            form.setValue("recurrence_type", value);
            form.setValue("recurrence_details", null);
          }}
          value={recurrenceType}
        >
          <SelectTrigger id="recurrence_type" className="bg-input border-border text-foreground focus-visible:ring-ring">
            <SelectValue placeholder="Selecionar tipo de recorrência" />
          </SelectTrigger>
          <SelectContent className="bg-popover text-popover-foreground border-border rounded-md shadow-lg">
            <SelectItem value="none">Nenhuma</SelectItem>
            <SelectItem value="daily_weekday">Dias de Semana (Seg-Sex)</SelectItem>
            <SelectItem value="weekly">Semanal</SelectItem>
            <SelectItem value="monthly">Mensal</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {recurrenceType === "weekly" && (
        <div>
          <Label htmlFor="recurrence_details_weekly" className="text-foreground">Dia da Semana</Label>
          <Select
            onValueChange={(value) => form.setValue("recurrence_details", value)}
            value={form.watch("recurrence_details") || undefined}
          >
            <SelectTrigger id="recurrence_details_weekly" className="bg-input border-border text-foreground focus-visible:ring-ring">
              <SelectValue placeholder="Selecionar dia da semana" />
            </SelectTrigger>
            <SelectContent className="bg-popover text-popover-foreground border-border rounded-md shadow-lg">
              <SelectItem value="Sunday">Domingo</SelectItem>
              <SelectItem value="Monday">Segunda-feira</SelectItem>
              <SelectItem value="Tuesday">Terça-feira</SelectItem>
              <SelectItem value="Wednesday">Quarta-feira</SelectItem>
              <SelectItem value="Thursday">Quinta-feira</SelectItem>
              <SelectItem value="Friday">Sexta-feira</SelectItem>
              <SelectItem value="Saturday">Sábado</SelectItem>
            </SelectContent>
          </Select>
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
            className="bg-input border-border text-foreground focus-visible:ring-ring"
          />
          {form.formState.errors.recurrence_details && (
            <p className="text-red-500 text-sm mt-1">
              {form.formState.errors.recurrence_details.message}
            </p>
          )}
        </div>
      )}

      <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90">{initialData ? "Atualizar Tarefa" : "Adicionar Tarefa"}</Button>
    </form>
  );
};

export default TaskForm;