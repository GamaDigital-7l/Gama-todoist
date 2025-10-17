"use client";

import React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { Button } from "@/components/ui/button";
import { Edit, Trash2, CalendarDays, CheckCircle2, AlertCircle, Clock, User } from "lucide-react"; // Adicionado User
import { useSession } from "@/integrations/supabase/auth";
import { ClientTask, ClientTaskStatus } from "@/types/client";
import { Badge } from "@/components/ui/badge";
import { format, parseISO, isPast, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

interface ClientTaskItemProps {
  task: ClientTask;
  refetchTasks: () => void;
  onEdit: (task: ClientTask) => void;
  onDragStart: (e: React.DragEvent, taskId: string, currentStatus: ClientTask['status']) => void;
}

const ClientTaskItem: React.FC<ClientTaskItemProps> = ({ task, refetchTasks, onEdit, onDragStart }) => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();

  const updateTaskCompletionMutation = useMutation({
    mutationFn: async ({ taskId, isCompleted }: { taskId: string; isCompleted: boolean }) => {
      if (!userId) {
        showError("Usuário não autenticado.");
        throw new Error("Usuário não autenticado.");
      }
      const { error } = await supabase
        .from("client_tasks")
        .update({
          is_completed: isCompleted,
          completed_at: isCompleted ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
          // Se for concluída, move para 'published' se não for já
          status: isCompleted && task.status !== 'published' ? 'published' : task.status,
        })
        .eq("id", taskId)
        .eq("client_id", task.client_id)
        .eq("user_id", userId);

      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Status da tarefa atualizado!");
      refetchTasks();
      queryClient.invalidateQueries({ queryKey: ["clientTasks", task.client_id, userId, task.month_year_reference] });
    },
    onError: (err: any) => {
      showError("Erro ao atualizar status da tarefa: " + err.message);
      console.error("Erro ao atualizar status da tarefa:", err);
    },
  });

  const handleDeleteTask = useMutation({
    mutationFn: async (taskId: string) => {
      if (!userId) {
        showError("Usuário não autenticado.");
        throw new Error("Usuário não autenticado.");
      }
      // Primeiro, deletar as associações de tags
      const { error: deleteTagsError } = await supabase
        .from("client_task_tags")
        .delete()
        .eq("client_task_id", taskId);
      if (deleteTagsError) throw deleteTagsError;

      // Depois, deletar a tarefa
      const { error } = await supabase
        .from("client_tasks")
        .delete()
        .eq("id", taskId)
        .eq("client_id", task.client_id)
        .eq("user_id", userId);

      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Tarefa do cliente deletada com sucesso!");
      refetchTasks();
      queryClient.invalidateQueries({ queryKey: ["clientTasks", task.client_id, userId, task.month_year_reference] });
    },
    onError: (err: any) => {
      showError("Erro ao deletar tarefa do cliente: " + err.message);
      console.error("Erro ao deletar tarefa do cliente:", err);
    },
  });

  const isOverdue = task.due_date && isPast(parseISO(task.due_date)) && !task.is_completed;
  const isAwaitingApproval = task.status === 'in_approval';
  const isScheduled = task.status === 'scheduled';
  const isApproved = task.status === 'approved';

  return (
    <div
      className={cn(
        "flex flex-col p-3 bg-background border rounded-md shadow-sm cursor-grab active:cursor-grabbing",
        isOverdue ? "border-red-500 bg-red-500/10" : "border-border",
        task.is_completed && "opacity-70"
      )}
      draggable="true"
      onDragStart={(e) => onDragStart(e, task.id, task.status)}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <Checkbox
            id={`client-task-${task.id}`}
            checked={task.is_completed}
            onCheckedChange={(checked) => updateTaskCompletionMutation.mutate({ taskId: task.id, isCompleted: checked as boolean })}
            className="border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
            disabled={task.status === 'published'} // Não pode desmarcar se já publicado
          />
          <label
            htmlFor={`client-task-${task.id}`}
            className={cn(
              "text-sm font-medium leading-none text-foreground",
              task.is_completed && "line-through text-muted-foreground"
            )}
          >
            {isOverdue && <AlertCircle className="h-4 w-4 text-red-500 inline-block mr-1" />}
            {task.title}
          </label>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => onEdit(task)} className="h-7 w-7 text-blue-500 hover:bg-blue-500/10">
            <Edit className="h-4 w-4" />
            <span className="sr-only">Editar Tarefa</span>
          </Button>
          <Button variant="ghost" size="icon" onClick={() => handleDeleteTask.mutate(task.id)} className="h-7 w-7 text-red-500 hover:bg-red-500/10">
            <Trash2 className="h-4 w-4" />
            <span className="sr-only">Deletar Tarefa</span>
          </Button>
        </div>
      </div>
      {task.description && (
        <p className="text-xs text-muted-foreground mb-2 break-words">{task.description}</p>
      )}
      {task.due_date && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <CalendarDays className="h-3 w-3" /> Vencimento: {format(parseISO(task.due_date), "PPP", { locale: ptBR })}
        </p>
      )}
      {task.time && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Clock className="h-3 w-3" /> Horário: {task.time}
        </p>
      )}
      {task.responsible && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <User className="h-3 w-3" /> Responsável: {task.responsible.first_name} {task.responsible.last_name}
        </p>
      )}
      {isAwaitingApproval && (
        <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-500 border-yellow-500/50 mb-2 w-fit">
          Aguardando Aprovação
        </Badge>
      )}
      {isApproved && task.due_date && !isToday(parseISO(task.due_date)) && (
        <Badge variant="secondary" className="bg-green-500/20 text-green-500 border-green-500/50 mb-2 w-fit">
          Prazo Agendamento: {format(parseISO(task.due_date), "dd/MM")}
        </Badge>
      )}
      {isScheduled && task.due_date && (
        <Badge variant="secondary" className="bg-purple-500/20 text-purple-500 border-purple-500/50 mb-2 w-fit">
          Agendado para: {format(parseISO(task.due_date), "PPP", { locale: ptBR })}
        </Badge>
      )}
      {task.tags && task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-auto">
          {task.tags.map((tag) => (
            <Badge key={tag.id} style={{ backgroundColor: tag.color, color: '#FFFFFF' }} className="text-xs">
              {tag.name}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
};

export default ClientTaskItem;