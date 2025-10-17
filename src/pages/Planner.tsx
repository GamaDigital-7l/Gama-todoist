"use client";

import React, { useState } from "react";
import { CalendarDays, PlusCircle, Briefcase, ListTodo, Clock, MapPin, Link as LinkIcon, Edit, Trash2, AlertCircle, Star } from "lucide-react"; // Adicionado Edit, Trash2, AlertCircle, Star
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { format, isSameDay, parseISO, getDay, isFuture } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/integrations/supabase/auth";
import { showError } from "@/utils/toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import MeetingForm, { MeetingFormValues } from "@/components/MeetingForm";
import MeetingItem from "@/components/MeetingItem";
import { Meeting } from "@/types/meeting";
import { Task, DAYS_OF_WEEK_MAP } from "@/types/task";
import TaskItem from "@/components/TaskItem";
import QuickAddTaskInput from "@/components/dashboard/QuickAddTaskInput";
import { getAdjustedTaskCompletionStatus } from "@/utils/taskHelpers";
import TaskForm from "@/components/TaskForm";
import { cn } from "@/lib/utils"; // Importar cn

interface GoogleCalendarEvent {
  id: string;
  google_event_id: string;
  calendar_id: string;
  title: string;
  description?: string | null;
  start_time: string; // ISO string
  end_time: string; // ISO string
  location?: string | null;
  html_link?: string | null;
}

const fetchMeetingsByDate = async (userId: string, date: Date): Promise<Meeting[]> => {
  const formattedDate = format(date, "yyyy-MM-dd");
  const { data, error } = await supabase
    .from("meetings")
    .select("id, title, description, date, start_time, end_time, location, created_at")
    .eq("user_id", userId)
    .eq("date", formattedDate)
    .order("start_time", { ascending: true });
  if (error) {
    throw error;
  }
  return data || [];
};

