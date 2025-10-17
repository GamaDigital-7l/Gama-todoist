"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ListTodo, Award, Target, HeartPulse, TrendingDown, PlusCircle, Clock, CalendarCheck, XCircle, Repeat, Star } from "lucide-react"; // Adicionado Clock, CalendarCheck, XCircle, Repeat, Star
import DashboardTaskList from "@/components/DashboardTaskList";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/integrations/supabase/auth";
import { isToday, parseISO, differenceInDays, format, getDay, isThisWeek, isThisMonth, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import TaskForm from "@/components/TaskForm";
import { getAdjustedTaskCompletionStatus } from "@/utils/taskHelpers";
import { Task, OriginBoard, DAYS_OF_WEEK_MAP } from "@/types/task";
import TaskListBoard from "@/components/dashboard/TaskListBoard";
import QuickAddTaskInput from "@/components/dashboard/QuickAddTaskInput";
import { useQueryClient } from "@tanstack/react-query";

interface Profile {
  id: string;
  points: number;
}

interface HealthMetric {
  id: string;
  date: string;
  weight_kg?: number | null;
}

interface HealthGoal {
  id: string;
  title: string;
  initial_weight_kg: number;
  target_weight_kg: number;
  start_date: string;
  target_date: string;
  is_completed: boolean;
}

const fetchUserProfile = async (userId: string): Promise<Profile | null> => {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, points")
    .eq("id", userId)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error("Erro ao buscar perfil do usuário:", error);
    throw error;
  }
  return data as Profile | null;
};

