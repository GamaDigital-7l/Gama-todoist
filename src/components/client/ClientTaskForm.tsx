"use client";

import React, { useState, useEffect } from "react";
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
import { format, parseISO } from "date-fns";
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
import TagSelector from "../TagSelector";
import { ClientTask, ClientTaskStatus } from "@/types/client";
import { Checkbox } from "@/components/ui/checkbox";

const clientTaskSchema = z.object({
  title: z.string().min(1, "O título da tarefa é obrigatório."),
  description: z.string().optional(),
  due_date: z.date().optional().nullable(),
  status: z.enum(["backlog", "in_production", "in_approval", "approved", "scheduled", "published"]).default("backlog"),
  selected_tag_ids: z.array(z.string()).optional(),
  is_completed: z.boolean().default(false),
});

export type ClientTaskFormValues = z.infer<typeof clientTaskSchema>;

interface ClientTaskFormProps {
  clientId: string;
  monthYearRef: string;
  initialData?: ClientTask;
  onTaskSaved: () => void;
  onClose: () => void;
}

const ClientTaskForm: React.FC<ClientTaskFormProps> = ({ clientId, monthYearRef, initialData, onTaskSaved, onClose }) => {
  const { session } = useSession();
  const userId = session?.user?.id;

  const form = useForm<ClientTaskFormValues>({
    resolver: zodResolver(clientTaskSchema),
    defaultValues: initialData ? {
      ...initialData,
      due_date: initialData.due_date ? parseISO(initialData.due_date) : undefined,
      selected_tag_ids: initialData.tags?.map(tag => tag.id) || [],
    } : {
      title: "",
      description: "",
      due_date: undefined,
      status: "backlog",
      selected_tag_ids: [],
      is_completed: false,
    },
  });

  const selectedTagIds = form.watch("selected_tag_ids") || [];

  const handleTagSelectionChange = (newSelectedTagIds: string[]) => {
    form.setValue("selected_tag_ids", newSelectedTagIds, { shouldDirty: true });
  };

  const onSubmit = async (values: ClientTaskFormValues) => {
    if (!userId) {
      showError("Usuário não autenticado.");
      return;
    }

    try {
      let clientTaskId: string;

      const dataToSave = {
        title: values.title,
        description: values.description || null,
        due_date: values.due_date ? format(values.due_date, "yyyy-MM-dd") : null,
        status: values.status,
        is_completed: values.is_completed,
        completed_at: values.is_completed ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      };

      if (initialData?.id) {
        const { data, error } = await supabase
          .from("client_tasks")
          .update(dataToSave)
          .eq("id", initialData.id)
          .eq("client_id", clientId)
          .eq("user_id", userId)
          .select("id")
          .single();

        if (error) throw error;
        clientTaskId = data.id;
        showSuccess("Tarefa do cliente atualizada com sucesso!");
      } else {
        const { data, error } = await supabase.from("client_tasks").insert({
          ...dataToSave,
          client_id: clientId,
          user_id: userId,
          month_year_reference: monthYearRef,
        }).select("id").single();

        if (error) throw error;
        clientTaskId = data.id;
        showSuccess("Tarefa do cliente adicionada com sucesso!");
      }

      await supabase.from("client_task_tags").delete().eq("client_task_id", clientTaskId);

      if (values.selected_tag_ids && values.selected_tag_ids.length > 0) {
        const clientTaskTagsToInsert = values.selected_tag_ids.map(tagId => ({
          client_task_id: clientTaskId,
          tag_id: tagId,
        }));
        const { error: tagInsertError } = await supabase.from("client_task_tags").insert(clientTaskTagsToInsert);
        if (tagInsertError) throw tagInsertError;
      }

      form.reset();
      onTaskSaved();
      onClose();
    } catch (error: any) {
      showError("Erro ao salvar tarefa do cliente: " + error.message);
      console.error("Erro ao salvar tarefa do cliente:", error);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-4 bg-card">
      <div>
        <Label htmlFor="title" className="text-foreground">Título da Tarefa</Label>
        <Input
          id="title"
          {...form.register("title")}
          placeholder="Ex: Criar 4 posts para Instagram"
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
          placeholder="Detalhes da tarefa..."
          className="w-full bg-input border-border text-foreground focus-visible:ring-ring"
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
        <Label htmlFor="status" className="text-foreground">Status</Label>
        <Select
          onValueChange={(value: ClientTaskStatus) => form.setValue("status", value)}
          value={form.watch("status")}
        >
          <SelectTrigger id="status" className="w-full bg-input border-border text-foreground focus-visible:ring-ring">
            <SelectValue placeholder="Selecionar status" />
          </SelectTrigger>
          <SelectContent className="bg-popover text-popover-foreground border-border rounded-md shadow-lg">
            <SelectItem value="backlog">Backlog</SelectItem>
            <SelectItem value="in_production">Em Produção</SelectItem>
            <SelectItem value="in_approval">Em Aprovação</SelectItem>
            <SelectItem value="approved">Aprovado</SelectItem>
            <SelectItem value="scheduled">Agendado</SelectItem>
            <SelectItem value="published">Publicado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="is_completed"
          checked={form.watch("is_completed")}
          onCheckedChange={(checked) => form.setValue("is_completed", checked as boolean)}
          className="border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
        />
        <Label htmlFor="is_completed" className="text-foreground">Concluída</Label>
      </div>

      <TagSelector
        selectedTagIds={selectedTagIds}
        onTagSelectionChange={handleTagSelectionChange}
      />

      <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
        {initialData?.id ? "Atualizar Tarefa" : "Adicionar Tarefa"}
      </Button>
    </form>
  );
};

export default ClientTaskForm;