"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/integrations/supabase/auth";
import { Task, DAYS_OF_WEEK_MAP } from "@/types/task"; // Importação corrigida
import { format, parseISO, isToday, isThisWeek, isThisMonth, startOfWeek, endOfWeek, startOfMonth, endOfMonth, getDay, differenceInDays } from "date-fns"; // Importação corrigida
import { ptBR } from "date-fns/locale";
import { ListTodo, CheckCircle2, XCircle, Repeat, CalendarCheck, TrendingUp, TrendingDown, Award } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Profile {
  id: string;
  points: number;
}

const fetchAllTasks = async (userId: string): Promise<Task[]> => {
  const { data, error } = await supabase
    .from("tasks")
    .select(`
      id, title, description, due_date, time, is_completed, recurrence_type, recurrence_details, 
      last_successful_completion_date, origin_board, current_board, is_priority, overdue, parent_task_id, created_at, completed_at, updated_at,
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

const fetchCompletedTasks = async (userId: string): Promise<Task[]> => {
  const { data, error } = await supabase
    .from("tasks")
    .select(`
      id, title, description, due_date, time, is_completed, recurrence_type, recurrence_details, 
      last_successful_completion_date, origin_board, current_board, is_priority, overdue, parent_task_id, created_at, completed_at, updated_at,
      task_tags(
        tags(id, name, color)
      )
    `)
    .eq("user_id", userId)
    .eq("is_completed", true)
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

const Results: React.FC = () => {
  const { session } = useSession();
  const userId = session?.user?.id;

  const [timeframe, setTimeframe] = useState<"today" | "week" | "month" | "all">("week");

  const { data: allTasks, isLoading: isLoadingAllTasks, error: errorAllTasks } = useQuery<Task[], Error>({
    queryKey: ["allTasks", userId],
    queryFn: () => fetchAllTasks(userId!),
    enabled: !!userId,
  });

  const { data: completedTasks, isLoading: isLoadingCompletedTasks, error: errorCompletedTasks } = useQuery<Task[], Error>({
    queryKey: ["completedTasks", userId],
    queryFn: () => fetchCompletedTasks(userId!),
    enabled: !!userId,
  });

  const { data: userProfile, isLoading: isLoadingProfile, error: errorProfile } = useQuery<Profile | null, Error>({
    queryKey: ["userProfile", userId],
    queryFn: () => fetchUserProfile(userId!),
    enabled: !!userId,
  });

  const filteredTasks = useMemo(() => {
    if (!allTasks) return [];
    const now = new Date();

    return allTasks.filter(task => {
      if (!task.due_date && task.recurrence_type === "none") return false; // Only tasks with due_date or recurrence

      const taskDate = task.due_date ? parseISO(task.due_date) : null;
      const isRecurring = task.recurrence_type !== "none";

      switch (timeframe) {
        case "today":
          if (taskDate && isToday(taskDate)) return true;
          if (isRecurring) {
            if (task.recurrence_type === "daily") return true;
            if (task.recurrence_type === "weekly" && task.recurrence_details) {
              return task.recurrence_details.split(',').some(day => getDay(now) === DAYS_OF_WEEK_MAP[day]);
            }
            if (task.recurrence_type === "monthly" && task.recurrence_details) {
              return now.getDate() === parseInt(task.recurrence_details);
            }
          }
          return false;
        case "week":
          if (taskDate && isThisWeek(taskDate, { weekStartsOn: 0 })) return true;
          if (isRecurring) {
            // For recurring tasks, if they are active this week, count them
            return true; 
          }
          return false;
        case "month":
          if (taskDate && isThisMonth(taskDate)) return true;
          if (isRecurring) {
            // For recurring tasks, if they are active this month, count them
            return true;
          }
          return false;
        case "all":
        default:
          return true;
      }
    });
  }, [allTasks, timeframe]);

  const totalTasks = filteredTasks.length;
  const completedInTimeframe = filteredTasks.filter(task => task.is_completed).length;
  const completionRate = totalTasks > 0 ? (completedInTimeframe / totalTasks) * 100 : 0;

  const totalPoints = userProfile?.points || 0;

  if (isLoadingAllTasks || isLoadingCompletedTasks || isLoadingProfile) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 md:px-10 lg:p-6 bg-background text-foreground">
        <h1 className="text-3xl font-bold">Resultados e Progresso</h1>
        <p className="text-lg text-muted-foreground">Carregando seus resultados...</p>
      </div>
    );
  }

  if (errorAllTasks || errorCompletedTasks || errorProfile) {
    showError("Erro ao carregar resultados: " + (errorAllTasks || errorCompletedTasks || errorProfile)?.message);
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 md:px-10 lg:p-6 bg-background text-foreground">
        <h1 className="text-3xl font-bold">Resultados e Progresso</h1>
        <p className="text-lg text-red-500">Erro ao carregar resultados: {(errorAllTasks || errorCompletedTasks || errorProfile)?.message}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:px-10 lg:p-6">
      <h1 className="text-3xl font-bold text-foreground">Resultados e Progresso</h1>
      <p className="text-lg text-muted-foreground">
        Acompanhe suas conquistas e o progresso das suas tarefas.
      </p>

      <div className="flex items-center gap-2 mb-4">
        <Label htmlFor="timeframe-select" className="text-foreground">Período:</Label>
        <Select value={timeframe} onValueChange={(value: "today" | "week" | "month" | "all") => setTimeframe(value)}>
          <SelectTrigger id="timeframe-select" className="w-[180px] bg-input border-border text-foreground focus-visible:ring-ring">
            <SelectValue placeholder="Selecionar período" />
          </SelectTrigger>
          <SelectContent className="bg-popover text-popover-foreground border-border rounded-md shadow-lg">
            <SelectItem value="today">Hoje</SelectItem>
            <SelectItem value="week">Esta Semana</SelectItem>
            <SelectItem value="month">Este Mês</SelectItem>
            <SelectItem value="all">Desde o Início</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <Card className="bg-card border border-border rounded-xl shadow-sm frosted-glass card-hover-effect">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg font-semibold text-foreground">Tarefas Totais</CardTitle>
            <ListTodo className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{totalTasks}</div>
            <p className="text-sm text-muted-foreground mt-1">
              Tarefas no período selecionado.
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border border-border rounded-xl shadow-sm frosted-glass card-hover-effect">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg font-semibold text-foreground">Tarefas Concluídas</CardTitle>
            <CheckCircle2 className="h-5 w-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{completedInTimeframe}</div>
            <p className="text-sm text-muted-foreground mt-1">
              Tarefas finalizadas no período.
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border border-border rounded-xl shadow-sm frosted-glass card-hover-effect">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg font-semibold text-foreground">Taxa de Conclusão</CardTitle>
            <TrendingUp className="h-5 w-5 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{completionRate.toFixed(0)}%</div>
            <Progress value={completionRate} className="w-full mt-2" />
            <p className="text-sm text-muted-foreground mt-1">
              Percentual de tarefas concluídas.
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border border-border rounded-xl shadow-sm frosted-glass card-hover-effect">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg font-semibold text-foreground">Pontos Totais</CardTitle>
            <Award className="h-5 w-5 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{totalPoints}</div>
            <p className="text-sm text-muted-foreground mt-1">
              Pontos acumulados por tarefas.
            </p>
          </CardContent>
        </Card>
      </div>

      <h2 className="text-2xl md:text-3xl font-bold text-foreground mt-6">Tarefas Concluídas Recentemente</h2>
      {completedTasks && completedTasks.length > 0 ? (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {completedTasks.slice(0, 6).map((task) => ( // Mostrar as 6 mais recentes
            <Card key={task.id} className="bg-card border border-border rounded-xl shadow-sm frosted-glass card-hover-effect">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-foreground break-words">{task.title}</CardTitle>
                <CardDescription className="text-muted-foreground">
                  {task.description && <span className="break-words">{task.description}</span>}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                Concluído em: {task.completed_at ? format(parseISO(task.completed_at), "PPP", { locale: ptBR }) : "N/A"}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground text-base md:text-lg">Nenhuma tarefa concluída recentemente.</p>
      )}
    </div>
  );
};

export default Results;