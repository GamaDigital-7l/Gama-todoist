"use client";

import React from "react";
import TaskForm from "@/components/TaskForm";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query"; // Adicionado useQueryClient
import { showError, showSuccess } from "@/utils/toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { getDay, isToday, isThisWeek, isThisMonth, parseISO, format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Trash2, Repeat, Clock, Edit, PlusCircle, BookOpen, Dumbbell, GraduationCap } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { useSession } from "@/integrations/supabase/auth";
import { Badge } from "@/components/ui/badge";
import { getAdjustedTaskCompletionStatus } from "@/utils/taskHelpers";
import { Task, Tag, DAYS_OF_WEEK_MAP, DAYS_OF_WEEK_LABELS, TemplateTask, TemplateFormOriginBoard } from "@/types/task";
import TaskItem from "@/components/TaskItem";
import TemplateTaskForm from "@/components/TemplateTaskForm";
import TemplateTaskItem from "@/components/TemplateTaskItem";

const fetchTasks = async (userId: string): Promise<Task[]> => {
  const { data, error } = await supabase
    .from("tasks")
    .select(`
      *,
      task_tags(
        tags(id, name, color)
      )
    `)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) {
    throw error;
  }
  const mappedData = data?.map((task: any) => ({
    ...task,
    tags: task.task_tags.map((tt: any) => tt.tags),
  })) || [];
  return mappedData;
};

const fetchTemplateTasks = async (userId: string): Promise<TemplateTask[]> => {
  const { data, error } = await supabase
    .from("template_tasks")
    .select(`
      *,
      template_task_tags(
        tags(id, name, color)
      )
    `)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) {
    throw error;
  }
  const mappedData = data?.map((templateTask: any) => ({
    ...templateTask,
    tags: templateTask.template_task_tags.map((ttt: any) => ttt.tags),
  })) || [];
  return mappedData;
};

