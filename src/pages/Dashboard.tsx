"use client";

import React from "react";
import { MadeWithDyad } from "@/components/made-with-dyad";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ListTodo, Award, Target } from "lucide-react";
import DailyMotivation from "@/components/DailyMotivation";
import DashboardTaskList from "@/components/DashboardTaskList";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/integrations/supabase/auth";
import { isToday, parseISO } from "date-fns";

interface Profile {
  id: string;
  points: number;
}

interface Task {
  id: string;
  is_completed: boolean;
  due_date?: string;
  recurrence_type: "none" | "daily_weekday" | "weekly" | "monthly";
  recurrence_details?: string;
}

const fetchUserProfile = async (userId: string): Promise<Profile | null> => {
  const { data, error } = await supabase
    .from("profiles")
    .select("points")
    .eq("id", userId)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error("Erro ao buscar perfil do usuário:", error);
    throw error;
  }
  return data;
};

const fetchUserTasks = async (): Promise<Task[]> => {
  const { data, error } = await supabase.from("tasks").select("id, is_completed, due_date, recurrence_type, recurrence_details");
  if (error) {
    console.error("Erro ao buscar tarefas do usuário:", error);
    throw error;
  }
  return data || [];
};

const Dashboard: React.FC = () => {
  const { session } = useSession();
  const userId = session?.user?.id;

  const { data: profile, isLoading: isLoadingProfile } = useQuery<Profile | null, Error>({
    queryKey: ["userProfile", userId],
    queryFn: () => fetchUserProfile(userId!),
    enabled: !!userId,
  });

  const { data: tasks, isLoading: isLoadingTasks } = useQuery<Task[], Error>({
    queryKey: ["tasksForDashboard"],
    queryFn: fetchUserTasks,
    enabled: !!userId,
  });

  const getTodayCompletedTasksCount = (allTasks: Task[]): { completed: number; total: number } => {
    const today = new Date();
    let completedToday = 0;
    let totalToday = 0;

    allTasks.forEach(task => {
      let isTaskDueToday = false;

      // Check for recurring tasks
      if (task.recurrence_type !== "none") {
        const currentDayOfWeek = today.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
        const currentDayOfMonth = today.getDate().toString();

        if (task.recurrence_type === "daily_weekday" && (currentDayOfWeek >= 1 && currentDayOfWeek <= 5)) {
          isTaskDueToday = true;
        } else if (task.recurrence_type === "weekly" && task.recurrence_details) {
          const dayMap: { [key: string]: number } = {
            "Sunday": 0, "Monday": 1, "Tuesday": 2, "Wednesday": 3,
            "Thursday": 4, "Friday": 5, "Saturday": 6
          };
          if (dayMap[task.recurrence_details] === currentDayOfWeek) {
            isTaskDueToday = true;
          }
        } else if (task.recurrence_type === "monthly" && task.recurrence_details) {
          if (parseInt(task.recurrence_details) === parseInt(currentDayOfMonth)) {
            isTaskDueToday = true;
          }
        }
      } else if (task.due_date) {
        // Check for single due date tasks
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

  return (
    <div className="flex flex-1 flex-col gap-8 p-4 lg:p-6">
      <DailyMotivation />

      <DashboardTaskList />

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
            <CardTitle className="text-lg font-semibold text-foreground">Próxima Meta</CardTitle>
            <Target className="h-5 w-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">Ler 10 páginas</div>
            <p className="text-sm text-muted-foreground mt-1">
              Faltam 5 páginas para hoje.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex-1 flex items-end justify-center mt-8">
        <MadeWithDyad />
      </div>
    </div>
  );
};

export default Dashboard;