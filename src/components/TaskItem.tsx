import React, { useState } from "react";
import { Task, Tag, DAYS_OF_WEEK_MAP, DAYS_OF_WEEK_LABELS, TemplateTask, TemplateFormOriginBoard } from "@/types/task";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Trash2, Repeat, Clock, Edit, PlusCircle, BookOpen, Dumbbell, GraduationCap, Loader2 } from "lucide-react"; // Adicionado Loader2
import { format, isPast, isToday, isTomorrow, isThisWeek, isThisMonth, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import TaskForm from "@/components/TaskForm";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { getAdjustedTaskCompletionStatus } from "@/utils/taskHelpers";
import { DIALOG_CONTENT_CLASSNAMES } from "@/lib/constants";

interface TaskItemProps {
  task: Task;
  refetchTasks: () => void;
  isSubtask?: boolean;
}

const TaskItem: React.FC<TaskItemProps> = ({ task, refetchTasks, isSubtask = false }) => {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false); // Estado para feedback de conclusão

  const completeTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      setIsCompleting(true); // Inicia o feedback de loading
      const { data: taskToUpdate, error: fetchTaskError } = await supabase
        .from("tasks")
        .select("recurrence_type, origin_board, current_board, is_priority, overdue, user_id")
        .eq("id", taskId)
        .single();

      if (fetchTaskError) throw fetchTaskError;

      let newCurrentBoard = taskToUpdate.current_board;
      let newOverdueStatus = taskToUpdate.overdue;
      let completedAt = new Date().toISOString();
      let lastSuccessfulCompletionDate = new Date().toISOString().split('T')[0];
      
      if (taskToUpdate.recurrence_type === "none") {
        newCurrentBoard = "completed";
        newOverdueStatus = false;
      }

      const { error: updateError } = await supabase
        .from("tasks")
        .update({
          is_completed: true,
          updated_at: new Date().toISOString(),
          last_successful_completion_date: lastSuccessfulCompletionDate,
          completed_at: completedAt,
          current_board: newCurrentBoard,
          overdue: newOverdueStatus,
        })
        .eq("id", taskId)
        .eq("user_id", taskToUpdate.user_id); // Usar user_id da tarefa

      if (updateError) throw updateError;

      const { data: profileData, error: fetchProfileError } = await supabase
        .from("profiles")
        .select("points")
        .eq("id", taskToUpdate.user_id)
        .single();

      let currentPoints = 0;
      if (profileData) {
        currentPoints = profileData.points || 0;
      }

      const newPoints = currentPoints + 10; 
      const { error: pointsError } = await supabase
        .from("profiles")
        .update({ points: newPoints, updated_at: new Date().toISOString() })
        .eq("id", taskToUpdate.user_id);

      if (pointsError) throw pointsError;
    },
    onSuccess: () => {
      showSuccess("Tarefa concluída com sucesso!");
      refetchTasks();
    },
    onError: (err: any) => {
      showError("Erro ao concluir tarefa: " + err.message);
      console.error("Erro ao concluir tarefa:", err);
    },
    onSettled: () => {
      setIsCompleting(false); // Finaliza o feedback de loading
    }
  });

  const handleDeleteTask = async (taskId: string) => {
    if (window.confirm("Tem certeza que deseja deletar esta tarefa?")) {
      try {
        await supabase.from("task_tags").delete().eq("task_id", taskId);

        const { error } = await supabase
          .from("tasks")
          .delete()
          .eq("id", taskId);

        if (error) throw error;
        showSuccess("Tarefa deletada com sucesso!");
        refetchTasks();
      } catch (err: any) {
        showError("Erro ao deletar tarefa: " + err.message);
        console.error("Erro ao deletar tarefa:", err);
      }
    }
  };

  const status = getAdjustedTaskCompletionStatus(task);

  const getStatusBadge = () => {
    switch (status) {
      case "overdue":
        return <Badge variant="destructive" className="bg-status-overdue text-white">Atrasada</Badge>;
      case "today_priority":
      case "today_no_priority":
        return <Badge className="bg-status-today text-white">Hoje</Badge>;
      case "urgent":
        return <Badge className="bg-status-urgent text-white">Urgente</Badge>;
      case "completed":
        return <Badge className="bg-status-completed text-white">Concluída</Badge>;
      case "recurring":
        return <Badge className="bg-status-recurring text-white">Recorrente</Badge>;
      default:
        return null;
    }
  };

  const getDueDateDisplay = () => {
    if (!task.due_date) return "Sem data";
    const dueDate = parseISO(task.due_date);
    if (isToday(dueDate)) return "Hoje";
    if (isTomorrow(dueDate)) return "Amanhã";
    if (isPast(dueDate) && !task.is_completed) return `Atrasada (${format(dueDate, 'dd/MM')})`;
    return format(dueDate, 'dd/MM/yyyy', { locale: ptBR });
  };

  const getRecurrenceDisplay = () => {
    if (task.recurrence_type === "daily") return "Diariamente";
    if (task.recurrence_type === "weekly" && task.recurrence_details) {
      const days = task.recurrence_details.split(',').map(dayKey => DAYS_OF_WEEK_LABELS[dayKey]).join(', ');
      return `Semanalmente: ${days}`;
    }
    if (task.recurrence_type === "monthly" && task.recurrence_details) return `Mensalmente: Dia ${task.recurrence_details}`;
    return "";
  };

  return (
    <Card className={`bg-card border border-border rounded-xl shadow-sm frosted-glass ${isSubtask ? 'ml-6' : 'card-hover-effect'}`}>
      <CardContent className="p-4 flex items-start space-x-3">
        <Checkbox
          id={`task-${task.id}`}
          checked={task.is_completed || isCompleting}
          onCheckedChange={() => completeTaskMutation.mutate(task.id)}
          disabled={isCompleting || task.is_completed}
          className="mt-1"
        />
        <div className="flex-1">
          <label
            htmlFor={`task-${task.id}`}
            className={`text-lg font-semibold leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${task.is_completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}
          >
            {task.title}
          </label>
          {task.description && (
            <p className={`text-sm text-muted-foreground mt-1 ${task.is_completed ? 'line-through' : ''}`}>
              {task.description}
            </p>
          )}
          <div className="flex flex-wrap gap-2 mt-2">
            {getStatusBadge()}
            {task.due_date && <Badge variant="outline" className="flex items-center gap-1 text-muted-foreground"><Clock className="h-3 w-3" /> {getDueDateDisplay()}</Badge>}
            {task.recurrence_type !== "none" && <Badge variant="outline" className="flex items-center gap-1 text-muted-foreground"><Repeat className="h-3 w-3" /> {getRecurrenceDisplay()}</Badge>}
            {task.tags && task.tags.map((tag) => (
              <Badge key={tag.id} style={{ backgroundColor: tag.color, color: 'white' }}>{tag.name}</Badge>
            ))}
          </div>
          {task.subtasks && task.subtasks.length > 0 && (
            <div className="mt-4 space-y-3">
              <p className="text-sm font-semibold text-muted-foreground">Subtarefas:</p>
              {task.subtasks.map((subtask) => (
                <TaskItem key={subtask.id} task={subtask} refetchTasks={refetchTasks} isSubtask={true} />
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!task.is_completed && (
            <Dialog
              open={isEditing}
              onOpenChange={(open) => {
                setIsEditing(open);
              }}
            >
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" onClick={() => setIsEditing(true)}>
                  <Edit className="h-4 w-4 text-muted-foreground hover:text-primary" />
                </Button>
              </DialogTrigger>
              <DialogContent className={DIALOG_CONTENT_CLASSNAMES}>
                <DialogHeader>
                  <DialogTitle className="text-foreground">Editar Tarefa</DialogTitle>
                  <DialogDescription className="text-muted-foreground">
                    Atualize os detalhes da sua tarefa.
                  </DialogDescription>
                </DialogHeader>
                <TaskForm
                  initialData={{ ...task, due_date: task.due_date ? new Date(task.due_date) : undefined }}
                  onTaskSaved={refetchTasks}
                  onClose={() => setIsEditing(false)}
                />
              </DialogContent>
            </Dialog>
          )}
          <Button variant="ghost" size="icon" onClick={() => handleDeleteTask(task.id)}>
            <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default TaskItem;