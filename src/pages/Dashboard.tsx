"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ListTodo, Award, Target, HeartPulse, TrendingDown, PlusCircle } from "lucide-react";
import DashboardTaskList from "@/components/DashboardTaskList"; // Agora é o quadro "Geral"
import TaskAIHelper from "@/components/TaskAIHelper";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/integrations/supabase/auth";
import { isToday, parseISO, differenceInDays, format, getDay } from "date-fns";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import TaskForm from "@/components/TaskForm";
import { getAdjustedTaskCompletionStatus } from "@/utils/taskHelpers";
import { Task, OriginBoard, DAYS_OF_WEEK_MAP } from "@/types/task"; // Importar Task, OriginBoard e DAYS_OF_WEEK_MAP
import TaskListBoard from "@/components/dashboard/TaskListBoard"; // Importar o componente de quadro
import QuickAddTaskInput from "@/components/dashboard/QuickAddTaskInput"; // Importar o input rápido
import { useQueryClient } from "@tanstack/react-query"; // Importar useQueryClient

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

const fetchTasksByOriginBoard = async (userId: string, board: OriginBoard): Promise<Task[]> => {
  const { data, error } = await supabase
    .from("tasks")
    .select(`
      *,
      task_tags(
        tags(id, name, color)
      )
    `)
    .eq("user_id", userId)
    .eq("origin_board", board)
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
      *,
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
      *,
      task_tags(
        tags(id, name, color)
      )
    `)
    .eq("user_id", userId)
    .eq("origin_board", "completed")
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
  const queryClient = useQueryClient(); // Inicializar useQueryClient

  const { data: profile, isLoading: isLoadingProfile } = useQuery<Profile | null, Error>({
    queryKey: ["userProfile", userId],
    queryFn: () => fetchUserProfile(userId!),
    enabled: !!userId,
  });

  const { data: todayPriorityTasks, isLoading: isLoadingTodayPriority, error: errorTodayPriority, refetch: refetchTodayPriority } = useQuery<Task[], Error>({
    queryKey: ["dashboardTasks", "today_priority", userId],
    queryFn: () => fetchTasksByOriginBoard(userId!, "today_priority"),
    enabled: !!userId,
  });

  const { data: todayNoPriorityTasks, isLoading: isLoadingTodayNoPriority, error: errorTodayNoPriority, refetch: refetchTodayNoPriority } = useQuery<Task[], Error>({
    queryKey: ["dashboardTasks", "today_no_priority", userId],
    queryFn: () => fetchTasksByOriginBoard(userId!, "today_no_priority"),
    enabled: !!userId,
  });

  const { data: jobsWoeTodayTasks, isLoading: isLoadingJobsWoeToday, error: errorJobsWoeToday, refetch: refetchJobsWoeToday } = useQuery<Task[], Error>({
    queryKey: ["dashboardTasks", "jobs_woe_today", userId],
    queryFn: () => fetchTasksByOriginBoard(userId!, "jobs_woe_today"),
    enabled: !!userId,
  });

  const { data: overdueTasks, isLoading: isLoadingOverdue, error: errorOverdue, refetch: refetchOverdue } = useQuery<Task[], Error>({
    queryKey: ["dashboardTasks", "overdue", userId],
    queryFn: () => fetchTasksByOriginBoard(userId!, "overdue"),
    enabled: !!userId,
  });

  const { data: recurrentTasks, isLoading: isLoadingRecurrent, error: errorRecurrent, refetch: refetchRecurrent } = useQuery<Task[], Error>({
    queryKey: ["dashboardTasks", "recurrent", userId],
    queryFn: () => fetchRecurrentTasks(userId!),
    enabled: !!userId,
  });

  const { data: completedTasks, isLoading: isLoadingCompleted, error: errorCompleted, refetch: refetchCompleted } = useQuery<Task[], Error>({
    queryKey: ["dashboardTasks", "completed", userId],
    queryFn: () => fetchCompletedTasks(userId!),
    enabled: !!userId,
  });

  const { data: latestHealthMetric, isLoading: isLoadingLatestMetric } = useQuery<HealthMetric | null, Error>({
    queryKey: ["latestHealthMetric", userId],
    queryFn: () => fetchLatestHealthMetric(userId!),
    enabled: !!userId,
  });

  const { data: activeHealthGoal, isLoading: isLoadingActiveGoal } = useQuery<HealthGoal | null, Error>({
    queryKey: ["activeHealthGoal", userId],
    queryFn: () => fetchActiveHealthGoal(userId!),
    enabled: !!userId,
  });

  const [isTaskFormOpen, setIsTaskFormOpen] = React.useState(false);

  const getTodayCompletedTasksCount = (priorityTasks: Task[], noPriorityTasks: Task[], jobsWoeTasks: Task[]): { completed: number; total: number } => {
    let completedToday = 0;
    let totalToday = 0;

    [...priorityTasks, ...noPriorityTasks, ...jobsWoeTasks].forEach(task => {
      totalToday++;
      if (getAdjustedTaskCompletionStatus(task)) {
        completedToday++;
      }
    });

    return { completed: completedToday, total: totalToday };
  };

  const todayTasksStats = getTodayCompletedTasksCount(todayPriorityTasks || [], todayNoPriorityTasks || [], jobsWoeTodayTasks || []);

  const currentWeight = latestHealthMetric?.weight_kg || null;
  let healthGoalProgress = {
    totalToLose: 0,
    currentWeightLost: 0,
    remainingToLose: 0,
    progressPercentage: 0,
    daysRemaining: 0,
  };

  if (activeHealthGoal && currentWeight !== null) {
    const totalToLose = activeHealthGoal.initial_weight_kg - activeHealthGoal.target_weight_kg;
    const currentWeightLost = activeHealthGoal.initial_weight_kg - currentWeight;
    const remainingToLose = totalToLose - currentWeightLost;
    const progressPercentage = totalToLose > 0 ? (currentWeightLost / totalToLose) * 100 : 0;
    const daysRemaining = differenceInDays(parseISO(activeHealthGoal.target_date), new Date());

    healthGoalProgress = {
      totalToLose,
      currentWeightLost,
      remainingToLose,
      progressPercentage: Math.max(0, Math.min(100, progressPercentage)),
      daysRemaining: Math.max(0, daysRemaining),
    };
  }

  const handleTaskAdded = () => {
    refetchTodayPriority();
    refetchTodayNoPriority();
    refetchJobsWoeToday();
    refetchOverdue();
    refetchRecurrent();
    refetchCompleted();
    queryClient.invalidateQueries({ queryKey: ["allTasks", userId] }); // Invalida a query de todas as tarefas
  };

  return (
    <div className="flex flex-1 flex-col gap-8 p-4 lg:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between flex-wrap gap-2"> {/* Adicionado flex-col para mobile */}
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <Dialog open={isTaskFormOpen} onOpenChange={setIsTaskFormOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90"> {/* w-full para mobile */}
              <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Tarefa Rápida
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px] bg-card border border-border rounded-lg shadow-lg">
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
        <DashboardTaskList /> {/* Este agora é o quadro "Geral" */}
      </div>

      <TaskAIHelper />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="hover:shadow-lg transition-shadow duration-300 bg-card border border-border rounded-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg font-semibold text-foreground">Tarefas Diárias</CardTitle>
            <ListTodo className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            {(isLoadingTodayPriority || isLoadingTodayNoPriority || isLoadingJobsWoeToday) ? (
              <div className="text-3xl font-bold text-foreground">Carregando...</div>
            ) : (
              <div className="text-3xl font-bold text-foreground">{todayTasksStats.completed}/{todayTasksStats.total} Concluídas</div>
            )}
            <p className="text-sm text-muted-foreground mt-1">
              Você está no caminho certo!
            </p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-lg transition-shadow duration-300 bg-card border border-border rounded-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg font-semibold text-foreground">Pontuação Total</CardTitle>
            <Award className="h-5 w-5 text-yellow-500" />
          </CardHeader>
          <CardContent>
            {isLoadingProfile ? (
              <div className="text-3xl font-bold text-foreground">Carregando...</div>
            ) : (
              <div className="text-3xl font-bold text-foreground">+{profile?.points || 0} Pontos</div>
            )}
            <p className="text-sm text-muted-foreground mt-1">
              Continue assim para subir de nível!
            </p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-lg transition-shadow duration-300 bg-card border border-border rounded-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg font-semibold text-foreground">Meta de Saúde</CardTitle>
            <HeartPulse className="h-5 w-5 text-red-500" />
          </CardHeader>
          <CardContent>
            {isLoadingActiveGoal || isLoadingLatestMetric ? (
              <div className="text-3xl font-bold text-foreground">Carregando...</div>
            ) : activeHealthGoal && currentWeight !== null ? (
              <>
                <div className="text-2xl font-bold text-foreground flex items-center gap-2">
                  <TrendingDown className="h-5 w-5 text-green-500" /> {healthGoalProgress.remainingToLose.toFixed(1)} kg restantes
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  para {activeHealthGoal.target_weight_kg} kg até {format(parseISO(activeHealthGoal.target_date), "dd/MM")}.
                </p>
                <Progress value={healthGoalProgress.progressPercentage} className="w-full mt-2" />
                <p className="text-xs text-muted-foreground text-right mt-1">{healthGoalProgress.progressPercentage.toFixed(0)}%</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nenhuma meta de saúde ativa. Adicione uma!
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;