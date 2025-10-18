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
import { CalendarIcon, Loader2, Image as ImageIcon, XCircle } from "lucide-react";
import { format, parseISO } from "date-fns"; // Importação corrigida
import { ptBR } from "date-fns/locale";
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
import TimePicker from "../TimePicker";
import { useSession } from "@/integrations/supabase/auth";
import TagSelector from "../TagSelector";
import { Checkbox } from "@/components/ui/checkbox";
import { ClientTask, ClientTaskStatus } from "@/types/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DIALOG_CONTENT_CLASSNAMES } from "@/lib/constants"; // Importar a constante

const clientTaskSchema = z.object({
  title: z.string().min(1, "O título da tarefa é obrigatório."),
  description: z.string().optional(),
  due_date: z.date().optional().nullable(),
  time: z.string().optional().nullable(),
  status: z.enum(["pending", "in_progress", "under_review", "approved", "rejected", "completed"]).default("pending"),
  selected_tag_ids: z.array(z.string()).optional(),
  is_standard_task: z.boolean().default(true), // Nova propriedade
  main_task_id: z.string().nullable().optional(), // Nova propriedade para subtarefas
  public_approval_enabled: z.boolean().default(false), // Nova propriedade
  public_approval_link_id: z.string().nullable().optional(), // NOVO: para armazenar o unique_id
});

export type ClientTaskFormValues = z.infer<typeof clientTaskSchema>;

interface ClientTaskFormProps {
  clientId: string;
  initialData?: Omit<ClientTaskFormValues, 'due_date'> & {
    id: string;
    due_date?: string | Date | null;
    tags?: { id: string; name: string; color: string }[];
  };
  onClientTaskSaved: () => void;
  onClose: () => void;
  initialDueDate?: Date;
  initialMainTaskId?: string; // Para criar subtarefas
}

interface MainTaskOption {
  id: string;
  title: string;
}

const fetchClientMainTasks = async (userId: string, clientId: string): Promise<MainTaskOption[]> => {
  const { data, error } = await supabase
    .from("client_tasks")
    .select("id, title")
    .eq("user_id", userId)
    .eq("client_id", clientId)
    .is("main_task_id", null) // Apenas tarefas principais
    .order("title", { ascending: true });
  if (error) {
    throw error;
  }
  return data || [];
};

