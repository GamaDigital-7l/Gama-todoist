"use client";

import React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { Checkbox } from "@/components/ui/checkbox";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Repeat, Clock, Edit, Trash2, BookOpen, Dumbbell, GraduationCap, PlusCircle } from "lucide-react";
import { useSession } from "@/integrations/supabase/auth";
import { Badge } from "@/components/ui/badge";
import { getAdjustedTaskCompletionStatus } from "@/utils/taskHelpers";
import { Task, DAYS_OF_WEEK_LABELS, OriginBoard } from "@/types/task";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import TaskForm from "@/components/TaskForm";

interface TaskItemProps {
  task: Task;
  refetchTasks: () => void;
  level?: number; // Para indentação de subtarefas
}

const POINTS_PER_TASK = 10;

const TaskItem: React.FC<TaskItemProps> = ({ task, refetchTasks, level = 0 }) => {
  const { session } = useSession();
  const queryClient = useQueryClient();

  const [isTaskFormOpen, setIsTaskFormOpen] = React.useState(false);
  const [editingTask, setEditingTask] = React.useState<Task | undefined>(undefined);
  const [isSubtaskFormOpen, setIsSubtaskFormOpen] = React.useState(false);

  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, currentStatus }: { taskId: string; currentStatus: boolean }) => {
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
          newOriginBoard = "completed"; // Mover para o quadro de finalizadas se não for recorrente
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
        .eq("id", taskId);

      if (updateError) throw updateError;

      if (!currentStatus && session?.user?.id) { // Se a tarefa foi marcada como concluída
        let currentPoints = 0;
        const { data: existingProfile, error: fetchProfileError } = await supabase
          .from("profiles")
          .select("points")
          .eq("id", session.user.id)
          .single();

        if (fetchProfileError && fetchProfileError.code !== 'PGRST116') {
          throw fetchProfileError;
        }

        if (existingProfile) {
          currentPoints = existingProfile.points || 0;
        } else {
          const { error: insertProfileError } = await supabase
            .from("profiles")
            .insert({ id: session.user.id, points: 0 });

          if (insertProfileError) {
            throw insertProfileError;
          }
        }

        const newPoints = currentPoints + POINTS_PER_TASK;
        const { error: pointsError } = await supabase
          .from("profiles")
          .update({ points: newPoints })
          .eq("id", session.user.id);

        if (pointsError) throw pointsError;
        queryClient.invalidateQueries({ queryKey: ["userProfile"] });
      }
    },
    onSuccess: () => {
      refetchTasks();
      queryClient.invalidateQueries({ queryKey: ["dashboardTasks"] }); // Invalida todas as tarefas da dashboard
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
        // Deletar task_tags associadas
        await supabase.from("task_tags").delete().eq("task_id", taskId);

        // Deletar a tarefa (ON DELETE CASCADE cuidará das subtarefas)
        const { error } = await supabase
          .from("tasks")
          .delete()
          .eq("id", taskId)
          .eq("user_id", session.user.id);

        if (error) throw error;
        showSuccess("Tarefa deletada com sucesso!");
        refetchTasks();
        queryClient.invalidateQueries({ queryKey: ["dashboardTasks"] });
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

  // handleOpenObstacleCoach removido

  const getRecurrenceText = (task: Task) => {
    switch (task.recurrence_type) {
      case "daily":
        return "Recorre Diariamente";
      case "weekly":
        const days = task.recurrence_details?.split(',').map(day => DAYS_OF_WEEK_LABELS[day] || day).join(', ');
        return `Recorre Semanalmente nos dias: ${days}`;
      case "monthly":
        return `Recorre Mensalmente no dia ${task.recurrence_details}`;
      case "none":
      default:
        return null;
    }
  };

  const getTaskTypeIcon = (taskType: Task['task_type']) => {
    switch (taskType) {
      case "reading": return <BookOpen className="h-3 w-3" />;
      case "exercise": return <Dumbbell className="h-3 w-3" />;
      case "study": return <GraduationCap className="h-3 w-3" />;
      default: return null;
    }
  };

  const getTaskTypeLabel = (taskType: Task['task_type'], targetValue: number | null | undefined) => {
    if (targetValue === null || targetValue === undefined) return null;
    switch (taskType) {
      case "reading": return `Meta: ${targetValue} páginas`;
      case "exercise": return `Meta: ${targetValue} minutos/reps`;
      case "study": return `Meta: ${targetValue} minutos de estudo`;
      default: return null;
    }
  };

  const isTaskCompletedForPeriod = getAdjustedTaskCompletionStatus(task);

  return (
    <div className={`space-y-3 ${level > 0 ? 'ml-6 border-l pl-3 border-border' : ''}`}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 border border-border rounded-md bg-background shadow-sm">
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
              className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${
                isTaskCompletedForPeriod ? "line-through text-muted-foreground" : "text-foreground"
              }`}
            >
              {task.title}
            </label>
            {task.description && (
              <p className="text-sm text-muted-foreground break-words">{task.description}</p>
            )}
            {task.due_date && task.recurrence_type === "none" && (
              <p className="text-xs text-muted-foreground">
                Vencimento: {format(parseISO(task.due_date), "PPP", { locale: ptBR })}
              </p>
            )}
            {task.time && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" /> {task.time}
              </p>
            )}
            {task.recurrence_type !== "none" && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Repeat className="h-3 w-3" /> {getRecurrenceText(task)}
              </p>
            )}
            {(task.task_type === "reading" || task.task_type === "exercise" || task.task_type === "study") && task.target_value !== null && task.target_value !== undefined && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                {getTaskTypeIcon(task.task_type)} {getTaskTypeLabel(task.task_type, task.target_value)}
              </p>
            )}
            {task.tags && task.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {task.tags.map((tag) => (
                  <Badge key={tag.id} style={{ backgroundColor: tag.color, color: '#FFFFFF' }} className="text-xs">
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
              <Button variant="ghost" size="icon" className="text-green-500 hover:bg-green-500/10">
                <PlusCircle className="h-4 w-4" />
                <span className="sr-only">Adicionar Subtarefa</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] w-[90vw] bg-card border border-border rounded-lg shadow-lg">
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

          {/* Botão de IA removido */}
          <Button variant="ghost" size="icon" onClick={() => handleEditTask(task)} className="text-blue-500 hover:bg-blue-500/10">
            <Edit className="h-4 w-4" />
            <span className="sr-only">Editar Tarefa</span>
          </Button>
          <Button variant="ghost" size="icon" onClick={() => handleDeleteTask(task.id)} className="text-red-500 hover:bg-red-500/10">
            <Trash2 className="h-4 w-4" />
            <span className="sr-only">Deletar Tarefa</span>
          </Button>
        </div>
      </div>

      {/* TaskObstacleCoach removido */}

      {isTaskFormOpen && (
        <Dialog
          open={isTaskFormOpen}
          onOpenChange={(open) => {
            setIsTaskFormOpen(open);
            if (!open) setEditingTask(undefined);
          }}
        >
          <DialogContent className="sm:max-w-[425px] w-[90vw] bg-card border border-border rounded-lg shadow-lg">
            <DialogHeader>
              <DialogTitle className="text-foreground">{editingTask ? "Editar Tarefa" : "Adicionar Nova Tarefa"}</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                {editingTask ? "Atualize os detalhes da sua tarefa." : "Crie uma nova tarefa para organizar seu dia."}
              </DialogDescription>
            </DialogHeader>
            <TaskForm
              initialData={editingTask ? { ...editingTask, due_date: editingTask.due_date ? parseISO(editingTask.due_date) : undefined } : undefined}
              onTaskSaved={refetchTasks}
              onClose={() => setIsTaskFormOpen(false)}
              initialOriginBoard={task.origin_board}
            />
          </DialogContent>
        </Dialog>
      )}

      {task.subtasks && task.subtasks.length > 0 && (
        <div className="space-y-3">
          {task.subtasks.map(subtask => (
            <TaskItem key={subtask.id} task={subtask} refetchTasks={refetchTasks} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
};

export default TaskItem;