"use client";

import React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showError } from "@/utils/toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, AlertCircle } from "lucide-react";
import { useSession } from "@/integrations/supabase/auth";
import { Task, OriginBoard } from "@/types/task";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import TaskForm from "@/components/TaskForm";
import TaskItem from "@/components/TaskItem";
import { parseISO } from "date-fns";

interface TaskListBoardProps {
  title: string;
  tasks: Task[];
  isLoading: boolean;
  error: Error | null;
  refetchTasks: () => void;
  showAddButton?: boolean;
  quickAddTaskInput?: React.ReactNode;
  originBoard?: OriginBoard;
  selectedDate?: Date; // Nova prop
}

const TaskListBoard: React.FC<TaskListBoardProps> = ({
  title,
  tasks,
  isLoading,
  error,
  refetchTasks,
  showAddButton = false,
  quickAddTaskInput,
  originBoard = "general",
  selectedDate, // Recebe a data selecionada
}) => {
  const { session } = useSession();
  const queryClient = useQueryClient();

  const [isTaskFormOpen, setIsTaskFormOpen] = React.useState(false);
  const [editingTask, setEditingTask] = React.useState<Task | undefined>(undefined);

  const buildTaskTree = React.useCallback((allTasks: Task[]): Task[] => {
    const taskMap = new Map<string, Task>();
    allTasks.forEach(task => {
      taskMap.set(task.id, { ...task, subtasks: [] });
    });

    const rootTasks: Task[] = [];
    allTasks.forEach(task => {
      if (task.parent_task_id && taskMap.has(task.parent_task_id)) {
        taskMap.get(task.parent_task_id)?.subtasks?.push(taskMap.get(task.id)!);
      } else {
        rootTasks.push(taskMap.get(task.id)!);
      }
    });

    rootTasks.forEach(task => {
      if (task.subtasks) {
        task.subtasks.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      }
    });

    return rootTasks.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, []);

  const taskTree = React.useMemo(() => buildTaskTree(tasks), [tasks, buildTaskTree]);

  const overdueCount = tasks.filter(task => task.overdue).length;

  if (isLoading) {
    return (
      <Card className="w-full bg-card border border-border rounded-xl shadow-sm frosted-glass card-hover-effect">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-foreground">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Carregando tarefas...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full bg-card border border-border rounded-xl shadow-sm frosted-glass card-hover-effect">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-foreground">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-500">Erro ao carregar tarefas: {error.message}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full bg-card border border-border rounded-xl shadow-sm frosted-glass card-hover-effect">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 flex-wrap gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <CardTitle className="text-lg font-semibold text-foreground break-words">{title}</CardTitle>
          {overdueCount > 0 && (
            <span className="flex items-center gap-1 text-sm text-red-500 flex-shrink-0">
              <AlertCircle className="h-4 w-4" /> {overdueCount}
            </span>
          )}
        </div>
        {showAddButton && (
          <Dialog
            open={isTaskFormOpen}
            onOpenChange={(open) => {
              setIsTaskFormOpen(open);
              if (!open) setEditingTask(undefined);
            }}
          >
            <DialogTrigger asChild>
              <Button onClick={() => setEditingTask(undefined)} size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 flex-shrink-0">
                <PlusCircle className="mr-2 h-4 w-4" /> Adicionar
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] w-[90vw] bg-card border border-border rounded-lg shadow-lg max-h-[90vh] overflow-y-auto">
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
                initialOriginBoard={originBoard}
                initialDueDate={selectedDate} // Passa a data selecionada para o TaskForm
              />
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent>
        {quickAddTaskInput && <div className="mb-4">{quickAddTaskInput}</div>}
        {taskTree.length === 0 ? (
          <p className="text-muted-foreground">Nenhuma tarefa encontrada para este quadro.</p>
        ) : (
          <div className="space-y-3">
            {taskTree.map((task) => (
              <TaskItem key={task.id} task={task} refetchTasks={refetchTasks} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TaskListBoard;