const ClientTaskForm: React.FC<ClientTaskFormProps> = ({ clientId, initialData, onClientTaskSaved, onClose, initialDueDate, initialMainTaskId }) => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();

  const form = useForm<ClientTaskFormValues>({
    resolver: zodResolver(clientTaskSchema),
    defaultValues: initialData ? {
      ...initialData,
      due_date: initialData.due_date ? (typeof initialData.due_date === 'string' ? parseISO(initialData.due_date) : initialData.due_date) : undefined,
      time: initialData.time || undefined,
      selected_tag_ids: initialData.tags?.map(tag => tag.id) || [],
      is_standard_task: initialData.is_standard_task,
      main_task_id: initialData.main_task_id || initialMainTaskId || null,
      public_approval_enabled: initialData.public_approval_enabled,
      public_approval_link_id: initialData.public_approval_link_id || null, // Inicializar
    } : {
      title: "",
      description: "",
      due_date: initialDueDate || undefined,
      time: undefined,
      status: "pending",
      selected_tag_ids: [],
      is_standard_task: true,
      main_task_id: initialMainTaskId || null,
      public_approval_enabled: false,
      public_approval_link_id: null, // Inicializar
    },
  });

  const selectedTagIds = form.watch("selected_tag_ids") || [];
  const watchedMainTaskId = form.watch("main_task_id");
  const watchedPublicApprovalEnabled = form.watch("public_approval_enabled");

  const { data: clientMainTasks, isLoading: isLoadingClientMainTasks } = useQuery<MainTaskOption[], Error>({
    queryKey: ["clientMainTasks", userId, clientId],
    queryFn: () => fetchClientMainTasks(userId!, clientId),
    enabled: !!userId && !!clientId && !initialMainTaskId, // Habilitar apenas se não for subtarefa inicial
  });

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
      let publicApprovalLinkId: string | null = values.public_approval_link_id || null;

      // Gerar link de aprovação pública se habilitado e não existir
      if (values.public_approval_enabled && !publicApprovalLinkId) {
        const monthYearRef = values.due_date ? format(values.due_date, "yyyy-MM") : format(new Date(), "yyyy-MM");
        const { data: linkData, error: linkError } = await supabase.functions.invoke('generate-approval-link', {
          body: { clientId, monthYearRef },
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
          },
        });

        if (linkError) throw new Error(linkError.message || "Erro ao gerar link de aprovação pública.");
        publicApprovalLinkId = linkData.uniqueId;
        showSuccess("Link de aprovação pública gerado!");
      } else if (!values.public_approval_enabled && publicApprovalLinkId) {
        // Se desabilitado e um link existia, podemos considerar removê-lo ou apenas desvincular
        // Por simplicidade, vamos apenas desvincular aqui. A remoção real pode ser manual ou por política de expiração.
        publicApprovalLinkId = null;
      }

      const dataToSave = {
        client_id: clientId,
        title: values.title,
        description: values.description || null,
        due_date: values.due_date ? format(values.due_date, "yyyy-MM-dd") : null,
        time: values.time || null,
        status: values.status,
        is_completed: values.status === "completed" || values.status === "approved", // Marcar como concluída se status for 'completed' ou 'approved'
        completed_at: (values.status === "completed" || values.status === "approved") ? new Date().toISOString() : null,
        is_standard_task: values.is_standard_task,
        main_task_id: values.main_task_id || null,
        public_approval_enabled: values.public_approval_enabled,
        public_approval_link_id: publicApprovalLinkId, // Salvar o ID do link
        updated_at: new Date().toISOString(),
      };

      if (initialData) {
        const { data, error } = await supabase
          .from("client_tasks")
          .update(dataToSave)
          .eq("id", initialData.id)
          .eq("user_id", userId)
          .select("id")
          .single();

        if (error) throw error;
        clientTaskId = data.id;
        showSuccess("Tarefa do cliente atualizada com sucesso!");
      } else {
        const { data, error } = await supabase.from("client_tasks").insert({
          ...dataToSave,
          user_id: userId,
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
      onClientTaskSaved();
      onClose();
      queryClient.invalidateQueries({ queryKey: ["clientTasks", clientId, userId] });
      queryClient.invalidateQueries({ queryKey: ["clientMainTasks", userId, clientId] });
    } catch (error: any) {
      showError("Erro ao salvar tarefa do cliente: " + error.message);
      console.error("Erro ao salvar tarefa do cliente:", error);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-4 bg-card rounded-xl frosted-glass card-hover-effect">
      <div>
        <Label htmlFor="title" className="text-foreground">Título da Tarefa</Label>
        <Input
          id="title"
          {...form.register("title")}
          placeholder="Ex: Criar post para Instagram"
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
              <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
              {form.watch("due_date") ? (
                format(form.watch("due_date")!, "PPP", { locale: ptBR })
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
              locale={ptBR}
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
        <Label htmlFor="status" className="text-foreground">Status</Label>
        <Select
          onValueChange={(value: ClientTaskStatus) => form.setValue("status", value)}
          value={form.watch("status")}
        >
          <SelectTrigger id="status" className="w-full bg-input border-border text-foreground focus-visible:ring-ring">
            <SelectValue placeholder="Selecionar status" />
          </SelectTrigger>
          <SelectContent className="bg-popover text-popover-foreground border-border rounded-md shadow-lg">
            <SelectItem value="pending">Pendente</SelectItem>
            <SelectItem value="in_progress">Em Progresso</SelectItem>
            <SelectItem value="under_review">Em Revisão</SelectItem>
            <SelectItem value="approved">Aprovada</SelectItem>
            <SelectItem value="rejected">Rejeitada</SelectItem>
            <SelectItem value="completed">Concluída</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="is_standard_task"
          checked={form.watch("is_standard_task")}
          onCheckedChange={(checked) => form.setValue("is_standard_task", checked as boolean)}
          className="border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground flex-shrink-0"
        />
        <Label htmlFor="is_standard_task" className="text-foreground">Tarefa Padrão (aparece no Dashboard)</Label>
      </div>

      {!initialMainTaskId && ( // Só mostra a seleção de tarefa principal se não for uma subtarefa
        <div>
          <Label htmlFor="main_task_id" className="text-foreground">Tarefa Principal (Opcional)</Label>
          <Select
            onValueChange={(value: string) => form.setValue("main_task_id", value === "none-selected" ? null : value)}
            value={watchedMainTaskId || "none-selected"}
            disabled={isLoadingClientMainTasks}
          >
            <SelectTrigger id="main_task_id" className="w-full bg-input border-border text-foreground focus-visible:ring-ring">
              <SelectValue placeholder="Selecionar tarefa principal" />
            </SelectTrigger>
            <SelectContent className="bg-popover text-popover-foreground border-border rounded-md shadow-lg">
              <SelectItem value="none-selected">Nenhuma</SelectItem>
              {clientMainTasks?.map(task => (
                <SelectItem key={task.id} value={task.id}>{task.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex items-center space-x-2">
        <Checkbox
          id="public_approval_enabled"
          checked={watchedPublicApprovalEnabled}
          onCheckedChange={(checked) => form.setValue("public_approval_enabled", checked as boolean)}
          className="border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground flex-shrink-0"
        />
        <Label htmlFor="public_approval_enabled" className="text-foreground">Habilitar Aprovação Pública</Label>
      </div>

      <TagSelector
        selectedTagIds={selectedTagIds}
        onTagSelectionChange={handleTagSelectionChange}
      />

      <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90">{initialData ? "Atualizar Tarefa" : "Adicionar Tarefa"}</Button>
    </form>
  );
};

export default ClientTaskForm;