const Tasks: React.FC = () => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const queryClient = useQueryClient(); // Inicializado useQueryClient

  const { data: tasks, isLoading, error, refetch } = useQuery<Task[], Error>({
    queryKey: ["tasks", userId],
    queryFn: () => fetchTasks(userId!),
    enabled: !!userId,
  });

  const { data: templateTasks, isLoading: isLoadingTemplateTasks, error: errorTemplateTasks, refetch: refetchTemplateTasks } = useQuery<TemplateTask[], Error>({
    queryKey: ["templateTasks", userId],
    queryFn: () => fetchTemplateTasks(userId!),
    enabled: !!userId,
  });

  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [editingTask, setEditingTask] = React.useState<Task | undefined>(undefined);

  const [isTemplateFormOpen, setIsTemplateFormOpen] = React.useState(false);
  const [editingTemplateTask, setEditingTemplateTask] = React.useState<TemplateTask | undefined>(undefined);

  const handleTaskUpdated = () => {
    refetch(); // Refetch all tasks for this page
    queryClient.invalidateQueries({ queryKey: ["dashboardTasks", userId] }); // Invalida todas as queries do dashboard
    queryClient.invalidateQueries({ queryKey: ["allTasks", userId] }); // Invalida a query de todas as tarefas
    queryClient.invalidateQueries({ queryKey: ["dailyPlannerTasks", userId] }); // Invalida tarefas do planner
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!userId) {
      showError("Usuário não autenticado.");
      return;
    }
    if (window.confirm("Tem certeza que deseja deletar esta tarefa?")) {
      try {
        await supabase.from("task_tags").delete().eq("task_id", taskId);

        const { error } = await supabase
          .from("tasks")
          .delete()
          .eq("id", taskId)
          .eq("user_id", userId);

        if (error) throw error;
        showSuccess("Tarefa deletada com sucesso!");
        handleTaskUpdated(); // Chama a função de atualização
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

  const filterTasks = (task: Task, filterType: "daily" | "weekly" | "monthly" | "all") => {
    const today = new Date();
    const currentDayOfWeek = getDay(today);
    const currentDayOfMonth = today.getDate().toString();

    const isDayIncluded = (details: string | null | undefined, dayIndex: number) => {
      if (!details) return false;
      const days = details.split(',');
      return days.some(day => DAYS_OF_WEEK_MAP[day] === dayIndex);
    };

    if (filterType === "daily") {
      return task.origin_board === "today_priority" || task.origin_board === "today_no_priority" || task.origin_board === "jobs_woe_today";
    }

    if (task.recurrence_type !== "none") {
      switch (filterType) {
        case "weekly":
          return task.recurrence_type === "daily" || (task.recurrence_type === "weekly" && isDayIncluded(task.recurrence_details, currentDayOfWeek));
        case "monthly":
          return task.recurrence_type === "daily" || (task.recurrence_type === "weekly" && isDayIncluded(task.recurrence_details, currentDayOfWeek)) || (task.recurrence_type === "monthly" && task.recurrence_details === currentDayOfMonth);
        case "all":
        default:
          return true;
      }
    }

    if (!task.due_date) return false;
    const dueDate = parseISO(task.due_date);

    switch (filterType) {
      case "weekly":
        return isThisWeek(dueDate, { weekStartsOn: 0 });
      case "monthly":
        return isThisMonth(dueDate);
      case "all":
      default:
        return true;
    }
  };

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

  const taskTree = React.useMemo(() => buildTaskTree(tasks || []), [tasks, buildTaskTree]);

  const renderTaskList = (filteredTasks: Task[]) => {
    const filteredTaskTree = React.useMemo(() => buildTaskTree(filteredTasks), [filteredTasks, buildTaskTree]);
    if (filteredTaskTree.length === 0) {
      return <p className="text-muted-foreground">Nenhuma tarefa encontrada para esta categoria.</p>;
    }
    return (
      <div className="space-y-3">
        {filteredTaskTree.map((task) => (
          <TaskItem key={task.id} task={task} refetchTasks={handleTaskUpdated} />
        ))}
      </div>
    );
  };

  const renderTemplateTaskList = (templateTasks: TemplateTask[]) => {
    if (templateTasks.length === 0) {
      return <p className="text-muted-foreground">Nenhuma tarefa padrão encontrada. Adicione uma para automatizar seu dia!</p>;
    }
    return (
      <div className="space-y-3">
        {templateTasks.map((templateTask) => (
          <TemplateTaskItem key={templateTask.id} templateTask={templateTask} refetchTemplateTasks={refetchTemplateTasks} />
        ))}
      </div>
    );
  };

  if (isLoading || isLoadingTemplateTasks) return <p className="text-muted-foreground">Carregando tarefas...</p>;
  if (error) return <p className="text-red-500">Erro ao carregar tarefas: {error.message}</p>;
  if (errorTemplateTasks) return <p className="text-red-500">Erro ao carregar tarefas padrão: {errorTemplateTasks.message}</p>;

  const dailyTasks = tasks?.filter((task) => filterTasks(task, "daily")) || [];
  const weeklyTasks = tasks?.filter((task) => filterTasks(task, "weekly")) || [];
  const monthlyTasks = tasks?.filter((task) => filterTasks(task, "monthly")) || [];
  const allTasks = tasks || [];

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between flex-wrap gap-2">
        <h1 className="text-3xl font-bold text-foreground">Suas Tarefas</h1>
        <Dialog
          open={isFormOpen}
          onOpenChange={(open) => {
            setIsFormOpen(open);
            if (!open) setEditingTask(undefined);
          }}
        >
          <DialogTrigger asChild>
            <Button onClick={() => setEditingTask(undefined)} className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90">
              <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Tarefa
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px] w-[90vw] bg-card border border-border rounded-lg shadow-lg">
            <DialogHeader>
              <DialogTitle className="text-foreground">{editingTask ? "Editar Tarefa" : "Adicionar Nova Tarefa"}</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                {editingTask ? "Atualize os detalhes da sua tarefa." : "Crie uma nova tarefa para organizar seu dia."}
              </DialogDescription>
            </DialogHeader>
            <TaskForm
              initialData={editingTask ? { ...editingTask, due_date: editingTask.due_date ? parseISO(editingTask.due_date) : undefined } : undefined}
              onTaskSaved={handleTaskUpdated}
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
            <CardTitle className="text-foreground">Gerenciamento de Tarefas</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="current_tasks" className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-secondary/50 border border-border rounded-md">
                <TabsTrigger value="current_tasks" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm data-[state=active]:border-primary/50 rounded-md">Minhas Tarefas</TabsTrigger>
                <TabsTrigger value="template_tasks" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm data-[state=active]:border-primary/50 rounded-md">Tarefas Padrão</TabsTrigger>
              </TabsList>
              <div className="mt-4">
                <TabsContent value="current_tasks">
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
                </TabsContent>
                <TabsContent value="template_tasks">
                  <div className="flex justify-end mb-4">
                    <Dialog
                      open={isTemplateFormOpen}
                      onOpenChange={(open) => {
                        setIsTemplateFormOpen(open);
                        if (!open) setEditingTemplateTask(undefined);
                      }}
                    >
                      <DialogTrigger asChild>
                        <Button onClick={() => setEditingTemplateTask(undefined)} className="bg-primary text-primary-foreground hover:bg-primary/90">
                          <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Tarefa Padrão
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[425px] w-[90vw] bg-card border border-border rounded-lg shadow-lg">
                        <DialogHeader>
                          <DialogTitle className="text-foreground">{editingTemplateTask ? "Editar Tarefa Padrão" : "Adicionar Nova Tarefa Padrão"}</DialogTitle>
                          <DialogDescription className="text-muted-foreground">
                            {editingTemplateTask ? "Atualize os detalhes da sua tarefa padrão." : "Crie uma nova tarefa padrão para automatizar seu dia."}
                          </DialogDescription>
                        </DialogHeader>
                        <TemplateTaskForm
                          initialData={editingTemplateTask}
                          onTemplateTaskSaved={refetchTemplateTasks}
                          onClose={() => setIsTemplateFormOpen(false)}
                        />
                      </DialogContent>
                    </Dialog>
                  </div>
                  {renderTemplateTaskList(templateTasks || [])}
                </TabsContent>
              </div>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Tasks;