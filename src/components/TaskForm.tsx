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

const taskSchema = z.object({
  title: z.string().min(1, "O título da tarefa é obrigatório."),
  description: z.string().optional(),
  due_date: z.date().optional(),
  recurrence_type: z.enum(["none", "daily_weekday", "weekly", "monthly"]).default("none"),
  recurrence_details: z.string().optional(),
});

type TaskFormValues = z.infer<typeof taskSchema>;

interface TaskFormProps {
  onTaskAdded: () => void;
}

const TaskForm: React.FC<TaskFormProps> = ({ onTaskAdded }) => {
  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: "",
      description: "",
      due_date: undefined,
      recurrence_type: "none",
      recurrence_details: "",
    },
  });

  const recurrenceType = form.watch("recurrence_type");

  const onSubmit = async (values: TaskFormValues) => {
    try {
      const { error } = await supabase.from("tasks").insert({
        title: values.title,
        description: values.description,
        due_date: values.due_date ? format(values.due_date, "yyyy-MM-dd") : null,
        is_completed: false,
        recurrence_type: values.recurrence_type,
        recurrence_details: values.recurrence_details,
        // user_id: auth.uid() // Adicionar user_id aqui quando a autenticação for reativada
      });

      if (error) throw error;
      showSuccess("Tarefa adicionada com sucesso!");
      form.reset({
        title: "",
        description: "",
        due_date: undefined,
        recurrence_type: "none",
        recurrence_details: "",
      });
      onTaskAdded(); // Notifica o componente pai que uma tarefa foi adicionada
    } catch (error: any) {
      showError("Erro ao adicionar tarefa: " + error.message);
      console.error("Erro ao adicionar tarefa:", error);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-4 border rounded-lg bg-card">
      <h2 className="text-xl font-semibold">Adicionar Nova Tarefa</h2>
      <div>
        <Label htmlFor="title">Título</Label>
        <Input
          id="title"
          {...form.register("title")}
          placeholder="Ex: Fazer exercícios"
        />
        {form.formState.errors.title && (
          <p className="text-red-500 text-sm mt-1">
            {form.formState.errors.title.message}
          </p>
        )}
      </div>
      <div>
        <Label htmlFor="description">Descrição (Opcional)</Label>
        <Textarea
          id="description"
          {...form.register("description")}
          placeholder="Detalhes da tarefa..."
        />
      </div>
      <div>
        <Label htmlFor="due_date">Data de Vencimento (Opcional)</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={"outline"}
              className={cn(
                "w-full justify-start text-left font-normal",
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
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={form.watch("due_date")}
              onSelect={(date) => form.setValue("due_date", date)}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      <div>
        <Label htmlFor="recurrence_type">Recorrência</Label>
        <Select
          onValueChange={(value: "none" | "daily_weekday" | "weekly" | "monthly") => {
            form.setValue("recurrence_type", value);
            form.setValue("recurrence_details", ""); // Limpa detalhes ao mudar o tipo
          }}
          value={recurrenceType}
        >
          <SelectTrigger id="recurrence_type">
            <SelectValue placeholder="Selecionar tipo de recorrência" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Nenhuma</SelectItem>
            <SelectItem value="daily_weekday">Dias de Semana (Seg-Sex)</SelectItem>
            <SelectItem value="weekly">Semanal</SelectItem>
            <SelectItem value="monthly">Mensal</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {recurrenceType === "weekly" && (
        <div>
          <Label htmlFor="recurrence_details_weekly">Dia da Semana</Label>
          <Select
            onValueChange={(value) => form.setValue("recurrence_details", value)}
            value={form.watch("recurrence_details")}
          >
            <SelectTrigger id="recurrence_details_weekly">
              <SelectValue placeholder="Selecionar dia da semana" />
            </SelectTrigger>
            <SelectContent>
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
          <Label htmlFor="recurrence_details_monthly">Dia do Mês</Label>
          <Input
            id="recurrence_details_monthly"
            type="number"
            min="1"
            max="31"
            {...form.register("recurrence_details", { valueAsNumber: true })}
            placeholder="Ex: 15"
          />
          {form.formState.errors.recurrence_details && (
            <p className="text-red-500 text-sm mt-1">
              {form.formState.errors.recurrence_details.message}
            </p>
          )}
        </div>
      )}

      <Button type="submit" className="w-full">Adicionar Tarefa</Button>
    </form>
  );
};

export default TaskForm;