"use client";

import React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { Checkbox } from "@/components/ui/checkbox";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Repeat, Clock, Edit, Trash2, PlusCircle, AlertCircle } from "lucide-react"; // Adicionado AlertCircle
import { useSession } from "@/integrations/supabase/auth";
import { Badge } from "@/components/ui/badge";
import { getAdjustedTaskCompletionStatus } from "@/utils/taskHelpers";
import { Task, DAYS_OF_WEEK_LABELS, OriginBoard } from "@/types/task";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import TaskForm from "@/components/TaskForm";
import { cn } from "@/lib/utils"; // Importar cn

interface TaskItemProps {
  task: Task;
  refetchTasks: () => void;
  level?: number; // Para indentação de subtarefas
}

const POINTS_PER_TASK = 10;

const TaskItem: React.FC<TaskItemProps> = ({ task, refetchTasks, level = 0 }) => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();

  const [isTaskFormOpen, setIsTaskFormOpen] = React.useState(false);
  const [editingTask, setEditingTask] = React.useState<Task | undefined>(undefined);
  const [isSubtaskFormOpen, setIsSubtaskFormOpen] = React.useState(false);

  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, currentStatus }: { taskId: string; currentStatus: boolean }) => {
      if (!userId) {
        showError("Usuário não autenticado.");
        throw new Error("Usuário não autenticado.");
      }

      const { data: taskToUpdate, error: fetchTaskError } = await supabase
        .from("tasks")
        .select("recurrence_type, origin_board")
        .eq("id", taskId)
        .single();

      if (fetchTaskError) throw fetchTaskError;

      let newOriginBoard = taskToUpdate.origin_board;
      let completedAt = null;
      let lastSuccessfulCompletionDate = null;

      if (!currentStatus) { // Se a tarefa está sendo marcada como concluída
        completedAt = new Date().toISOString();
        lastSuccessfulCompletionDate = new Date().toISOString().split('T')[0];
        if (taskToUpdate.recurrence_type === "none") {
          newOriginBoard = "concluidas"; // Mover para o quadro de finalizadas se não for recorrente
        }
      } else { // Se a tarefa está sendo desmarcada
        completedAt = null;
        lastSuccessfulCompletionDate = null;
        if (taskToUpdate.recurrence_type === "none") {
          newOriginBoard = "general"; // Mover de volta para geral se não for recorrente
        }
      }

      const { error: updateError } = await supabase
        .from("tasks")
        .update({
          is_completed: !currentStatus,
          updated_at: new Date().toISOString(),
          last_successful_completion_date: lastSuccessfulCompletionDate,
          completed_at: completedAt,
          origin_board: newOriginBoard,
        })
        .eq("id", taskId)
        .eq("user_id", userId); // Adicionado user_id para segurança

      if (updateError) throw updateError;

      if (!currentStatus) { // Se a tarefa foi marcada como concluída, adicionar pontos
        const { data: profileData, error: fetchProfileError } = await supabase
          .from("profiles")
          .select("points")
          .eq("id", userId)
          .single();

        let currentPoints = 0;
        if (profileData) {
          currentPoints = profileData.points || 0;
        }

        const newPoints = currentPoints + POINTS_PER_TASK;
        const { error: pointsError } = await supabase
          .from("profiles")
          .update({ points: newPoints, updated_at: new Date().toISOString() })
          .eq("id", userId);

        if (pointsError) throw pointsError;
      }
    },
    onSuccess: (_, variables) => {
      showSuccess("Tarefa atualizada com sucesso!");
      // Invalidação de cache mais granular
      queryClient.invalidateQueries({ queryKey: ["allTasks", userId] });
      queryClient.invalidateQueries({ queryKey: ["userProfile", userId] });
      queryClient.invalidateQueries({ queryKey: ["dashboardTasks", variables.currentStatus ? "concluidas" : task.origin_board, userId] }); // Invalida o board de origem
      queryClient.invalidateQueries({ queryKey: ["dashboardTasks", variables.currentStatus ? task.origin_board : "concluidas", userId] }); // Invalida o board de destino
      queryClient.invalidateQueries({ queryKey: ["dailyPlannerTasks", userId] }); // Invalida tarefas do planner
      refetchTasks(); // Refetch local para atualizar a lista
    },
    onError: (err: any) => {
      showError("Erro ao atualizar tarefa: " + err.message);
      console.error("Erro ao atualizar tarefa:", err);
    },
  });

  const handleDeleteTask = async (taskId: string) => {
    if (!session?.user?.id) {
      showError("Usuário não autenticado.");
      return;
    }
    if (window.confirm("Tem certeza que deseja deletar esta tarefa e todas as suas subtarefas?")) {
      try {
        await supabase.from("task_tags").delete().eq("task_id", taskId);

        const { error } = await supabase
          .from("tasks")
          .delete()
          .eq("id", taskId)
          .eq("user_id", session.user.id);

        if (error) throw error;
        showSuccess("Tarefa deletada com sucesso!");
        // Invalidação de cache mais granular
        queryClient.invalidateQueries({ queryKey: ["allTasks", userId] });
        queryClient.invalidateQueries({ queryKey: ["dashboardTasks", task.origin_board, userId] });
        queryClient.invalidateQueries({ queryKey: ["dailyPlannerTasks", userId] });
        refetchTasks();
      } catch (err: any) {
        showError("Erro ao deletar tarefa: " + err.message);
        console.error("Erro ao deletar tarefa:", err);
      }
    }
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setIsTaskFormOpen(true);
  };

  const getRecurrenceText = (task: Task) => {
    switch (task.recurrence_type) {
      case "daily":
        return "Recorre Diariamente";
      case "weekly":
        const days = task.recurrence_rule?.split(',').map(day => DAYS_OF_WEEK_LABELS[day] || day).join(', ');
        return `Recorre Semanalmente nos dias: ${days}`;
      case "monthly":
        return `Recorre Mensalmente no dia ${task.recurrence_rule}`;
      case "none":
      default:
        return null;
    }
  };

  const isTaskCompletedForPeriod = getAdjustedTaskCompletionStatus(task);

  return (
    <div className={`space-y-2 ${level > 0 ? 'ml-4 border-l pl-2 border-border' : ''}`}> {/* Ajustado ml e pl para subtarefas */}
      <div className={cn(
        "flex flex-col sm:flex-row sm:items-center sm:justify-between rounded-xl shadow-sm transition-all duration-300",
        level === 0 ? "p-3 border border-border bg-card frosted-glass" : "p-2 bg-secondary/20"
      )}>
        <div className="flex items-center gap-3 flex-grow min-w-0">
          <Checkbox
            id={`task-${task.id}`}
            checked={isTaskCompletedForPeriod}
            onCheckedChange={() => updateTaskMutation.mutate({ taskId: task.id, currentStatus: isTaskCompletedForPeriod })}
            className="border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
          />
          <div className="grid gap-1.5 flex-grow min-w-0">
            <label
              htmlFor={`task-${task.id}`}
              className={cn(
                "font-semibold leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
                isTaskCompletedForPeriod ? "line-through text-muted-foreground" : "text-foreground",
                level === 0 ? "text-base" : "text-sm" // Texto menor para subtarefas
              )}
            >
              {task.origin_board === 'atrasadas' && (
                <AlertCircle className="h-4 w-4 text-red-500 inline-block mr-1 icon-glow" />
              )}
              {task.title}
            </label>
            {task.description && (
              <p className={cn(
                "text-muted-foreground break-words",
                level === 0 ? "text-sm" : "text-xs" // Texto menor para subtarefas
              )}>{task.description}</p>
            )}
            {task.due_date && task.recurrence_type === "none" && (
              <p className={cn(
                "text-xs text-muted-foreground",
                level > 0 && "text-[0.65rem]" // Ainda menor para subtarefas aninhadas
              )}>
                Vencimento: {format(parseISO(task.due_date), "PPP", { locale: ptBR })}
              </p>
            )}
            {task.time && (
              <p className={cn(
                "text-xs text-muted-foreground flex items-center gap-1",
                level > 0 && "text-[0.65rem]"
              )}>
                <Clock className={cn("h-3 w-3 text-primary", level > 0 && "h-2.5 w-2.5")} /> {task.time}
              </p>
            )}
            {task.recurrence_type !== "none" && (
              <p className={cn(
                "text-xs text-muted-foreground flex items-center gap-1",
                level > 0 && "text-[0.65rem]"
              )}>
                <Repeat className={cn("h-3 w-3 text-primary", level > 0 && "h-2.5 w-2.5")} /> {getRecurrenceText(task)}
              </p>
            )}
            {task.tags && task.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {task.tags.map((tag) => (
                  <Badge key={tag.id} style={{ backgroundColor: tag.color, color: '#FFFFFF' }} className="text-xs rounded-md">
                    {tag.name}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 mt-2 sm:mt-0 flex-shrink-0">
          <Dialog
            open={isSubtaskFormOpen}
            onOpenChange={(open) => {
              setIsSubtaskFormOpen(open);
            }}
          >
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="text-green-500 hover:bg-green-500/10 btn-glow">
                <PlusCircle className="h-4 w-4" />
                <span className="sr-only">Adicionar Subtarefa</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] w-[90vw] bg-card border border-border rounded-2xl shadow-xl frosted-glass">
              <DialogHeader>
                <DialogTitle className="text-foreground">Adicionar Subtarefa para "{task.title}"</DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  Crie uma nova subtarefa para detalhar a tarefa principal.
                </DialogDescription>
              </DialogHeader>
              <TaskForm
                onTaskSaved={refetchTasks}
                onClose={() => setIsSubtaskFormOpen(false)}
                initialOriginBoard={task.origin_board}
                initialParentTaskId={task.id}
              />
            </DialogContent>
          </Dialog>

          <Button variant="ghost" size="icon" onClick={() => handleEditTask(task)} className="text-blue-500 hover:bg-blue-500/10 btn-glow">
            <Edit className="h-4 w-4" />
            <span className="sr-only">Editar Tarefa</span>
          </Button>
          <Button variant="ghost" size="icon" onClick={() => handleDeleteTask(task.id)} className="text-red-500 hover:bg-red-500/10 btn-glow">
            <Trash2 className="h-4 w-4" />
            <span className="sr-only">Deletar Tarefa</span>
          </Button>
        </div>
      </div>

      {task.subtasks && task.subtasks.length > 0 && (
        <div className="space-y-2">
          {task.subtasks.map(subtask => (
            <TaskItem key={subtask.id} task={subtask} refetchTasks={refetchTasks} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
};

export default TaskItem;