"use client";

import React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { Checkbox } from "@/components/ui/checkbox";
import { format, parseISO, isPast, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Edit, Trash2, PlusCircle, CalendarDays, AlertCircle, Link as LinkIcon, Eye, ChevronDown, ChevronRight } from "lucide-react";
import { useSession } from "@/integrations/supabase/auth";
import { Badge } from "@/components/ui/badge";
import { ClientTask, ClientTaskStatus } from "@/types/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import ClientTaskForm from "@/components/client/ClientTaskForm";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ClientTaskItemProps {
  clientTask: ClientTask;
  refetchClientTasks: () => void;
  clientId: string;
  level?: number; // Para indentação de subtarefas
}

const ClientTaskItem: React.FC<ClientTaskItemProps> = ({ clientTask, refetchClientTasks, clientId, level = 0 }) => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();

  const [isTaskFormOpen, setIsTaskFormOpen] = React.useState(false);
  const [editingTask, setEditingTask] = React.useState<ClientTask | undefined>(undefined);
  const [isSubtaskFormOpen, setIsSubtaskFormOpen] = React.useState(false);
  const [isSubtasksExpanded, setIsSubtasksExpanded] = React.useState(true); // Estado para expandir/colapsar subtarefas

  const updateClientTaskMutation = useMutation({
    mutationFn: async ({ taskId, newStatus, isCompletedToggle }: { taskId: string; newStatus?: ClientTaskStatus; isCompletedToggle?: boolean }) => {
      if (!userId) {
        showError("Usuário não autenticado.");
        throw new Error("Usuário não autenticado.");
      }

      let updateData: Partial<ClientTask> = { updated_at: new Date().toISOString() };

      if (newStatus) {
        updateData.status = newStatus;
        if (newStatus === "completed") {
          updateData.is_completed = true;
          updateData.completed_at = new Date().toISOString();
        } else if (clientTask.is_completed && newStatus !== "completed") {
          // If status is changed from completed to something else, unmark as completed
          updateData.is_completed = false;
          updateData.completed_at = null;
        }
      } else if (isCompletedToggle !== undefined) {
        updateData.is_completed = isCompletedToggle;
        updateData.completed_at = isCompletedToggle ? new Date().toISOString() : null;
        if (isCompletedToggle) {
          updateData.status = "completed";
        } else if (clientTask.status === "completed") {
          // If uncompleted, revert status to pending or previous if available
          updateData.status = "pending"; // Or a more sophisticated logic
        }
      }

      const { error: updateError } = await supabase
        .from("client_tasks")
        .update(updateData)
        .eq("id", taskId)
        .eq("user_id", userId);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      showSuccess("Tarefa do cliente atualizada com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["clientTasks", clientId, userId] });
      queryClient.invalidateQueries({ queryKey: ["dashboardTasks", "client_tasks", userId] }); // Invalida o dashboard de tarefas de cliente
      refetchClientTasks();
    },
    onError: (err: any) => {
      showError("Erro ao atualizar tarefa do cliente: " + err.message);
      console.error("Erro ao atualizar tarefa do cliente:", err);
    },
  });

  const handleDeleteClientTask = async (taskId: string) => {
    if (!session?.user?.id) {
      showError("Usuário não autenticado.");
      return;
    }
    if (window.confirm("Tem certeza que deseja deletar esta tarefa do cliente e todas as suas subtarefas?")) {
      try {
        await supabase.from("client_task_tags").delete().eq("client_task_id", taskId);

        const { error } = await supabase
          .from("client_tasks")
          .delete()
          .eq("id", taskId)
          .eq("user_id", session.user.id);

        if (error) throw error;
        showSuccess("Tarefa do cliente deletada com sucesso!");
        queryClient.invalidateQueries({ queryKey: ["clientTasks", clientId, userId] });
        queryClient.invalidateQueries({ queryKey: ["dashboardTasks", "client_tasks", userId] });
        refetchClientTasks();
      } catch (err: any) {
        showError("Erro ao deletar tarefa do cliente: " + err.message);
        console.error("Erro ao deletar tarefa do cliente:", err);
      }
    }
  };

  const handleEditClientTask = (task: ClientTask) => {
    setEditingTask(task);
    setIsTaskFormOpen(true);
  };

  const getStatusColor = (status: ClientTaskStatus) => {
    switch (status) {
      case "pending": return "bg-gray-500/20 text-gray-500 border-gray-500/50";
      case "in_progress": return "bg-blue-500/20 text-blue-500 border-blue-500/50";
      case "under_review": return "bg-yellow-500/20 text-yellow-500 border-yellow-500/50";
      case "approved": return "bg-green-500/20 text-green-500 border-green-500/50";
      case "rejected": return "bg-red-500/20 text-red-500 border-red-500/50";
      case "completed": return "bg-purple-500/20 text-purple-500 border-purple-500/50";
      default: return "bg-gray-500/20 text-gray-500 border-gray-500/50";
    }
  };

  const getStatusText = (status: ClientTaskStatus) => {
    switch (status) {
      case "pending": return "Pendente";
      case "in_progress": return "Em Progresso";
      case "under_review": return "Em Revisão";
      case "approved": return "Aprovada";
      case "rejected": return "Rejeitada";
      case "completed": return "Concluída";
      default: return "Desconhecido";
    }
  };

  const isOverdue = clientTask.due_date && isPast(parseISO(clientTask.due_date)) && !clientTask.is_completed;
  const isDueToday = clientTask.due_date && isToday(parseISO(clientTask.due_date)) && !clientTask.is_completed;

  const publicApprovalLink = clientTask.public_approval_enabled && clientTask.id
    ? `${window.location.origin}/public-approval/${clientTask.id}`
    : null;

  return (
    <div className={`space-y-2 ${level > 0 ? 'ml-4 border-l pl-2 border-border' : ''}`}>
      <div className={cn(
        "flex flex-col sm:flex-row sm:items-center sm:justify-between rounded-xl shadow-sm frosted-glass card-hover-effect",
        level === 0 ? "p-3 border border-border bg-background" : "p-2 bg-muted/20"
      )}>
        <div className="flex items-center gap-3 flex-grow min-w-0">
          <Checkbox
            id={`client-task-${clientTask.id}`}
            checked={clientTask.is_completed}
            onCheckedChange={(checked) => updateClientTaskMutation.mutate({ taskId: clientTask.id, isCompletedToggle: checked as boolean })}
            className="border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground flex-shrink-0"
          />
          <div className="grid gap-1.5 flex-grow min-w-0">
            <label
              htmlFor={`client-task-${clientTask.id}`}
              className={cn(
                "font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 break-words",
                clientTask.is_completed ? "line-through text-muted-foreground" : "text-foreground",
                level === 0 ? "text-sm md:text-base" : "text-xs md:text-sm"
              )}
            >
              {isOverdue && (
                <AlertCircle className="h-4 w-4 text-red-500 inline-block mr-1 flex-shrink-0" />
              )}
              {isDueToday && !isOverdue && (
                <AlertCircle className="h-4 w-4 text-orange-500 inline-block mr-1 flex-shrink-0" />
              )}
              {clientTask.title}
            </label>
            {clientTask.description && (
              <p className={cn(
                "text-muted-foreground break-words",
                level === 0 ? "text-sm md:text-base" : "text-xs md:text-sm"
              )}>{clientTask.description}</p>
            )}
            {clientTask.due_date && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <CalendarDays className="h-3 w-3" /> Vencimento: {format(parseISO(clientTask.due_date), "PPP", { locale: ptBR })}
              </p>
            )}
            {clientTask.time && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" /> Horário: {clientTask.time}
              </p>
            )}
            <Badge variant="secondary" className={cn("w-fit flex items-center gap-1 mt-1 text-xs md:text-sm", getStatusColor(clientTask.status))}>
              Status: {getStatusText(clientTask.status)}
            </Badge>
            {clientTask.tags && clientTask.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {clientTask.tags.map((tag) => (
                  <Badge key={tag.id} style={{ backgroundColor: tag.color, color: '#FFFFFF' }} className="text-xs flex-shrink-0">
                    {tag.name}
                  </Badge>
                ))}
              </div>
            )}
            {publicApprovalLink && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <a href={publicApprovalLink} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline flex items-center gap-1 mt-1">
                      <LinkIcon className="h-3 w-3 flex-shrink-0" /> Link de Aprovação Pública
                    </a>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Clique para abrir o link de aprovação pública.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 mt-2 sm:mt-0 flex-shrink-0">
          {clientTask.subtasks && clientTask.subtasks.length > 0 && (
            <Button variant="ghost" size="icon" onClick={() => setIsSubtasksExpanded(!isSubtasksExpanded)} className="text-muted-foreground hover:bg-accent hover:text-accent-foreground">
              {isSubtasksExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <span className="sr-only">{isSubtasksExpanded ? "Colapsar Subtarefas" : "Expandir Subtarefas"}</span>
            </Button>
          )}
          <Dialog
            open={isSubtaskFormOpen}
            onOpenChange={(open) => {
              setIsSubtaskFormOpen(open);
            }}
          >
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="text-green-500 hover:bg-green-500/10">
                <PlusCircle className="h-4 w-4" />
                <span className="sr-only">Adicionar Subtarefa</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] w-[90vw] bg-card border border-border rounded-lg shadow-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-foreground">Adicionar Subtarefa para "{clientTask.title}"</DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  Crie uma nova subtarefa para detalhar a tarefa principal.
                </DialogDescription>
              </DialogHeader>
              <ClientTaskForm
                clientId={clientId}
                onClientTaskSaved={refetchClientTasks}
                onClose={() => setIsSubtaskFormOpen(false)}
                initialMainTaskId={clientTask.id}
              />
            </DialogContent>
          </Dialog>

          <Button variant="ghost" size="icon" onClick={() => handleEditClientTask(clientTask)} className="text-blue-500 hover:bg-blue-500/10">
            <Edit className="h-4 w-4" />
            <span className="sr-only">Editar Tarefa</span>
          </Button>
          <Button variant="ghost" size="icon" onClick={() => handleDeleteClientTask(clientTask.id)} className="text-red-500 hover:bg-red-500/10">
            <Trash2 className="h-4 w-4" />
            <span className="sr-only">Deletar Tarefa</span>
          </Button>
        </div>
      </div>

      {clientTask.subtasks && clientTask.subtasks.length > 0 && isSubtasksExpanded && (
        <div className="space-y-2">
          {clientTask.subtasks.map(subtask => (
            <ClientTaskItem key={subtask.id} clientTask={subtask} refetchClientTasks={refetchClientTasks} clientId={clientId} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
};

export default ClientTaskItem;