"use client";

import React, { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { Client, ClientTask, ClientTaskStatus, ClientTaskGenerationTemplate } from "@/types/client";
import ClientKanbanColumn from "@/components/client/ClientKanbanColumn";
import ClientKanbanHeader from "@/components/client/ClientKanbanHeader";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useSession } from "@/integrations/supabase/auth";
import { Button } from "@/components/ui/button";
import { PlusCircle, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import ClientTaskForm from "@/components/client/ClientTaskForm";
import { DndContext, DragEndEvent, closestCorners } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { DIALOG_CONTENT_CLASSNAMES } from "@/lib/constants";

interface ClientKanbanPageProps {
  client: Client;
}

const fetchClientTasks = async (clientId: string, userId: string, month: Date): Promise<ClientTask[]> => {
  const start = format(startOfMonth(month), "yyyy-MM-dd");
  const end = format(endOfMonth(month), "yyyy-MM-dd");

  const { data, error } = await supabase
    .from("client_tasks")
    .select(`
      id, title, description, due_date, time, status, is_completed, created_at, updated_at, completed_at,
      is_standard_task, main_task_id, public_approval_enabled,
      client_task_tags(
        tags(id, name, color)
      ),
      subtasks:client_tasks!main_task_id(
        id, title, description, due_date, time, status, is_completed, created_at, updated_at, completed_at,
        is_standard_task, main_task_id, public_approval_enabled,
        client_task_tags(
          tags(id, name, color)
        )
      )
    `)
    .eq("client_id", clientId)
    .eq("user_id", userId)
    .gte("due_date", start)
    .lte("due_date", end)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  const mappedData = data?.map((task: any) => ({
    ...task,
    tags: task.client_task_tags.map((ctt: any) => ctt.tags),
    subtasks: task.subtasks.map((subtask: any) => ({
      ...subtask,
      tags: subtask.client_task_tags.map((stt: any) => stt.tags),
    })),
  })) || [];

  // Filter out subtasks from the main list, they will be nested
  const mainTasks = mappedData.filter(task => !task.main_task_id);

  return mainTasks;
};

const fetchClientTaskTemplates = async (clientId: string, userId: string): Promise<ClientTaskGenerationTemplate[]> => {
  const { data, error } = await supabase
    .from("client_task_generation_templates")
    .select(`
      id, template_name, description, due_date_offset_days, time, is_priority, created_at, updated_at
      // Removed client_task_tags join as it's not directly on templates
    `)
    .eq("client_id", clientId)
    .eq("user_id", userId)
    .order("template_name", { ascending: true });

  if (error) {
    console.error("Erro ao carregar templates:", error);
    throw error;
  }
  return data || [];
};


const ClientKanbanPage: React.FC<ClientKanbanPageProps> = ({ client }) => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<ClientTask | undefined>(undefined);

  const { data: clientTasks, isLoading, error, refetch } = useQuery<ClientTask[], Error>({
    queryKey: ["clientTasks", client.id, userId, currentMonth.toISOString()],
    queryFn: () => fetchClientTasks(client.id, userId!, currentMonth),
    enabled: !!userId && !!client.id,
  });

  const { data: templates, isLoading: isLoadingTemplates, error: templatesError } = useQuery<ClientTaskGenerationTemplate[], Error>({
    queryKey: ["clientTaskTemplates", client.id, userId],
    queryFn: () => fetchClientTaskTemplates(client.id, userId!),
    enabled: !!userId && !!client.id,
  });

  const handleClientTaskSaved = () => {
    refetch();
    setIsTaskFormOpen(false);
    setEditingTask(undefined);
  };

  const handleEditClientTask = (task: ClientTask) => {
    setEditingTask(task);
    setIsTaskFormOpen(true);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const activeContainer = active.data.current?.sortable.containerId as ClientTaskStatus;
    const overContainer = over.data.current?.sortable.containerId as ClientTaskStatus;

    const draggedTask = clientTasks?.find(task => task.id === active.id);
    if (!draggedTask) return;

    // If moving between columns (status change)
    if (activeContainer !== overContainer) {
      try {
        await supabase
          .from("client_tasks")
          .update({ status: overContainer, updated_at: new Date().toISOString() })
          .eq("id", active.id)
          .eq("user_id", userId);
        showSuccess(`Tarefa movida para ${overContainer.replace('_', ' ')}!`);
        refetch(); // Refetch all tasks to update the UI
      } catch (err: any) {
        showError("Erro ao mover tarefa: " + err.message);
        console.error("Erro ao mover tarefa:", err);
      }
    } else {
      // If reordering within the same column (not implemented for now, but structure is here)
      // For now, we just refetch to ensure consistency if status change was the only intent
      refetch();
    }
  };

  const getTasksByStatus = useMemo(() => {
    const tasksByStatus: Record<ClientTaskStatus, ClientTask[]> = {
      pending: [],
      in_progress: [],
      under_review: [],
      approved: [],
      rejected: [],
      completed: [],
    };

    clientTasks?.forEach(task => {
      if (tasksByStatus[task.status]) {
        tasksByStatus[task.status].push(task);
      }
    });
    return tasksByStatus;
  }, [clientTasks]);

  const allDaysInMonth = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  });

  const remainingTasksCount = useMemo(() => {
    if (client.monthly_delivery_goal === null || client.monthly_delivery_goal === 0) return 0;
    const completedTasks = clientTasks?.filter(task => task.is_completed).length || 0;
    return Math.max(0, client.monthly_delivery_goal - completedTasks);
  }, [clientTasks, client.monthly_delivery_goal]);

  const handleGenerateTasksFromTemplates = async () => {
    if (!userId) {
      showError("Usuário não autenticado.");
      return;
    }
    if (!templates || templates.length === 0) {
      showError("Nenhum template de tarefa encontrado para este cliente.");
      return;
    }

    if (!window.confirm(`Tem certeza que deseja gerar tarefas para ${format(currentMonth, "MMMM yyyy", { locale: ptBR })} com base nos templates? Isso pode criar várias tarefas.`)) {
      return;
    }

    try {
      const tasksToInsert = [];
      const existingTasksForMonth = clientTasks?.map(task => ({
        title: task.title,
        due_date: task.due_date,
      })) || [];

      for (const template of templates) {
        const templateDueDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
        templateDueDate.setDate(templateDueDate.getDate() + (template.due_date_offset_days || 0));

        const formattedDueDate = format(templateDueDate, "yyyy-MM-dd");

        // Evitar duplicação: verificar se já existe uma tarefa com o mesmo título e data de vencimento
        const isDuplicate = existingTasksForMonth.some(
          task => task.title === template.template_name && task.due_date === formattedDueDate
        );

        if (!isDuplicate) {
          tasksToInsert.push({
            user_id: userId,
            client_id: client.id,
            title: template.template_name,
            description: template.description,
            due_date: formattedDueDate,
            time: template.time,
            status: "pending" as ClientTaskStatus,
            is_completed: false,
            is_standard_task: true, // Templates geram tarefas padrão
            is_priority: template.is_priority,
            public_approval_enabled: false, // Padrão para false ao gerar de template
          });
        }
      }

      if (tasksToInsert.length > 0) {
        const { error: insertError } = await supabase.from("client_tasks").insert(tasksToInsert);
        if (insertError) throw insertError;
        showSuccess(`${tasksToInsert.length} tarefas geradas com sucesso a partir dos templates!`);
        refetch();
      } else {
        showSuccess("Nenhuma nova tarefa para gerar a partir dos templates (possíveis duplicatas ou nenhum template aplicável).");
      }
    } catch (err: any) {
      showError("Erro ao gerar tarefas a partir dos templates: " + err.message);
      console.error("Erro ao gerar tarefas a partir dos templates:", err);
    }
  };

  if (isLoading || isLoadingTemplates) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 md:px-10 lg:p-6">
        <h1 className="text-3xl font-bold text-foreground">Kanban do Cliente</h1>
        <p className="text-lg text-muted-foreground">Carregando tarefas do cliente...</p>
      </div>
    );
  }

  if (error) {
    showError("Erro ao carregar tarefas do cliente: " + error.message);
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 md:px-10 lg:p-6">
        <h1 className="text-3xl font-bold text-foreground">Kanban do Cliente</h1>
        <p className="text-lg text-red-500">Erro ao carregar tarefas do cliente: {error.message}</p>
      </div>
    );
  }

  if (templatesError) {
    showError("Erro ao carregar templates de tarefas: " + templatesError.message);
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 md:px-10 lg:p-6">
        <h1 className="text-3xl font-bold text-foreground">Kanban do Cliente</h1>
        <p className="text-lg text-red-500">Erro ao carregar templates de tarefas: {templatesError.message}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:px-10 lg:p-6">
      <ClientKanbanHeader
        client={client}
        currentMonth={currentMonth}
        setCurrentMonth={setCurrentMonth}
        remainingTasks={remainingTasksCount}
        onGenerateTasks={handleGenerateTasksFromTemplates}
      />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between flex-wrap gap-2">
        <h2 className="text-2xl font-bold text-foreground">Tarefas do Mês</h2>
        <Dialog
          open={isTaskFormOpen}
          onOpenChange={(open) => {
            setIsTaskFormOpen(open);
            if (!open) setEditingTask(undefined);
          }}
        >
          <DialogTrigger asChild>
            <Button onClick={() => setEditingTask(undefined)} className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90">
              <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Tarefa
            </Button>
          </DialogTrigger>
          <DialogContent className={DIALOG_CONTENT_CLASSNAMES}>
            <DialogHeader>
              <DialogTitle className="text-foreground">
                {editingTask ? "Editar Tarefa do Cliente" : "Adicionar Nova Tarefa do Cliente"}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                {editingTask ? "Atualize os detalhes da tarefa do cliente." : "Crie uma nova tarefa para este cliente."}
              </DialogDescription>
            </DialogHeader>
            <ClientTaskForm
              clientId={client.id}
              initialData={editingTask ? { ...editingTask, due_date: editingTask.due_date ? parseISO(editingTask.due_date) : undefined } : undefined}
              onClientTaskSaved={handleClientTaskSaved}
              onClose={() => setIsTaskFormOpen(false)}
              initialDueDate={currentMonth}
            />
          </DialogContent>
        </Dialog>
      </div>

      <DndContext onDragEnd={handleDragEnd} collisionDetection={closestCorners}>
        <div className="flex flex-grow overflow-x-auto pb-4 custom-scrollbar">
          <div className="flex space-x-4 min-h-[calc(100vh-250px)]">
            <ClientKanbanColumn
              id="pending"
              title="Pendente"
              tasks={getTasksByStatus.pending}
              refetchClientTasks={refetch}
              clientId={client.id}
            />
            <ClientKanbanColumn
              id="in_progress"
              title="Em Progresso"
              tasks={getTasksByStatus.in_progress}
              refetchClientTasks={refetch}
              clientId={client.id}
            />
            <ClientKanbanColumn
              id="under_review"
              title="Em Revisão"
              tasks={getTasksByStatus.under_review}
              refetchClientTasks={refetch}
              clientId={client.id}
            />
            <ClientKanbanColumn
              id="approved"
              title="Aprovada"
              tasks={getTasksByStatus.approved}
              refetchClientTasks={refetch}
              clientId={client.id}
            />
            <ClientKanbanColumn
              id="rejected"
              title="Rejeitada"
              tasks={getTasksByStatus.rejected}
              refetchClientTasks={refetch}
              clientId={client.id}
            />
            <ClientKanbanColumn
              id="completed"
              title="Concluída"
              tasks={getTasksByStatus.completed}
              refetchClientTasks={refetch}
              clientId={client.id}
            />
          </div>
        </div>
      </DndContext>
    </div>
  );
};

export default ClientKanbanPage;