"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ListTodo, Award, Target, HeartPulse, TrendingDown, PlusCircle, Clock, CalendarCheck, XCircle, Repeat, Star, CalendarIcon } from "lucide-react";
import DashboardTaskList from "@/components/DashboardTaskList";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/integrations/supabase/auth";
import { isToday, parseISO, differenceInDays, format, getDay, isThisWeek, isThisMonth, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isSameDay } from "date-fns";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import TaskForm from "@/components/TaskForm";
import { getAdjustedTaskCompletionStatus } from "@/utils/taskHelpers";
import { Task, OriginBoard, DAYS_OF_WEEK_MAP } from "@/types/task";
import TaskListBoard from "@/components/dashboard/TaskListBoard";
import QuickAddTaskInput from "@/components/dashboard/QuickAddTaskInput";
import { useQueryClient } from "@tanstack/react-query";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { ptBR } from "date-fns/locale";
import { ClientTask } from "@/types/client"; // Importar ClientTask

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

// Nova função para buscar tarefas para boards específicos baseadas na data selecionada
const fetchTasksForSelectedDateBoard = async (userId: string, selectedDate: Date, board: OriginBoard): Promise<Task[]> => {
  const formattedDate = format(selectedDate, "yyyy-MM-dd");
  const currentDayOfWeek = getDay(selectedDate); // 0 for Sunday, 1 for Monday, etc.

  let query = supabase
    .from("tasks")
    .select(`
      id, title, description, due_date, time, is_completed, recurrence_type, recurrence_details, 
      last_successful_completion_date, origin_board, current_board, is_priority, overdue, parent_task_id, created_at, completed_at,
      task_tags(
        tags(id, name, color)
      )
    `)
    .eq("user_id", userId);

  if (board === "overdue") {
    // Para 'overdue', queremos todas as tarefas marcadas como 'overdue' e não concluídas
    query = query
      .eq("is_completed", false)
      .eq("current_board", "overdue");
  } else if (board === "completed") {
    // Para 'completed', queremos tarefas concluídas na data selecionada
    query = query
      .eq("is_completed", true)
      .eq("current_board", "completed")
      .gte("completed_at", `${formattedDate}T00:00:00Z`)
      .lte("completed_at", `${formattedDate}T23:59:59Z`);
  } else if (board === "recurrent") {
    // Para 'recurrent', queremos tarefas recorrentes que são devidas na data selecionada
    query = query
      .neq("recurrence_type", "none")
      .eq("is_completed", false); // Apenas tarefas recorrentes não concluídas para o ciclo atual
  } else {
    // Para 'today_priority', 'today_no_priority', 'jobs_woe_today'
    query = query
      .eq("current_board", board)
      .eq("is_completed", false); // Apenas tarefas não concluídas
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  const isDayIncluded = (details: string | null | undefined, dayIndex: number) => {
    if (!details) return false;
    const days = details.split(',');
    return days.some(day => DAYS_OF_WEEK_MAP[day] === dayIndex);
  };

  const filteredData = data?.filter(task => {
    if (board === "overdue" || board === "completed") {
      return true; // A filtragem já foi feita na query Supabase
    }
    if (board === "recurrent") {
      // Para tarefas recorrentes, verificar se a recorrência se aplica à data selecionada
      if (task.recurrence_type === "daily") return true;
      if (task.recurrence_type === "weekly" && task.recurrence_details) {
        return isDayIncluded(task.recurrence_details, currentDayOfWeek);
      }
      if (task.recurrence_type === "monthly" && task.recurrence_details) {
        return parseInt(task.recurrence_details) === selectedDate.getDate();
      }
      return false;
    }
    // Para boards de 'hoje', filtrar por due_date ou recorrência
    if (task.due_date && isSameDay(parseISO(task.due_date), selectedDate)) {
      return true;
    }
    if (task.recurrence_type !== "none") {
      if (task.recurrence_type === "daily") return true;
      if (task.recurrence_type === "weekly" && task.recurrence_details) {
        return isDayIncluded(task.recurrence_details, currentDayOfWeek);
      }
      if (task.recurrence_type === "monthly" && task.recurrence_details) {
        return parseInt(task.recurrence_details) === selectedDate.getDate();
      }
    }
    return false;
  }) || [];

  const mappedData = filteredData.map((task: any) => ({
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

// Nova função para buscar tarefas de clientes para o dashboard
const fetchClientTasksForDashboard = async (userId: string, selectedDate: Date): Promise<Task[]> => {
  const formattedDate = format(selectedDate, "yyyy-MM-dd");

  const { data, error } = await supabase
    .from("client_tasks")
    .select(`
      id, title, description, due_date, time, is_completed, created_at, updated_at, completed_at,
      is_standard_task, main_task_id,
      client_task_tags(
        tags(id, name, color)
      )
    `)
    .eq("user_id", userId)
    .eq("is_standard_task", true) // Apenas tarefas de clientes marcadas como padrão
    .eq("due_date", formattedDate) // Filtrar pela data selecionada
    .eq("is_completed", false) // Apenas tarefas não concluídas
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  // Mapear ClientTask para Task
  const mappedData: Task[] = data?.map((clientTask: any) => ({
    id: clientTask.id,
    title: clientTask.title,
    description: clientTask.description,
    due_date: clientTask.due_date,
    time: clientTask.time,
    is_completed: clientTask.is_completed,
    recurrence_type: "none", // Tarefas de cliente não são recorrentes no dashboard principal
    recurrence_details: null,
    last_successful_completion_date: clientTask.completed_at,
    origin_board: "client_tasks", // Novo board para tarefas de clientes
    current_board: "client_tasks",
    is_priority: false, // Pode ser ajustado se houver lógica de prioridade para tarefas de cliente
    overdue: false, // Será atualizado pelo daily-reset se necessário
    last_notified_at: null,
    recurrence_time: null,
    created_at: clientTask.created_at,
    updated_at: clientTask.updated_at,
    completed_at: clientTask.completed_at,
    last_moved_to_overdue_at: null,
    tags: clientTask.client_task_tags.map((ctt: any) => ctt.tags),
    parent_task_id: null,
    subtasks: [],
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

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const { data: allTasks, isLoading: isLoadingAllTasks, error: errorAllTasks, refetch: refetchAllTasks } = useQuery<Task[], Error>({
    queryKey: ["allTasks", userId],
    queryFn: () => fetchAllTasks(userId!),
    enabled: !!userId,
  });

  const { data: todayPriorityTasks, isLoading: isLoadingTodayPriority, error: errorTodayPriority, refetch: refetchTodayPriority } = useQuery<Task[], Error>({
    queryKey: ["dashboardTasks", "today_priority", userId, selectedDate.toISOString()],
    queryFn: () => fetchTasksForSelectedDateBoard(userId!, selectedDate, "today_priority"),
    enabled: !!userId,
  });

  const { data: todayNoPriorityTasks, isLoading: isLoadingTodayNoPriority, error: errorTodayNoPriority, refetch: refetchTodayNoPriority } = useQuery<Task[], Error>({
    queryKey: ["dashboardTasks", "today_no_priority", userId, selectedDate.toISOString()],
    queryFn: () => fetchTasksForSelectedDateBoard(userId!, selectedDate, "today_no_priority"),
    enabled: !!userId,
  });

  const { data: jobsWoeTodayTasks, isLoading: isLoadingJobsWoeToday, error: errorJobsWoeToday, refetch: refetchJobsWoeToday } = useQuery<Task[], Error>({
    queryKey: ["dashboardTasks", "jobs_woe_today", userId, selectedDate.toISOString()],
    queryFn: () => fetchTasksForSelectedDateBoard(userId!, selectedDate, "jobs_woe_today"),
    enabled: !!userId,
  });

  const { data: overdueTasks, isLoading: isLoadingOverdue, error: errorOverdue, refetch: refetchOverdue } = useQuery<Task[], Error>({
    queryKey: ["dashboardTasks", "overdue", userId], // Removido selectedDate.toISOString()
    queryFn: () => fetchTasksForSelectedDateBoard(userId!, selectedDate, "overdue"), // selectedDate ainda é passado, mas a função o ignora para 'overdue'
    enabled: !!userId,
  });

  const { data: recurrentTasks, isLoading: isLoadingRecurrent, error: errorRecurrent, refetch: refetchRecurrent } = useQuery<Task[], Error>({
    queryKey: ["dashboardTasks", "recurrent", userId, selectedDate.toISOString()],
    queryFn: () => fetchTasksForSelectedDateBoard(userId!, selectedDate, "recurrent"),
    enabled: !!userId,
  });

  const { data: completedTasks, isLoading: isLoadingCompleted, error: errorCompleted, refetch: refetchCompleted } = useQuery<Task[], Error>({
    queryKey: ["dashboardTasks", "completed", userId, selectedDate.toISOString()],
    queryFn: () => fetchTasksForSelectedDateBoard(userId!, selectedDate, "completed"),
    enabled: !!userId,
  });

  // Nova query para tarefas de clientes no dashboard
  const { data: clientDashboardTasks, isLoading: isLoadingClientDashboardTasks, error: errorClientDashboardTasks, refetch: refetchClientDashboardTasks } = useQuery<Task[], Error>({
    queryKey: ["dashboardTasks", "client_tasks", userId, selectedDate.toISOString()],
    queryFn: () => fetchClientTasksForDashboard(userId!, selectedDate),
    enabled: !!userId,
  });

  const [isTaskFormOpen, setIsTaskFormOpen] = React.useState(false);

  const handleTaskAdded = () => {
    refetchTodayPriority();
    refetchTodayNoPriority();
    refetchJobsWoeToday();
    refetchOverdue(); // Refetch para o quadro de atrasadas
    refetchRecurrent();
    refetchCompleted();
    refetchClientDashboardTasks(); // Refetch as tarefas de clientes também
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

  return (
    <div className="flex flex-1 flex-col gap-8 p-4 lg:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between flex-wrap gap-2">
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className={cn(
                  "w-full justify-start text-left font-normal bg-input border-border text-foreground hover:bg-accent hover:text-accent-foreground",
                  !selectedDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
                {selectedDate ? (
                  format(selectedDate, "PPP", { locale: ptBR })
                ) : (
                  <span>Escolha uma data</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 bg-popover border-border rounded-md shadow-lg">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => setSelectedDate(date || new Date())}
                initialFocus
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>
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
                initialDueDate={selectedDate} // Passa a data selecionada
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <TaskListBoard
          title="Hoje Prioridade"
          tasks={todayPriorityTasks || []}
          isLoading={isLoadingTodayPriority}
          error={errorTodayPriority}
          refetchTasks={handleTaskAdded}
          quickAddTaskInput={<QuickAddTaskInput originBoard="today_priority" onTaskAdded={handleTaskAdded} dueDate={selectedDate} />}
          originBoard="today_priority"
          selectedDate={selectedDate}
        />
        <TaskListBoard
          title="Hoje sem Prioridade"
          tasks={todayNoPriorityTasks || []}
          isLoading={isLoadingTodayNoPriority}
          error={errorTodayNoPriority}
          refetchTasks={handleTaskAdded}
          quickAddTaskInput={<QuickAddTaskInput originBoard="today_no_priority" onTaskAdded={handleTaskAdded} dueDate={selectedDate} />}
          originBoard="today_no_priority"
          selectedDate={selectedDate}
        />
        <TaskListBoard
          title="Jobs Woe hoje"
          tasks={jobsWoeTodayTasks || []}
          isLoading={isLoadingJobsWoeToday}
          error={errorJobsWoeToday}
          refetchTasks={handleTaskAdded}
          quickAddTaskInput={<QuickAddTaskInput originBoard="jobs_woe_today" onTaskAdded={handleTaskAdded} dueDate={selectedDate} />}
          originBoard="jobs_woe_today"
          selectedDate={selectedDate}
        />
        <TaskListBoard
          title="Tarefas de Clientes" // Novo quadro para tarefas de clientes
          tasks={clientDashboardTasks || []}
          isLoading={isLoadingClientDashboardTasks}
          error={errorClientDashboardTasks}
          refetchTasks={handleTaskAdded}
          showAddButton={false} // Tarefas de clientes são adicionadas via Kanban do cliente
          originBoard="client_tasks"
          selectedDate={selectedDate}
        />
        <TaskListBoard
          title="Atrasadas"
          tasks={overdueTasks || []}
          isLoading={isLoadingOverdue}
          error={errorOverdue}
          refetchTasks={handleTaskAdded}
          showAddButton={false}
          originBoard="overdue"
          selectedDate={selectedDate}
        />
        <TaskListBoard
          title="Recorrentes"
          tasks={recurrentTasks || []}
          isLoading={isLoadingRecurrent}
          error={errorRecurrent}
          refetchTasks={handleTaskAdded}
          showAddButton={false}
          originBoard="recurrent"
          selectedDate={selectedDate}
        />
        <TaskListBoard
          title="Finalizadas"
          tasks={completedTasks || []}
          isLoading={isLoadingCompleted}
          error={errorCompleted}
          refetchTasks={handleTaskAdded}
          showAddButton={false}
          originBoard="completed"
          selectedDate={selectedDate}
        />
        {/* <DashboardTaskList /> REMOVIDO */}
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