const fetchFutureMeetings = async (userId: string): Promise<Meeting[]> => {
  const today = format(new Date(), "yyyy-MM-dd");
  const { data, error } = await supabase
    .from("meetings")
    .select("id, title, description, date, start_time, end_time, location")
    .eq("user_id", userId)
    .gte("date", today) // Apenas reuniões a partir de hoje
    .order("date", { ascending: true })
    .order("start_time", { ascending: true })
    .limit(5); // Limitar a 5 próximas reuniões
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
      id, title, description, due_date, time, is_completed, recurrence_type, recurrence_details, 
      last_successful_completion_date, origin_board, current_board, is_priority, overdue, parent_task_id, created_at,
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

const fetchGoogleCalendarEvents = async (userId: string, date: Date): Promise<GoogleCalendarEvent[]> => {
  const formattedDate = format(date, "yyyy-MM-dd");
  const { data, error } = await supabase
    .from("events")
    .select("id, google_event_id, calendar_id, title, description, start_time, end_time, location, html_link")
    .eq("user_id", userId)
    .gte("start_time", `${formattedDate}T00:00:00Z`)
    .lte("start_time", `${formattedDate}T23:59:59Z`)
    .order("start_time", { ascending: true });

  if (error) {
    throw error;
  }
  return data || [];
};

const Planner: React.FC = () => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [isMeetingFormOpen, setIsMeetingFormOpen] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<MeetingFormValues & { id: string } | undefined>(undefined);
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined);


  const { data: meetings, isLoading: isLoadingMeetings, error: meetingsError, refetch: refetchMeetings } = useQuery<Meeting[], Error>({
    queryKey: ["meetings", userId, selectedDate?.toISOString()],
    queryFn: () => fetchMeetingsByDate(userId!, selectedDate!),
    enabled: !!userId && !!selectedDate,
  });

  const { data: futureMeetings, isLoading: isLoadingFutureMeetings, error: futureMeetingsError, refetch: refetchFutureMeetings } = useQuery<Meeting[], Error>({
    queryKey: ["futureMeetings", userId],
    queryFn: () => fetchFutureMeetings(userId!),
    enabled: !!userId,
  });

  const { data: tasks, isLoading: isLoadingTasks, error: tasksError, refetch: refetchTasks } = useQuery<Task[], Error>({
    queryKey: ["dailyPlannerTasks", userId, selectedDate?.toISOString()],
    queryFn: () => fetchTasksForDate(userId!, selectedDate!),
    enabled: !!userId && !!selectedDate,
  });

  const { data: googleEvents, isLoading: isLoadingGoogleEvents, error: googleEventsError, refetch: refetchGoogleEvents } = useQuery<GoogleCalendarEvent[], Error>({
    queryKey: ["googleEvents", userId, selectedDate?.toISOString()],
    queryFn: () => fetchGoogleCalendarEvents(userId!, selectedDate!),
    enabled: !!userId && !!selectedDate,
  });

  if (meetingsError) {
    showError("Erro ao carregar reuniões: " + meetingsError.message);
  }
  if (tasksError) {
    showError("Erro ao carregar tarefas: " + tasksError.message);
  }
  if (futureMeetingsError) {
    showError("Erro ao carregar próximas reuniões: " + futureMeetingsError.message);
  }
  if (googleEventsError) {
    showError("Erro ao carregar eventos do Google Calendar: " + googleEventsError.message);
  }

  const handleTaskAdded = () => {
    refetchTasks();
    queryClient.invalidateQueries({ queryKey: ["dashboardTasks", userId] });
    queryClient.invalidateQueries({ queryKey: ["allTasks", userId] });
  };

  const handleMeetingSaved = () => {
    refetchMeetings();
    refetchFutureMeetings(); // Refetch future meetings after a meeting is saved
    setIsMeetingFormOpen(false); // Fechar o formulário após salvar
    setEditingMeeting(undefined); // Resetar o estado de edição
  };

  const handleEditMeeting = (meeting: Meeting) => {
    const editableMeeting: MeetingFormValues & { id: string } = {
      id: meeting.id,
      title: meeting.title,
      description: meeting.description || undefined,
      date: parseISO(meeting.date),
      start_time: meeting.start_time,
      end_time: meeting.end_time || undefined,
      location: meeting.location || undefined,
    };
    setEditingMeeting(editableMeeting);
    setIsMeetingFormOpen(true);
  };

  const handleDeleteMeeting = async (meetingId: string) => {
    if (!userId) {
      showError("Usuário não autenticado.");
      return;
    }
    if (window.confirm("Tem certeza que deseja deletar esta reunião?")) {
      try {
        const { error } = await supabase
          .from("meetings")
          .delete()
          .eq("id", meetingId)
          .eq("user_id", userId);

        if (error) throw error;
        showSuccess("Reunião deletada com sucesso!");
        refetchMeetings();
        refetchFutureMeetings();
      } catch (err: any) {
        showError("Erro ao deletar reunião: " + err.message);
        console.error("Erro ao deletar reunião:", err);
      }
    }
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setIsTaskFormOpen(true);
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!userId) {
      showError("Usuário não autenticado.");
      return;
    }
    if (window.confirm("Tem certeza que deseja deletar esta tarefa e todas as suas subtarefas?")) {
      try {
        await supabase.from("task_tags").delete().eq("task_id", taskId);

        const { error } = await supabase
          .from("tasks")
          .delete()
          .eq("id", taskId)
          .eq("user_id", userId);

        if (error) throw error;
        showSuccess("Tarefa deletada com sucesso!");
        handleTaskAdded(); // Refetch all relevant task queries
      } catch (err: any) {
        showError("Erro ao deletar tarefa: " + err.message);
        console.error("Erro ao deletar tarefa:", err);
      }
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

  // Combinar reuniões e eventos do Google Calendar e ordenar por hora
  const combinedEvents = [
    ...(meetings || []).map(m => ({
      type: 'meeting',
      id: m.id,
      title: m.title,
      description: m.description,
      start_time: parseISO(`${m.date}T${m.start_time}`),
      end_time: m.end_time ? parseISO(`${m.date}T${m.end_time}`) : undefined,
      location: m.location,
      html_link: undefined,
      original_meeting: m, // Adiciona a reunião original para edição/exclusão
    })),
    ...(googleEvents || []).map(ge => ({
      type: 'google_event',
      id: ge.id,
      title: ge.title,
      description: ge.description,
      start_time: parseISO(ge.start_time),
      end_time: parseISO(ge.end_time),
      location: ge.location,
      html_link: ge.html_link,
      original_meeting: undefined, // Eventos do Google não têm original_meeting
    })),
  ].sort((a, b) => a.start_time.getTime() - b.start_time.getTime());

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 lg:p-6 bg-background text-foreground">
      <h1 className="text-3xl font-bold flex items-center gap-3">
        <CalendarDays className="h-8 w-8 text-primary flex-shrink-0" /> Planner
      </h1>
      <p className="text-lg text-muted-foreground">
        Organize seu dia, visualize tarefas e eventos do calendário.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna Esquerda: Calendário e Próximas Reuniões */}
        <div className="flex flex-col gap-6">
          <Card className="bg-card border border-border rounded-xl shadow-lg p-4 flex flex-col items-center justify-center frosted-glass card-hover-effect">
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

          <Card className="bg-card border border-border rounded-xl shadow-lg frosted-glass card-hover-effect">
            <CardHeader className="border-b border-border p-4">
              <CardTitle className="text-xl font-semibold text-foreground flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-primary flex-shrink-0" /> Próximas Reuniões
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Um resumo das suas próximas reuniões.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {isLoadingFutureMeetings ? (
                <p className="text-center text-muted-foreground">Carregando próximas reuniões...</p>
              ) : futureMeetings && futureMeetings.length > 0 ? (
                futureMeetings.map((meeting) => (
                  <div key={meeting.id} className="flex flex-col p-2 border border-border rounded-xl bg-background shadow-sm frosted-glass card-hover-effect">
                    <p className="text-sm font-medium text-foreground flex items-center gap-1 break-words">
                      {meeting.title}
                    </p>
                    {meeting.description && (
                      <p className="text-xs text-muted-foreground break-words">{meeting.description}</p>
                    )}
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <CalendarDays className="h-3 w-3 flex-shrink-0" /> {format(parseISO(meeting.date), "PPP", { locale: ptBR })}
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3 flex-shrink-0" /> {meeting.start_time} {meeting.end_time ? `- ${meeting.end_time}` : ''}
                    </p>
                    {meeting.location && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 break-words">
                        <MapPin className="h-3 w-3 flex-shrink-0" /> {meeting.location}
                      </p>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-center text-muted-foreground">Nenhuma reunião futura agendada.</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Colunas do Meio e Direita: Reuniões/Eventos do Dia e Tarefas do Dia */}
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card de Reuniões e Eventos do Dia */}
          <Card className="flex flex-col bg-card border border-border rounded-xl shadow-lg frosted-glass card-hover-effect">
            <CardHeader className="border-b border-border p-4 flex flex-row items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-xl font-semibold text-foreground flex items-center gap-2 min-w-0">
                <Briefcase className="h-5 w-5 text-primary flex-shrink-0" /> Eventos para {selectedDate ? format(selectedDate, "PPP", { locale: ptBR }) : "Nenhuma Data Selecionada"}
              </CardTitle>
              <Dialog open={isMeetingFormOpen} onOpenChange={(open) => {
                setIsMeetingFormOpen(open);
                if (!open) setEditingMeeting(undefined); // Resetar o estado de edição ao fechar
              }}>
                <DialogTrigger asChild>
                  <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md flex-shrink-0">
                    <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Reunião
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px] w-[90vw] bg-card border border-border rounded-lg shadow-lg max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="text-foreground">{editingMeeting ? "Editar Reunião" : "Adicionar Nova Reunião"}</DialogTitle>
                    <DialogDescription className="text-muted-foreground">
                      {editingMeeting ? "Atualize os detalhes da sua reunião." : "Crie uma nova reunião para a data selecionada."}
                    </DialogDescription>
                  </DialogHeader>
                  <MeetingForm
                    initialData={editingMeeting || (selectedDate ? { date: selectedDate, title: "", start_time: "" } as MeetingFormValues : undefined)}
                    onMeetingSaved={handleMeetingSaved}
                    onClose={() => setIsMeetingFormOpen(false)}
                  />
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="flex-grow p-4 overflow-y-auto space-y-3">
              {(isLoadingMeetings || isLoadingGoogleEvents) ? (
                <p className="text-center text-muted-foreground">Carregando eventos...</p>
              ) : combinedEvents && combinedEvents.length > 0 ? (
                combinedEvents.map((event) => (
                  <div key={event.id} className="flex flex-col p-2 border border-border rounded-xl bg-background shadow-sm frosted-glass card-hover-effect">
                    <p className="text-sm font-medium text-foreground flex items-center gap-1 break-words">
                      {event.type === 'google_event' && <LinkIcon className="h-3 w-3 text-blue-500 flex-shrink-0" />}
                      {event.title}
                    </p>
                    {event.description && (
                      <p className="text-xs text-muted-foreground break-words">{event.description}</p>
                    )}
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3 flex-shrink-0" /> {format(event.start_time, "HH:mm")} {event.end_time ? `- ${format(event.end_time, "HH:mm")}` : ''}
                    </p>
                    {event.location && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 break-words">
                        <MapPin className="h-3 w-3 flex-shrink-0" /> {event.location}
                      </p>
                    )}
                    {event.html_link && (
                      <a href={event.html_link} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline flex items-center gap-1 mt-1">
                        Ver no Google Calendar <LinkIcon className="h-3 w-3 flex-shrink-0" />
                      </a>
                    )}
                    {event.type === 'meeting' && (
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <Button variant="ghost" size="icon" onClick={() => handleEditMeeting(event.original_meeting!)} className="h-7 w-7 text-blue-500 hover:bg-blue-500/10">
                          <Edit className="h-4 w-4" />
                          <span className="sr-only">Editar Reunião</span>
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteMeeting(event.id)} className="h-7 w-7 text-red-500 hover:bg-red-500/10">
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Deletar Reunião</span>
                        </Button>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-center text-muted-foreground">Nenhum evento agendado para esta data.</p>
              )}
            </CardContent>
          </Card>

          {/* Card de Tarefas do Dia */}
          <Card className="flex flex-col bg-card border border-border rounded-xl shadow-lg frosted-glass card-hover-effect">
            <CardHeader className="border-b border-border p-4 flex flex-row items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-xl font-semibold text-foreground flex items-center gap-2 min-w-0">
                <ListTodo className="h-5 w-5 text-primary flex-shrink-0" /> Tarefas para {selectedDate ? format(selectedDate, "PPP", { locale: ptBR }) : "Nenhuma Data Selecionada"}
              </CardTitle>
              <Dialog open={isTaskFormOpen} onOpenChange={(open) => {
                setIsTaskFormOpen(open);
                if (!open) setEditingTask(undefined); // Resetar o estado de edição ao fechar
              }}>
                <DialogTrigger asChild>
                  <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md flex-shrink-0">
                    <PlusCircle className="mr-2 h-4 w-4" /> Adicionar
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px] w-[90vw] bg-card border border-border rounded-lg shadow-lg max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="text-foreground">{editingTask ? "Editar Tarefa" : "Adicionar Nova Tarefa"}</DialogTitle>
                    <DialogDescription className="text-muted-foreground">
                      {editingTask ? "Atualize os detalhes da sua tarefa." : "Crie uma nova tarefa para a data selecionada."}
                    </DialogDescription>
                  </DialogHeader>
                  <TaskForm
                    initialData={editingTask ? { ...editingTask, due_date: editingTask.due_date ? parseISO(editingTask.due_date) : undefined } : (selectedDate ? { due_date: selectedDate, title: "", recurrence_type: "none", origin_board: "general", current_board: "general", is_priority: false, selected_tag_ids: [] } as any : undefined)}
                    onTaskSaved={handleTaskAdded}
                    onClose={() => setIsTaskFormOpen(false)}
                    initialOriginBoard="general"
                    initialDueDate={selectedDate} // Passa a data selecionada
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