const fetchTasksByCurrentBoard = async (userId: string, board: OriginBoard): Promise<Task[]> => {
  const { data, error } = await supabase
    .from("tasks")
    .select(`
      id, title, description, due_date, time, is_completed, recurrence_type, recurrence_details, 
      last_successful_completion_date, origin_board, current_board, is_priority, overdue, parent_task_id, created_at, completed_at,
      task_tags(
        tags(id, name, color)
      )
    `)
    .eq("user_id", userId)
    .eq("current_board", board) // Usar current_board
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

const fetchRecurrentTasks = async (userId: string): Promise<Task[]> => {
  const { data, error } = await supabase
    .from("tasks")
    .select(`
      id, title, description, due_date, time, is_completed, recurrence_type, recurrence_details, 
      last_successful_completion_date, origin_board, current_board, is_priority, overdue, parent_task_id, created_at, completed_at,
      task_tags(
        tags(id, name, color)
      )
    `)
    .eq("user_id", userId)
    .neq("recurrence_type", "none")
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

const fetchCompletedTasks = async (userId: string): Promise<Task[]> => {
  const { data, error } = await supabase
    .from("tasks")
    .select(`
      id, title, description, due_date, time, is_completed, recurrence_type, recurrence_details, 
      last_successful_completion_date, origin_board, current_board, is_priority, overdue, parent_task_id, created_at, completed_at,
      task_tags(
        tags(id, name, color)
      )
    `)
    .eq("user_id", userId)
    .eq("current_board", "completed") // Usar current_board
    .order("completed_at", { ascending: false });
  if (error) {
    throw error;
  }
  const mappedData = data?.map((task: any) => ({
    ...task,
    tags: task.task_tags.map((tt: any) => tt.tags),
  })) || [];
  return mappedData;
};

const fetchAllTasks = async (userId: string): Promise<Task[]> => {
  const { data, error } = await supabase
    .from("tasks")
    .select(`
      id, title, description, due_date, time, is_completed, recurrence_type, recurrence_details, 
      last_successful_completion_date, origin_board, current_board, is_priority, overdue, parent_task_id, created_at, completed_at,
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


const fetchLatestHealthMetric = async (userId: string): Promise<HealthMetric | null> => {
  const { data, error } = await supabase
    .from("health_metrics")
    .select("id, date, weight_kg")
    .eq("user_id", userId)
    .order("date", { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error("Erro ao buscar última métrica de saúde:", error);
    throw error;
  }
  return data as HealthMetric | null;
};

const fetchActiveHealthGoal = async (userId: string): Promise<HealthGoal | null> => {
  const { data, error } = await supabase
    .from("health_goals")
    .select("*")
    .eq("user_id", userId)
    .eq("is_completed", false)
    .order("target_date", { ascending: true })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error("Erro ao buscar meta de saúde ativa:", error);
    throw error;
  }
  return data as HealthGoal | null;
};

const Dashboard: React.FC = () => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();

  // Removido: const { data: profile, isLoading: isLoadingProfile } = useQuery<Profile | null, Error>({ ... });
  // Removido: const { data: latestHealthMetric, isLoading: isLoadingLatestMetric } = useQuery<HealthMetric | null, Error>({ ... });
  // Removido: const { data: activeHealthGoal, isLoading: isLoadingActiveGoal } = useQuery<HealthGoal | null, Error>({ ... });

  const { data: allTasks, isLoading: isLoadingAllTasks, error: errorAllTasks, refetch: refetchAllTasks } = useQuery<Task[], Error>({
    queryKey: ["allTasks", userId],
    queryFn: () => fetchAllTasks(userId!),
    enabled: !!userId,
  });

  const { data: todayPriorityTasks, isLoading: isLoadingTodayPriority, error: errorTodayPriority, refetch: refetchTodayPriority } = useQuery<Task[], Error>({
    queryKey: ["dashboardTasks", "today_priority", userId],
    queryFn: () => fetchTasksByCurrentBoard(userId!, "today_priority"), // Usar current_board
    enabled: !!userId,
  });

  const { data: todayNoPriorityTasks, isLoading: isLoadingTodayNoPriority, error: errorTodayNoPriority, refetch: refetchTodayNoPriority } = useQuery<Task[], Error>({
    queryKey: ["dashboardTasks", "today_no_priority", userId],
    queryFn: () => fetchTasksByCurrentBoard(userId!, "today_no_priority"), // Usar current_board
    enabled: !!userId,
  });

  const { data: jobsWoeTodayTasks, isLoading: isLoadingJobsWoeToday, error: errorJobsWoeToday, refetch: refetchJobsWoeToday } = useQuery<Task[], Error>({
    queryKey: ["dashboardTasks", "jobs_woe_today", userId],
    queryFn: () => fetchTasksByCurrentBoard(userId!, "jobs_woe_today"), // Usar current_board
    enabled: !!userId,
  });

  const { data: overdueTasks, isLoading: isLoadingOverdue, error: errorOverdue, refetch: refetchOverdue } = useQuery<Task[], Error>({
    queryKey: ["dashboardTasks", "overdue", userId],
    queryFn: () => fetchTasksByCurrentBoard(userId!, "overdue"), // Usar current_board
    enabled: !!userId,
  });

  const { data: recurrentTasks, isLoading: isLoadingRecurrent, error: errorRecurrent, refetch: refetchRecurrent } = useQuery<Task[], Error>({
    queryKey: ["dashboardTasks", "recurrent", userId],
    queryFn: () => fetchRecurrentTasks(userId!),
    enabled: !!userId,
  });

  const { data: completedTasks, isLoading: isLoadingCompleted, error: errorCompleted, refetch: refetchCompleted } = useQuery<Task[], Error>({
    queryKey: ["dashboardTasks", "completed", userId],
    queryFn: () => fetchCompletedTasks(userId!), // Usar current_board
    enabled: !!userId,
  });

  const [isTaskFormOpen, setIsTaskFormOpen] = React.useState(false);

  const handleTaskAdded = () => {
    refetchTodayPriority();
    refetchTodayNoPriority();
    refetchJobsWoeToday();
    refetchOverdue();
    refetchRecurrent();
    refetchCompleted();
    refetchAllTasks(); // Adicionado refetch para todas as tarefas
    queryClient.invalidateQueries({ queryKey: ["allTasks", userId] });
  };

  // --- Novas Lógicas para Estatísticas ---
  const today = new Date();
  const startOfThisWeek = startOfWeek(today, { weekStartsOn: 0 }); // Domingo como início da semana
  const endOfThisWeek = endOfWeek(today, { weekStartsOn: 0 });
  const startOfThisMonth = startOfMonth(today);
  const endOfThisMonth = endOfMonth(today);

  const totalTasksCount = allTasks?.length || 0;
  const totalOverdueCount = overdueTasks?.length || 0;
  const totalRecurrentCount = recurrentTasks?.length || 0;

  const completedThisWeekCount = completedTasks?.filter(task => 
    task.completed_at && parseISO(task.completed_at) >= startOfThisWeek && parseISO(task.completed_at) <= endOfThisWeek
  ).length || 0;

  const completedThisMonthCount = completedTasks?.filter(task =>
    task.completed_at && parseISO(task.completed_at) >= startOfThisMonth && parseISO(task.completed_at) <= endOfThisMonth
  ).length || 0;

  const failedRecurrentTasks = recurrentTasks?.filter(task => !getAdjustedTaskCompletionStatus(task)) || [];
  const failedRecurrentCount = failedRecurrentTasks.length;

  // Lógica para "Dias com mais tarefas cumpridas" e "Dias com mais tarefas falhadas"
  // Isso exigiria uma análise mais profunda de dados históricos e pode ser complexo para o escopo atual.
  // Por enquanto, vamos focar em contagens mais diretas.
  // Se o usuário realmente precisar disso, podemos considerar uma Edge Function para pré-processar esses dados.

  return (
    <div className="flex flex-1 flex-col gap-8 p-4 lg:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between flex-wrap gap-2">
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <Dialog open={isTaskFormOpen} onOpenChange={setIsTaskFormOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90">
              <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Tarefa Rápida
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px] w-[90vw] bg-card border border-border rounded-lg shadow-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-foreground">Adicionar Nova Tarefa</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Crie uma nova tarefa para organizar seu dia.
              </DialogDescription>
            </DialogHeader>
            <TaskForm
              onTaskSaved={handleTaskAdded}
              onClose={() => setIsTaskFormOpen(false)}
              initialOriginBoard="general"
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <TaskListBoard
          title="Hoje Prioridade"
          tasks={todayPriorityTasks || []}
          isLoading={isLoadingTodayPriority}
          error={errorTodayPriority}
          refetchTasks={handleTaskAdded}
          quickAddTaskInput={<QuickAddTaskInput originBoard="today_priority" onTaskAdded={handleTaskAdded} />}
          originBoard="today_priority"
        />
        <TaskListBoard
          title="Hoje sem Prioridade"
          tasks={todayNoPriorityTasks || []}
          isLoading={isLoadingTodayNoPriority}
          error={errorTodayNoPriority}
          refetchTasks={handleTaskAdded}
          quickAddTaskInput={<QuickAddTaskInput originBoard="today_no_priority" onTaskAdded={handleTaskAdded} />}
          originBoard="today_no_priority"
        />
        <TaskListBoard
          title="Jobs Woe hoje"
          tasks={jobsWoeTodayTasks || []}
          isLoading={isLoadingJobsWoeToday}
          error={errorJobsWoeToday}
          refetchTasks={handleTaskAdded}
          quickAddTaskInput={<QuickAddTaskInput originBoard="jobs_woe_today" onTaskAdded={handleTaskAdded} />}
          originBoard="jobs_woe_today"
        />
        <TaskListBoard
          title="Atrasadas"
          tasks={overdueTasks || []}
          isLoading={isLoadingOverdue}
          error={errorOverdue}
          refetchTasks={handleTaskAdded}
          showAddButton={false}
          originBoard="overdue"
        />
        <TaskListBoard
          title="Recorrentes"
          tasks={recurrentTasks || []}
          isLoading={isLoadingRecurrent}
          error={errorRecurrent}
          refetchTasks={handleTaskAdded}
          showAddButton={false}
          originBoard="recurrent"
        />
        <TaskListBoard
          title="Finalizadas"
          tasks={completedTasks || []}
          isLoading={isLoadingCompleted}
          error={errorCompleted}
          refetchTasks={handleTaskAdded}
          showAddButton={false}
          originBoard="completed"
        />
        <DashboardTaskList />
      </div>

      {/* Cartões de Estatísticas de Tarefas movidos para o final da página */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 mt-8">
        <Card className="bg-card border border-border rounded-xl shadow-sm frosted-glass card-hover-effect">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg font-semibold text-foreground">Total de Tarefas</CardTitle>
            <ListTodo className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            {isLoadingAllTasks ? (
              <div className="text-3xl font-bold text-foreground">Carregando...</div>
            ) : (
              <div className="text-3xl font-bold text-foreground">{totalTasksCount}</div>
            )}
            <p className="text-sm text-muted-foreground mt-1">
              Todas as tarefas criadas.
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border border-border rounded-xl shadow-sm frosted-glass card-hover-effect">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg font-semibold text-foreground">Tarefas Atrasadas</CardTitle>
            <XCircle className="h-5 w-5 text-red-500" />
          </CardHeader>
          <CardContent>
            {isLoadingOverdue ? (
              <div className="text-3xl font-bold text-foreground">Carregando...</div>
            ) : (
              <div className="text-3xl font-bold text-foreground">{totalOverdueCount}</div>
            )}
            <p className="text-sm text-muted-foreground mt-1">
              Tarefas que passaram do prazo.
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border border-border rounded-xl shadow-sm frosted-glass card-hover-effect">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg font-semibold text-foreground">Recorrentes Falhas</CardTitle>
            <Repeat className="h-5 w-5 text-orange-500" />
          </CardHeader>
          <CardContent>
            {isLoadingRecurrent ? (
              <div className="text-3xl font-bold text-foreground">Carregando...</div>
            ) : (
              <div className="text-3xl font-bold text-foreground">{failedRecurrentCount}</div>
            )}
            <p className="text-sm text-muted-foreground mt-1">
              Tarefas recorrentes não concluídas no ciclo.
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border border-border rounded-xl shadow-sm frosted-glass card-hover-effect">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg font-semibold text-foreground">Concluídas na Semana</CardTitle>
            <CalendarCheck className="h-5 w-5 text-green-500" />
          </CardHeader>
          <CardContent>
            {isLoadingCompleted ? (
              <div className="text-3xl font-bold text-foreground">Carregando...</div>
            ) : (
              <div className="text-3xl font-bold text-foreground">{completedThisWeekCount}</div>
            )}
            <p className="text-sm text-muted-foreground mt-1">
              Tarefas finalizadas esta semana.
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border border-border rounded-xl shadow-sm frosted-glass card-hover-effect">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg font-semibold text-foreground">Concluídas no Mês</CardTitle>
            <CalendarCheck className="h-5 w-5 text-green-500" />
          </CardHeader>
          <CardContent>
            {isLoadingCompleted ? (
              <div className="text-3xl font-bold text-foreground">Carregando...</div>
            ) : (
              <div className="text-3xl font-bold text-foreground">{completedThisMonthCount}</div>
            )}
            <p className="text-sm text-muted-foreground mt-1">
              Tarefas finalizadas este mês.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;