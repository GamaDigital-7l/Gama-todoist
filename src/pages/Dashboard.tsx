"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ListTodo, Award, Target, HeartPulse, TrendingDown, PlusCircle } from "lucide-react";
import DailyMotivation from "@/components/DailyMotivation";
import DashboardTaskList from "@/components/DashboardTaskList";
import TaskAIHelper from "@/components/TaskAIHelper";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/integrations/supabase/auth";
import { isToday, parseISO, differenceInDays, format, getDay, subDays } from "date-fns";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import TaskForm from "@/components/TaskForm";

interface Profile {
  id: string;
  points: number;
}

interface Task {
  id: string;
  is_completed: boolean;
  due_date?: string;
  recurrence_type: "none" | "daily" | "weekly" | "monthly";
  recurrence_details?: string;
  task_type: "general" | "reading" | "exercise" | "study"; // Adicionado 'study'
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

const DAYS_OF_WEEK_MAP: { [key: string]: number } = {
  "Sunday": 0, "Monday": 1, "Tuesday": 2, "Wednesday": 3,
  "Thursday": 4, "Friday": 5, "Saturday": 6
};

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

const fetchUserTasks = async (): Promise<Task[]> => {
  const { data, error } = await supabase.from("tasks").select("id, is_completed, due_date, recurrence_type, recurrence_details, task_type"); // Incluído task_type
  if (error) {
    console.error("Erro ao buscar tarefas do usuário:", error);
    throw error;
  }
  return data || [];
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

  const { data: profile, isLoading: isLoadingProfile } = useQuery<Profile | null, Error>({
    queryKey: ["userProfile", userId],
    queryFn: () => fetchUserProfile(userId!),
    enabled: !!userId,
  });

  const { data: tasks, isLoading: isLoadingTasks, refetch: refetchTasks } = useQuery<Task[], Error>({
    queryKey: ["tasksForDashboard"],
    queryFn: fetchUserTasks,
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

  const getTodayCompletedTasksCount = (allTasks: Task[]): { completed: number; total: number } => {
    const today = new Date();
    let completedToday = 0;
    let totalToday = 0;
    const currentDayOfWeek = today.getDay();
    const currentDayOfMonth = today.getDate().toString();

    const isDayIncluded = (details: string | null | undefined, dayIndex: number) => {
      if (!details) return false;
      const days = details.split(',');
      return days.some(day => DAYS_OF_WEEK_MAP[day] === dayIndex);
    };

    allTasks.forEach(task => {
      let isTaskDueToday = false;

      if (task.recurrence_type !== "none") {
        if (task.recurrence_type === "daily") {
          isTaskDueToday = true;
        }
        if (task.recurrence_type === "weekly" && task.recurrence_details) {
          if (isDayIncluded(task.recurrence_details, currentDayOfWeek)) {
            isTaskDueToday = true;
          }
        }
        if (task.recurrence_type === "monthly" && task.recurrence_details) {
          if (parseInt(task.recurrence_details) === parseInt(currentDayOfMonth)) {
            isTaskDueToday = true;
          }
        }
      } else if (task.due_date) {
        const dueDate = parseISO(task.due_date);
        if (isToday(dueDate)) {
          isTaskDueToday = true;
        }
      }

      if (isTaskDueToday) {
        totalToday++;
        if (task.is_completed) {
          completedToday++;
        }
      }
    });

    return { completed: completedToday, total: totalToday };
  };

  const todayTasksStats = tasks ? getTodayCompletedTasksCount(tasks) : { completed: 0, total: 0 };

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

  return (
    <div className="flex flex-1 flex-col gap-8 p-4 lg:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <Dialog open={isTaskFormOpen} onOpenChange={setIsTaskFormOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
              <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Tarefa Rápida
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px] bg-card border border-border rounded-lg shadow-lg">
            <DialogHeader>
              <DialogTitle className="text-foreground">Adicionar Nova Tarefa</DialogTitle>
            </DialogHeader>
            <TaskForm
              onTaskSaved={() => {
                refetchTasks();
                setIsTaskFormOpen(false);
              }}
              onClose={() => setIsTaskFormOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      <DailyMotivation />

      <DashboardTaskList />

      <TaskAIHelper />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="hover:shadow-lg transition-shadow duration-300 bg-card border border-border rounded-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg font-semibold text-foreground">Tarefas Diárias</CardTitle>
            <ListTodo className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            {isLoadingTasks ? (
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