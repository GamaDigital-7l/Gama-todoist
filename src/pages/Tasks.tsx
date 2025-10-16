"use client";

import React from "react";
import TaskForm, { TaskFormValues } from "@/components/TaskForm";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { showError, showSuccess } from "@/utils/toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { getDay, isToday, isThisWeek, isThisMonth, parseISO, format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Trash2, Repeat, Clock, Edit, PlusCircle, Brain, BookOpen, Dumbbell, GraduationCap } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog"; // Importar DialogDescription
import { useSession } from "@/integrations/supabase/auth";
import { Badge } from "@/components/ui/badge";
import TaskObstacleCoach from "@/components/TaskObstacleCoach";
import { getAdjustedTaskCompletionStatus } from "@/utils/taskHelpers"; // Importar o helper

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface Task extends Omit<TaskFormValues, 'due_date' | 'recurrence_details'> {
  id: string;
  is_completed: boolean;
  created_at: string;
  updated_at: string;
  due_date?: string;
  recurrence_type: "none" | "daily" | "weekly" | "monthly";
  recurrence_details?: string | null;
  task_type: "general" | "reading" | "exercise" | "study";
  target_value?: number | null;
  last_successful_completion_date?: string | null; // Adicionado
  tags: Tag[];
}

const DAYS_OF_WEEK_MAP: { [key: string]: number } = {
  "Sunday": 0, "Monday": 1, "Tuesday": 2, "Wednesday": 3,
  "Thursday": 4, "Friday": 5, "Saturday": 6
};

const DAYS_OF_WEEK_LABELS: { [key: string]: string } = {
  "Sunday": "Dom", "Monday": "Seg", "Tuesday": "Ter", "Wednesday": "Qua",
  "Thursday": "Qui", "Friday": "Sex", "Saturday": "Sáb"
};


const fetchTasks = async (userId: string): Promise<Task[]> => {
  const { data, error } = await supabase
    .from("tasks", { schema: 'public' }) // Especificando o esquema
    .select(`
      *,
      tags (id, name, color)
    `)
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
  const [isObstacleCoachOpen, setIsObstacleCoachOpen] = React.useState(false);
  const [selectedTaskForCoach, setSelectedTaskForCoach] = React.useState<Task | undefined>(undefined);

  const handleToggleComplete = async (taskId: string, currentStatus: boolean) => {
    if (!userId) {
      showError("Usuário não autenticado.");
      return;
    }
    try {
      const { error } = await supabase
        .from("tasks", { schema: 'public' }) // Especificando o esquema
        .update({ 
          is_completed: !currentStatus, 
          updated_at: new Date().toISOString(),
          last_successful_completion_date: !currentStatus ? new Date().toISOString().split('T')[0] : null,
        })
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
        await supabase.from("task_tags", { schema: 'public' }).delete().eq("task_id", taskId); // Especificando o esquema

        const { error } = await supabase
          .from("tasks", { schema: 'public' }) // Especificando o esquema
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

  const handleOpenObstacleCoach = (task: Task) => {
    setSelectedTaskForCoach(task);
    setIsObstacleCoachOpen(true);
  };

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

  const filterTasks = (task: Task, filterType: "daily" | "weekly" | "monthly" | "all") => {
    const today = new Date();
    const currentDayOfWeek = getDay(today);
    const currentDayOfMonth = today.getDate().toString();

    const isDayIncluded = (details: string | null | undefined, dayIndex: number) => {
      if (!details) return false;
      const days = details.split(',');
      return days.some(day => DAYS_OF_WEEK_MAP[day] === dayIndex);
    };

    if (task.recurrence_type !== "none") {
      switch (filterType) {
        case "daily":
          return task.recurrence_type === "daily" || (task.recurrence_type === "weekly" && isDayIncluded(task.recurrence_details, currentDayOfWeek)) || (task.recurrence_type === "monthly" && task.recurrence_details === currentDayOfMonth);
        case "weekly":
          // Para tarefas semanais, incluir as diárias e as da semana atual
          return task.recurrence_type === "daily" || (task.recurrence_type === "weekly" && isDayIncluded(task.recurrence_details, currentDayOfWeek));
        case "monthly":
          // Para tarefas mensais, incluir as diárias, semanais e as do mês atual
          return task.recurrence_type === "daily" || (task.recurrence_type === "weekly" && isDayIncluded(task.recurrence_details, currentDayOfWeek)) || (task.recurrence_type === "monthly" && task.recurrence_details === currentDayOfMonth);
        case "all":
        default:
          return true;
      }
    }

    if (!task.due_date) return false;
    const dueDate = parseISO(task.due_date);

    switch (filterType) {
      case "daily":
        return isToday(dueDate);
      case "weekly":
        return isThisWeek(dueDate, { weekStartsOn: 0 });
      case "monthly":
        return isThisMonth(dueDate);
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
        {filteredTasks.map((task) => {
          const isTaskCompletedForPeriod = getAdjustedTaskCompletionStatus(task); // Usar o status ajustado
          return (
            <div key={task.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 border border-border rounded-md bg-background shadow-sm">
              <div className="flex items-center gap-3 flex-grow min-w-0">
                <Checkbox
                  id={`task-${task.id}`}
                  checked={isTaskCompletedForPeriod} // Usar o status ajustado
                  onCheckedChange={() => handleToggleComplete(task.id, isTaskCompletedForPeriod)} // Passar o status ajustado
                  className="border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                />
                <div className="grid gap-1.5 flex-grow min-w-0">
                  <label
                    htmlFor={`task-${task.id}`}
                    className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${
                      isTaskCompletedForPeriod ? "line-through text-muted-foreground" : "text-foreground" // Usar o status ajustado
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
                <Button variant="ghost" size="icon" onClick={() => handleOpenObstacleCoach(task)} className="text-purple-500 hover:bg-purple-500/10">
                  <Brain className="h-4 w-4" />
                  <span className="sr-only">Obter Ajuda da IA</span>
                </Button>
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
          );
        })}
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
      <div className="flex items-center justify-between flex-wrap gap-2">
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
              <DialogDescription className="text-muted-foreground">
                {editingTask ? "Atualize os detalhes da sua tarefa." : "Crie uma nova tarefa para organizar seu dia."}
              </DialogDescription>
            </DialogHeader>
            <TaskForm
              initialData={editingTask ? { ...editingTask, due_date: editingTask.due_date ? parseISO(editingTask.due_date) : undefined } : undefined}
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
              <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 bg-secondary/50 border border-border rounded-md">
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

      {selectedTaskForCoach && (
        <TaskObstacleCoach
          isOpen={isObstacleCoachOpen}
          onClose={() => setIsObstacleCoachOpen(false)}
          taskTitle={selectedTaskForCoach.title}
          taskDescription={selectedTaskForCoach.description}
        />
      )}
    </div>
  );
};

export default Tasks;