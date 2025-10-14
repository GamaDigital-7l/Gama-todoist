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
import { useSession } from "@/integrations/supabase/auth";

const goalSchema = z.object({
  title: z.string().min(1, "O título da meta é obrigatório."),
  description: z.string().optional(),
  target_date: z.date().optional().nullable(),
  status: z.enum(["pending", "in_progress", "completed"]).default("pending"),
});

export type GoalFormValues = z.infer<typeof goalSchema>;

interface GoalFormProps {
  initialData?: GoalFormValues & { id: string };
  onGoalSaved: () => void;
  onClose: () => void;
}

const GoalForm: React.FC<GoalFormProps> = ({ initialData, onGoalSaved, onClose }) => {
  const { session } = useSession();
  const userId = session?.user?.id;

  const form = useForm<GoalFormValues>({
    resolver: zodResolver(goalSchema),
    defaultValues: initialData ? {
      ...initialData,
      target_date: initialData.target_date ? new Date(initialData.target_date) : undefined,
    } : {
      title: "",
      description: "",
      target_date: undefined,
      status: "pending",
    },
  });

  const onSubmit = async (values: GoalFormValues) => {
    if (!userId) {
      showError("Usuário não autenticado.");
      return;
    }

    try {
      if (initialData) {
        // Editar meta existente
        const { error } = await supabase
          .from("goals")
          .update({
            title: values.title,
            description: values.description,
            target_date: values.target_date ? format(values.target_date, "yyyy-MM-dd") : null,
            status: values.status,
            updated_at: new Date().toISOString(),
          })
          .eq("id", initialData.id)
          .eq("user_id", userId);

        if (error) throw error;
        showSuccess("Meta atualizada com sucesso!");
      } else {
        // Adicionar nova meta
        const { error } = await supabase.from("goals").insert({
          title: values.title,
          description: values.description,
          target_date: values.target_date ? format(values.target_date, "yyyy-MM-dd") : null,
          status: values.status,
          user_id: userId,
        });

        if (error) throw error;
        showSuccess("Meta adicionada com sucesso!");
      }
      form.reset();
      onGoalSaved();
      onClose();
    } catch (error: any) {
      showError("Erro ao salvar meta: " + error.message);
      console.error("Erro ao salvar meta:", error);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-4">
      <div>
        <Label htmlFor="title">Título</Label>
        <Input
          id="title"
          {...form.register("title")}
          placeholder="Ex: Aprender um novo idioma"
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
          placeholder="Detalhes da meta..."
        />
      </div>
      <div>
        <Label htmlFor="target_date">Data Alvo (Opcional)</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={"outline"}
              className={cn(
                "w-full justify-start text-left font-normal",
                !form.watch("target_date") && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {form.watch("target_date") ? (
                format(form.watch("target_date")!, "PPP")
              ) : (
                <span>Escolha uma data</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={form.watch("target_date") || undefined}
              onSelect={(date) => form.setValue("target_date", date || null)}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>
      <div>
        <Label htmlFor="status">Status</Label>
        <Select
          onValueChange={(value: "pending" | "in_progress" | "completed") =>
            form.setValue("status", value)
          }
          value={form.watch("status")}
        >
          <SelectTrigger id="status">
            <SelectValue placeholder="Selecionar status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pendente</SelectItem>
            <SelectItem value="in_progress">Em Progresso</SelectItem>
            <SelectItem value="completed">Concluída</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" className="w-full">
        {initialData ? "Atualizar Meta" : "Adicionar Meta"}
      </Button>
    </form>
  );
};

export default GoalForm;