"use client";

import React, { useState } from "react";
import { CalendarDays, PlusCircle, Briefcase, ListTodo } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { format, isSameDay, parseISO, getDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/integrations/supabase/auth";
import { showError } from "@/utils/toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import MeetingForm, { MeetingFormValues } from "@/components/MeetingForm"; // Importar MeetingFormValues
import MeetingItem from "@/components/MeetingItem";
import { Meeting } from "@/types/meeting";
import { Task, DAYS_OF_WEEK_MAP } from "@/types/task";
import TaskItem from "@/components/TaskItem";
import QuickAddTaskInput from "@/components/dashboard/QuickAddTaskInput";
import { getAdjustedTaskCompletionStatus } from "@/utils/taskHelpers";
import TaskForm from "@/components/TaskForm";

const fetchMeetingsByDate = async (userId: string, date: Date): Promise<Meeting[]> => {
  const formattedDate = format(date, "yyyy-MM-dd");
  const { data, error } = await supabase
    .from("meetings")
    .select("*")
    .eq("user_id", userId)
    .eq("date", formattedDate)
    .order("start_time", { ascending: true });
  if (error) {
    throw error;
  }
  return data || [];
};

const fetchTasksForDate = async (userId: string, date: Date): Promise<Task[]> => {
  const formattedDate = format(date, "yyyy-MM-dd");
  const currentDayOfWeek = getDay(date); // 0 for Sunday, 1 for Monday, etc.

  const { data, error } = await supabase
    .from("tasks")
    .select(`
      *,
      task_tags(
        tags(id, name, color)
      )
    `)
    .eq("user_id", userId)
    .or(`due_date.eq.${formattedDate},recurrence_type.neq.none`); // Tasks due today OR recurring

  if (error) {
    throw error;
  }

  const isDayIncluded = (details: string | null | undefined, dayIndex: number) => {
    if (!details) return false;
    const days = details.split(',');
    return days.some(day => DAYS_OF_WEEK_MAP[day] === dayIndex);
  };

  const filteredTasks = data?.filter(task => {
    let isTaskRelevantForDate = false;

    if (task.recurrence_type !== "none") {
      if (task.recurrence_type === "daily") {
        isTaskRelevantForDate = true;
      } else if (task.recurrence_type === "weekly" && task.recurrence_details) {
        isTaskRelevantForDate = isDayIncluded(task.recurrence_details, currentDayOfWeek);
      } else if (task.recurrence_type === "monthly" && task.recurrence_details) {
        isTaskRelevantForDate = parseInt(task.recurrence_details) === date.getDate();
      }
    } else if (task.due_date) {
      isTaskRelevantForDate = format(parseISO(task.due_date), "yyyy-MM-dd") === formattedDate;
    }
    
    // Only show tasks that are relevant for the date and not completed for their current cycle
    return isTaskRelevantForDate && !getAdjustedTaskCompletionStatus(task);
  }) || [];

  const mappedData = filteredTasks.map((task: any) => ({
    ...task,
    tags: task.task_tags.map((tt: any) => tt.tags),
  }));

  // Sort tasks by time, then by creation date
  mappedData.sort((a: Task, b: Task) => {
    if (a.time && b.time) {
      return a.time.localeCompare(b.time);
    }
    if (a.time) return -1; // Tasks with time come first
    if (b.time) return 1;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  return mappedData;
};

const Planner: React.FC = () => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [isMeetingFormOpen, setIsMeetingFormOpen] = useState(false);
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);

  const { data: meetings, isLoading: isLoadingMeetings, error: meetingsError, refetch: refetchMeetings } = useQuery<Meeting[], Error>({
    queryKey: ["meetings", userId, selectedDate?.toISOString()],
    queryFn: () => fetchMeetingsByDate(userId!, selectedDate!),
    enabled: !!userId && !!selectedDate,
  });

  const { data: tasks, isLoading: isLoadingTasks, error: tasksError, refetch: refetchTasks } = useQuery<Task[], Error>({
    queryKey: ["dailyPlannerTasks", userId, selectedDate?.toISOString()],
    queryFn: () => fetchTasksForDate(userId!, selectedDate!),
    enabled: !!userId && !!selectedDate,
  });

  if (meetingsError) {
    showError("Erro ao carregar reuniões: " + meetingsError.message);
  }
  if (tasksError) {
    showError("Erro ao carregar tarefas: " + tasksError.message);
  }

  const handleTaskAdded = () => {
    refetchTasks();
    queryClient.invalidateQueries({ queryKey: ["dashboardTasks", userId] });
    queryClient.invalidateQueries({ queryKey: ["allTasks", userId] });
  };

  const buildTaskTree = (allTasks: Task[]): Task[] => {
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
  };

  const taskTree = buildTaskTree(tasks || []);

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 lg:p-6 bg-background text-foreground">
      <h1 className="text-3xl font-bold flex items-center gap-3">
        <CalendarDays className="h-8 w-8 text-primary" /> Planner
      </h1>
      <p className="text-lg text-muted-foreground">
        Organize seu dia, visualize tarefas e eventos do calendário.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna do Calendário */}
        <Card className="bg-card border border-border rounded-xl shadow-lg p-4 flex flex-col items-center justify-center">
          <CardHeader className="w-full text-center pb-2">
            <CardTitle className="text-2xl font-semibold text-foreground">Selecionar Data</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center p-0">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              initialFocus
              locale={ptBR}
              className="rounded-lg border bg-popover text-popover-foreground shadow-md"
            />
          </CardContent>
        </Card>

        {/* Colunas de Reuniões e Tarefas */}
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card de Reuniões */}
          <Card className="flex flex-col bg-card border border-border rounded-xl shadow-lg">
            <CardHeader className="border-b border-border p-4 flex flex-row items-center justify-between">
              <CardTitle className="text-xl font-semibold text-foreground flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-primary" /> Reuniões
              </CardTitle>
              <Dialog open={isMeetingFormOpen} onOpenChange={setIsMeetingFormOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md">
                    <PlusCircle className="mr-2 h-4 w-4" /> Adicionar
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px] w-[90vw] bg-card border border-border rounded-lg shadow-lg">
                  <DialogHeader>
                    <DialogTitle className="text-foreground">Adicionar Nova Reunião</DialogTitle>
                    <DialogDescription className="text-muted-foreground">
                      Crie uma nova reunião para a data selecionada.
                    </DialogDescription>
                  </DialogHeader>
                  <MeetingForm
                    initialData={selectedDate ? { date: selectedDate, title: "", start_time: "" } as MeetingFormValues : undefined}
                    onMeetingSaved={refetchMeetings}
                    onClose={() => setIsMeetingFormOpen(false)}
                  />
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="flex-grow p-4 overflow-y-auto space-y-3">
              {isLoadingMeetings ? (
                <p className="text-center text-muted-foreground">Carregando reuniões...</p>
              ) : meetings && meetings.length > 0 ? (
                meetings.map((meeting) => (
                  <MeetingItem key={meeting.id} meeting={meeting} refetchMeetings={refetchMeetings} />
                ))
              ) : (
                <p className="text-center text-muted-foreground">Nenhuma reunião agendada para esta data.</p>
              )}
            </CardContent>
          </Card>

          {/* Card de Tarefas */}
          <Card className="flex flex-col bg-card border border-border rounded-xl shadow-lg">
            <CardHeader className="border-b border-border p-4 flex flex-row items-center justify-between">
              <CardTitle className="text-xl font-semibold text-foreground flex items-center gap-2">
                <ListTodo className="h-5 w-5 text-primary" /> Tarefas
              </CardTitle>
              <Dialog open={isTaskFormOpen} onOpenChange={setIsTaskFormOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md">
                    <PlusCircle className="mr-2 h-4 w-4" /> Adicionar
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px] w-[90vw] bg-card border border-border rounded-lg shadow-lg">
                  <DialogHeader>
                    <DialogTitle className="text-foreground">Adicionar Nova Tarefa</DialogTitle>
                    <DialogDescription className="text-muted-foreground">
                      Crie uma nova tarefa para a data selecionada.
                    </DialogDescription>
                  </DialogHeader>
                  <TaskForm
                    onTaskSaved={handleTaskAdded}
                    onClose={() => setIsTaskFormOpen(false)}
                    initialOriginBoard="general"
                    initialData={selectedDate ? { due_date: selectedDate, title: "", recurrence_type: "none", origin_board: "general", selected_tag_ids: [] } as any : undefined}
                  />
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="flex-grow p-4 overflow-y-auto space-y-3">
              <QuickAddTaskInput originBoard="general" onTaskAdded={handleTaskAdded} dueDate={selectedDate} />
              <div className="mt-4 space-y-3">
                {isLoadingTasks ? (
                  <p className="text-center text-muted-foreground">Carregando tarefas...</p>
                ) : taskTree && taskTree.length > 0 ? (
                  taskTree.map((task) => (
                    <TaskItem key={task.id} task={task} refetchTasks={handleTaskAdded} />
                  ))
                ) : (
                  <p className="text-center text-muted-foreground">Nenhuma tarefa agendada para esta data.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Planner;