"use client";

import React from "react";
import TaskForm, { TaskFormValues } from "@/components/TaskForm";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { showError, showSuccess } from "@/utils/toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { format, isToday, isThisWeek, isThisMonth, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Trash2, Repeat, Clock, Edit, PlusCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useSession } from "@/integrations/supabase/auth";

interface Task extends TaskFormValues {
  id: string;
  is_completed: boolean;
  created_at: string;
  updated_at: string;
}

const fetchTasks = async (userId: string): Promise<Task[]> => {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) {
    throw error;
  }
  return data || [];
};

const Tasks: React.FC = () => {
  const { session } = useSession();
  const userId = session?.user?.id;

  const { data: tasks, isLoading, error, refetch } = useQuery<Task[], Error>({
    queryKey: ["tasks", userId],
    queryFn: () => fetchTasks(userId!),
    enabled: !!userId,
  });

  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [editingTask, setEditingTask] = React.useState<Task | undefined>(undefined);

  const handleToggleComplete = async (taskId: string, currentStatus: boolean) => {
    if (!userId) {
      showError("Usuário não autenticado.");
      return;
    }
    try {
      const { error } = await supabase
        .from("tasks")
        .update({ is_completed: !currentStatus, updated_at: new Date().toISOString() })
        .eq("id", taskId)
        .eq("user_id", userId);

      if (error) throw error;
      showSuccess("Tarefa atualizada com sucesso!");
      refetch();
    } catch (err: any) {
      showError("Erro ao atualizar tarefa: " + err.message);
      console.error("Erro ao atualizar tarefa:", err);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!userId) {
      showError("Usuário não autenticado.");
      return;
    }
    if (window.confirm("Tem certeza que deseja deletar esta tarefa?")) {
      try {
        const { error } = await supabase
          .from("tasks")
          .delete()
          .eq("id", taskId)
          .eq("user_id", userId);

        if (error) throw error;
        showSuccess("Tarefa deletada com sucesso!");
        refetch();
      } catch (err: any) {
        showError("Erro ao deletar tarefa: " + err.message);
        console.error("Erro ao deletar tarefa:", err);
      }
    }
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setIsFormOpen(true);
  };

  const getRecurrenceText = (task: Task) => {
    switch (task.recurrence_type) {
      case "daily_weekday":
        return "Recorre de Segunda a Sexta";
      case "weekly":
        return `Recorre Semanalmente às ${task.recurrence_details}`;
      case "monthly":
        return `Recorre Mensalmente no dia ${task.recurrence_details}`;
      case "none":
      default:
        return null;
    }
  };

  const filterTasks = (task: Task, filterType: "daily" | "weekly" | "monthly" | "all") => {
    // Lógica para tarefas recorrentes
    if (task.recurrence_type !== "none") {
      const today = new Date();
      const currentDayOfWeek = format(today, "EEEE", { locale: ptBR }); // Ex: "Segunda-feira"
      const currentDayOfMonth = today.getDate().toString();

      switch (task.recurrence_type) {
        case "daily_weekday":
          return filterType === "daily" && today.getDay() >= 1 && today.getDay() <= 5; // Seg-Sex
        case "weekly":
          return filterType === "weekly" && task.recurrence_details?.toLowerCase() === currentDayOfWeek.toLowerCase();
        case "monthly":
          return filterType === "monthly" && task.recurrence_details === currentDayOfMonth;
        default:
          return filterType === "all";
      }
    }

    // Lógica para tarefas com data de vencimento única
    if (!task.due_date) return false;
    const dueDate = parseISO(task.due_date);

    switch (filterType) {
      case "daily":
        return isToday(dueDate);
      case "weekly":
        return isThisWeek(dueDate, { locale: ptBR });
      case "monthly":
        return isThisMonth(dueDate, { locale: ptBR });
      case "all":
      default:
        return true;
    }
  };

  const renderTaskList = (filteredTasks: Task[]) => {
    if (filteredTasks.length === 0) {
      return <p className="text-muted-foreground">Nenhuma tarefa encontrada para esta categoria.</p>;
    }
    return (
      <div className="space-y-3">
        {filteredTasks.map((task) => (
          <div key={task.id} className="flex items-center justify-between p-3 border border-border rounded-md bg-background shadow-sm">
            <div className="flex items-center gap-3">
              <Checkbox
                id={`task-${task.id}`}
                checked={task.is_completed}
                onCheckedChange={() => handleToggleComplete(task.id, task.is_completed)}
                className="border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
              />
              <div className="grid gap-1.5">
                <label
                  htmlFor={`task-${task.id}`}
                  className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${
                    task.is_completed ? "line-through text-muted-foreground" : "text-foreground"
                  }`}
                >
                  {task.title}
                </label>
                {task.description && (
                  <p className="text-sm text-muted-foreground">{task.description}</p>
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
              </div>
            </div>
            <div className="flex items-center gap-2">
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
        ))}
      </div>
    );
  };

  if (isLoading) return <p className="text-muted-foreground">Carregando tarefas...</p>;
  if (error) return <p className="text-red-500">Erro ao carregar tarefas: {error.message}</p>;

  const dailyTasks = tasks?.filter((task) => filterTasks(task, "daily")) || [];
  const weeklyTasks = tasks?.filter((task) => filterTasks(task, "weekly")) || [];
  const monthlyTasks = tasks?.filter((task) => filterTasks(task, "monthly")) || [];
  const allTasks = tasks || [];

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">Suas Tarefas</h1>
        <Dialog
          open={isFormOpen}
          onOpenChange={(open) => {
            setIsFormOpen(open);
            if (!open) setEditingTask(undefined);
          }}
        >
          <DialogTrigger asChild>
            <Button onClick={() => setEditingTask(undefined)} className="bg-primary text-primary-foreground hover:bg-primary/90">
              <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Tarefa
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px] bg-card border border-border rounded-lg shadow-lg">
            <DialogHeader>
              <DialogTitle className="text-foreground">{editingTask ? "Editar Tarefa" : "Adicionar Nova Tarefa"}</DialogTitle>
            </DialogHeader>
            <TaskForm
              initialData={editingTask}
              onTaskSaved={refetch}
              onClose={() => setIsFormOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>
      <p className="text-lg text-muted-foreground">
        Organize suas tarefas diárias, semanais e mensais aqui.
      </p>

      <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-2">
        <Card className="bg-card border border-border rounded-lg shadow-sm">
          <CardHeader>
            <CardTitle className="text-foreground">Minhas Tarefas</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="daily" className="w-full">
              <TabsList className="grid w-full grid-cols-4 bg-secondary/50 border border-border rounded-md">
                <TabsTrigger value="daily" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm data-[state=active]:border-primary/50 rounded-md">Diárias</TabsTrigger>
                <TabsTrigger value="weekly" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm data-[state=active]:border-primary/50 rounded-md">Semanais</TabsTrigger>
                <TabsTrigger value="monthly" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm data-[state=active]:border-primary/50 rounded-md">Mensais</TabsTrigger>
                <TabsTrigger value="all" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm data-[state=active]:border-primary/50 rounded-md">Todas</TabsTrigger>
              </TabsList>
              <div className="mt-4">
                <TabsContent value="daily">{renderTaskList(dailyTasks)}</TabsContent>
                <TabsContent value="weekly">{renderTaskList(weeklyTasks)}</TabsContent>
                <TabsContent value="monthly">{renderTaskList(monthlyTasks)}</TabsContent>
                <TabsContent value="all">{renderTaskList(allTasks)}</TabsContent>
              </div>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* MadeWithDyad removido */}
    </div>
  );
};

export default Tasks;