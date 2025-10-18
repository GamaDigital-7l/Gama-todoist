"use client";

import React, { useState } from "react";
import { CalendarDays, PlusCircle, Briefcase, ListTodo, Clock, MapPin, Link as LinkIcon, Edit, Trash2, AlertCircle, Star } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { format, isSameDay, parseISO, getDay, isFuture, eachDayOfInterval } from "date-fns"; // Importação corrigida
import { ptBR } from "date-fns/locale";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/integrations/supabase/auth";
import { showError, showSuccess } from "@/utils/toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import MeetingForm, { MeetingFormValues, meetingSchema } from "@/components/MeetingForm"; // Importar schema e tipo
import { Meeting } from "@/types/meeting";
import { Task, DAYS_OF_WEEK_MAP } from "@/types/task";
import TaskItem from "@/components/TaskItem";
import QuickAddTaskInput from "@/components/dashboard/QuickAddTaskInput";
import { getAdjustedTaskCompletionStatus } from "@/utils/taskHelpers";
import TaskForm from "@/components/TaskForm";
import { cn } from "@/lib/utils";
import { DIALOG_CONTENT_CLASSNAMES } from "@/lib/constants";
import * as z from "zod"; // Importar zod
import { zodResolver } from "@hookform/resolvers/zod"; // Importar zodResolver
import { useForm } from "react-hook-form"; // Importar useForm

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
    .select("id, user_id, title, description, date, start_time, end_time, location, google_event_id, google_html_link, created_at, updated_at") 
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
    .select("id, user_id, title, description, date, start_time, end_time, location, google_event_id, google_html_link, created_at, updated_at") 
    .eq("user_id", userId)
    .gte("date", today) 
    .order("date", { ascending: true })
    .order("start_time", { ascending: true })
    .limit(5); 
  if (error) {
    throw error;
  }
  return data || [];
};

const fetchTasksForDate = async (userId: string, date: Date): Promise<Task[]> => {
  const formattedDate = format(date, "yyyy-MM-dd");
  const currentDayOfWeek = getDay(date); 

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
    .or(`due_date.eq.${formattedDate},recurrence_type.neq.none`); 

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
    
    return isTaskRelevantForDate && !getAdjustedTaskCompletionStatus(task);
  }) || [];

  const mappedData = filteredTasks.map((task: any) => ({
    ...task,
    tags: task.task_tags.map((tt: any) => tt.tags),
  }));

  mappedData.sort((a: Task, b: Task) => {
    if (a.time && b.time) {
      return a.time.localeCompare(b.time);
    }
    if (a.time) return -1; 
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
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined);

  // New form state for MeetingForm
  const meetingForm = useForm<MeetingFormValues>({
    resolver: zodResolver(meetingSchema),
    defaultValues: {
      title: "",
      description: "",
      date: new Date(),
      start_time: "",
      end_time: null,
      location: "",
      sendToGoogleCalendar: false,
      id: undefined,
      google_event_id: null,
      google_html_link: null,
    },
  });
  const [isMeetingSubmitting, setIsMeetingSubmitting] = useState(false);


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
    refetchFutureMeetings(); 
    refetchGoogleEvents(); 
    setIsMeetingFormOpen(false); 
    meetingForm.reset(); // Reset the form after saving
  };

  const handleMeetingSubmit = async (values: MeetingFormValues) => {
    if (!userId) {
      showError("Usuário não autenticado.");
      return;
    }
    setIsMeetingSubmitting(true);

    try {
      let googleEventId: string | null = values.google_event_id || null;
      let googleHtmlLink: string | null = values.google_html_link || null;
      const currentMeetingId = values.id;

      const formattedDate = format(values.date, "yyyy-MM-dd");

      if (values.sendToGoogleCalendar) {
        if (!session?.access_token) {
          showError("Sessão não encontrada. Faça login novamente para interagir com o Google Calendar.");
          setIsMeetingSubmitting(false);
          return;
        }

        if (googleEventId) {
          const { data: googleData, error: googleError } = await supabase.functions.invoke('update-google-calendar-event', {
            body: {
              googleEventId: googleEventId,
              title: values.title,
              description: values.description,
              date: formattedDate,
              startTime: values.start_time,
              endTime: values.end_time,
              location: values.location,
            },
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
            },
          });

          if (googleError) {
            throw new Error(googleError.message || "Erro ao atualizar evento no Google Calendar.");
          }
          googleEventId = googleData.googleEventId;
          googleHtmlLink = googleData.htmlLink;
          showSuccess("Evento atualizado no Google Calendar!");
        } else {
          const { data: googleData, error: googleError } = await supabase.functions.invoke('create-google-calendar-event', {
            body: {
              title: values.title,
              description: values.description,
              date: formattedDate,
              startTime: values.start_time,
              endTime: values.end_time,
              location: values.location,
            },
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
            },
          });

          if (googleError) {
            throw new Error(googleError.message || "Erro ao criar evento no Google Calendar.");
          }
          googleEventId = googleData.googleEventId;
          googleHtmlLink = googleData.htmlLink;
          showSuccess("Evento criado no Google Calendar!");
        }
      } else if (googleEventId) {
        if (!session?.access_token) {
          showError("Sessão não encontrada. Faça login novamente para interagir com o Google Calendar.");
          setIsMeetingSubmitting(false);
          return;
        }
        const { error: googleDeleteError } = await supabase.functions.invoke('delete-google-calendar-event', {
          body: { googleEventId: googleEventId },
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        });

        if (googleDeleteError) {
          if (googleDeleteError.status === 404) {
            console.warn(`Evento Google Calendar ${googleEventId} não encontrado, mas a exclusão foi solicitada. Prosseguindo com exclusão local.`);
          } else {
            throw new Error(googleDeleteError.message || "Erro ao deletar evento do Google Calendar.");
          }
        }
        googleEventId = null;
        googleHtmlLink = null;
        showSuccess("Evento removido do Google Calendar!");
      }

      const dataToSave = {
        title: values.title,
        description: values.description || null,
        date: formattedDate,
        start_time: values.start_time,
        end_time: values.end_time || null,
        location: values.location || null,
        google_event_id: googleEventId, 
        google_html_link: googleHtmlLink, 
        updated_at: new Date().toISOString(),
      };

      if (currentMeetingId) {
        const { error } = await supabase
          .from("meetings")
          .update(dataToSave)
          .eq("id", currentMeetingId)
          .eq("user_id", userId);

        if (error) throw error;
        showSuccess("Reunião atualizada com sucesso!");
      } else {
        const { error } = await supabase.from("meetings").insert({
          ...dataToSave,
          user_id: userId,
        });

        if (error) throw error;
        showSuccess("Reunião adicionada com sucesso!");
      }
      meetingForm.reset();
      handleMeetingSaved();
      setIsMeetingFormOpen(false); // Close dialog
    } catch (error: any) {
      showError("Erro ao salvar reunião: " + error.message);
      console.error("Erro ao salvar reunião:", error);
    } finally {
      setIsMeetingSubmitting(false);
    }
  };

  const handleEditMeeting = (meeting: Meeting) => {
    meetingForm.reset({
      id: meeting.id,
      title: meeting.title,
      description: meeting.description || "",
      date: parseISO(meeting.date),
      start_time: meeting.start_time,
      end_time: meeting.end_time || null,
      location: meeting.location || "",
      sendToGoogleCalendar: !!meeting.google_event_id,
      google_event_id: meeting.google_event_id,
      google_html_link: meeting.google_html_link,
    });
    setIsMeetingFormOpen(true);
  };

  const handleDeleteMeeting = async (meetingId: string, googleEventId: string | null) => {
    if (!userId) {
      showError("Usuário não autenticado.");
      return;
    }
    if (window.confirm("Tem certeza que deseja deletar esta reunião?")) {
      try {
        if (googleEventId && session?.access_token) {
          const { error: googleDeleteError } = await supabase.functions.invoke('delete-google-calendar-event', {
            body: { googleEventId: googleEventId },
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
            },
          });
          if (googleDeleteError) {
            if (googleDeleteError.status === 404) {
              console.warn(`Evento Google Calendar ${googleEventId} não encontrado, mas a exclusão foi solicitada. Prosseguindo com exclusão local.`);
            } else {
              throw new Error(googleDeleteError.message || "Erro ao deletar evento do Google Calendar.");
            }
          }
          showSuccess("Evento removido do Google Calendar!");
        }

        const { error } = await supabase
          .from("meetings")
          .delete()
          .eq("id", meetingId)
          .eq("user_id", userId);

        if (error) throw error;
        showSuccess("Reunião deletada com sucesso!");
        handleMeetingSaved();
      } catch (err: any) {
        showError("Erro ao deletar reunião: " + err.message);
        console.error("Erro ao deletar reunião:", err);
      }
    }
  };

  const handleEditGoogleEvent = (event: GoogleCalendarEvent) => {
    meetingForm.reset({
      id: event.id, // Usar o ID do evento local para atualização
      title: event.title,
      description: event.description || "",
      date: parseISO(event.start_time), // Usar start_time como base para a data
      start_time: format(parseISO(event.start_time), "HH:mm"),
      end_time: event.end_time ? format(parseISO(event.end_time), "HH:mm") : null,
      location: event.location || "",
      sendToGoogleCalendar: true, // Já está no Google Calendar
      google_event_id: event.google_event_id,
      google_html_link: event.html_link,
    });
    setIsMeetingFormOpen(true);
  };

  const handleDeleteGoogleEvent = async (eventId: string, googleEventId: string) => {
    if (!userId || !session?.access_token) {
      showError("Usuário não autenticado ou sessão expirada. Faça login novamente.");
      return;
    }
    if (window.confirm("Tem certeza que deseja deletar este evento do Google Calendar?")) {
      try {
        const { error: googleDeleteError } = await supabase.functions.invoke('delete-google-calendar-event', {
          body: { googleEventId: googleEventId },
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        });

        if (googleDeleteError) {
          if (googleDeleteError.status === 404) {
            console.warn(`Evento Google Calendar ${googleEventId} não encontrado, mas a exclusão foi solicitada. Prosseguindo com exclusão local.`);
          } else {
            throw new Error(googleDeleteError.message || "Erro ao deletar evento do Google Calendar.");
          }
        }

        // Remover o evento do banco de dados local também
        const { error: dbDeleteError } = await supabase
          .from("events")
          .delete()
          .eq("id", eventId)
          .eq("user_id", userId);

        if (dbDeleteError) throw dbDeleteError;

        showSuccess("Evento do Google Calendar deletado com sucesso!");
        refetchGoogleEvents();
        refetchMeetings(); // Pode ser que o evento estivesse duplicado como reunião local
      } catch (err: any) {
        showError("Erro ao deletar evento do Google Calendar: " + err.message);
        console.error("Erro ao deletar evento do Google Calendar:", err);
      }
    }
  };

  const combinedEvents = [
    ...(meetings || []).map(m => ({
      type: "meeting",
      id: m.id,
      title: m.title,
      description: m.description || "",
      start_time: `${m.date}T${m.start_time}:00`,
      end_time: m.end_time ? `${m.date}T${m.end_time}:00` : null,
      location: m.location || "",
      html_link: m.google_html_link || null,
      google_event_id: m.google_event_id || null,
      original_meeting: m,
    })),
    ...(googleEvents || []).map(ge => ({
      type: "google_event",
      id: ge.id,
      google_event_id: ge.google_event_id,
      calendar_id: ge.calendar_id,
      title: ge.title,
      description: ge.description || "",
      start_time: ge.start_time,
      end_time: ge.end_time,
      location: ge.location || "",
      html_link: ge.html_link || null,
      original_meeting: ge, // Manter referência ao objeto original
    })),
  ].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:px-10 lg:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between flex-wrap gap-3">
        <h1 className="text-3xl font-bold text-foreground">Planner Diário</h1>
        <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-end w-full sm:w-auto">
          <Dialog
            open={isMeetingFormOpen}
            onOpenChange={(open) => {
              setIsMeetingFormOpen(open);
              if (!open) meetingForm.reset(); // Reset form on close
            }}
          >
            <DialogTrigger asChild>
              <Button onClick={() => meetingForm.reset({ date: selectedDate || new Date(), sendToGoogleCalendar: false })} className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90">
                <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Reunião
              </Button>
            </DialogTrigger>
            <DialogContent className={DIALOG_CONTENT_CLASSNAMES}>
              <DialogHeader>
                <DialogTitle className="text-foreground">
                  {meetingForm.watch("id") ? "Editar Reunião" : "Adicionar Nova Reunião"}
                </DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  {meetingForm.watch("id") ? "Atualize os detalhes da sua reunião." : "Crie uma nova reunião para organizar seu dia."}
                </DialogDescription>
              </DialogHeader>
              <MeetingForm
                initialData={meetingForm.watch("id") ? { ...meetingForm.getValues(), date: meetingForm.getValues("date") } as MeetingFormValues & { id: string } : undefined}
                onMeetingSaved={handleMeetingSaved}
                onClose={() => setIsMeetingFormOpen(false)}
              />
            </DialogContent>
          </Dialog>

          <Dialog
            open={isTaskFormOpen}
            onOpenChange={(open) => {
              setIsTaskFormOpen(open);
              if (!open) setEditingTask(undefined);
            }}
          >
            <DialogTrigger asChild>
              <Button onClick={() => setEditingTask(undefined)} variant="outline" className="w-full sm:w-auto border-primary text-primary hover:bg-primary/10">
                <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Tarefa
              </Button>
            </DialogTrigger>
            <DialogContent className={DIALOG_CONTENT_CLASSNAMES}>
              <DialogHeader>
                <DialogTitle className="text-foreground">
                  {editingTask ? "Editar Tarefa" : "Adicionar Nova Tarefa"}
                </DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  {editingTask ? "Atualize os detalhes da sua tarefa." : "Crie uma nova tarefa para organizar seu dia."}
                </DialogDescription>
              </DialogHeader>
              <TaskForm
                initialData={editingTask ? { ...editingTask, due_date: editingTask.due_date ? parseISO(editingTask.due_date) : undefined } : undefined}
                onTaskSaved={handleTaskAdded}
                onClose={() => setIsTaskFormOpen(false)}
                initialDueDate={selectedDate}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 bg-card border border-border rounded-xl shadow-sm frosted-glass card-hover-effect">
          <CardHeader>
            <CardTitle className="text-foreground">Calendário</CardTitle>
            <CardDescription className="text-muted-foreground">
              Selecione uma data para ver seus eventos e tarefas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              initialFocus
              locale={ptBR}
              className="rounded-md border border-border bg-input text-foreground"
            />
          </CardContent>
        </Card>

        <div className="lg:col-span-2 grid gap-6">
          <Card className="bg-card border border-border rounded-xl shadow-sm frosted-glass card-hover-effect">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xl font-semibold text-foreground flex items-center gap-2 min-w-0">
                <Briefcase className="h-5 w-5 text-primary flex-shrink-0" /> Eventos para {selectedDate ? format(selectedDate, "PPP", { locale: ptBR }) : "Nenhuma Data Selecionada"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingMeetings || isLoadingGoogleEvents ? (
                <p className="text-muted-foreground">Carregando eventos...</p>
              ) : combinedEvents.length === 0 ? (
                <p className="text-muted-foreground">Nenhum evento agendado para esta data.</p>
              ) : (
                <div className="space-y-4">
                  {combinedEvents.map((event) => (
                    <div key={event.type === "meeting" ? `meeting-${event.id}` : `google-${event.id}`} className="flex items-start gap-3 p-3 rounded-lg bg-muted/20 border border-border">
                      <div className="flex-shrink-0 mt-1">
                        {event.type === "meeting" ? (
                          <Briefcase className="h-5 w-5 text-blue-500" />
                        ) : (
                          <img src="/google-calendar-icon.svg" alt="Google Calendar" className="h-5 w-5" />
                        )}
                      </div>
                      <div className="flex-grow min-w-0">
                        <h3 className="font-semibold text-foreground text-base break-words">{event.title}</h3>
                        {event.description && <p className="text-sm text-muted-foreground break-words">{event.description}</p>}
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <Clock className="h-3 w-3 flex-shrink-0" /> {format(parseISO(event.start_time), "HH:mm")} {event.end_time && `- ${format(parseISO(event.end_time), "HH:mm")}`}
                        </p>
                        {event.location && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <MapPin className="h-3 w-3 flex-shrink-0" /> {event.location}
                          </p>
                        )}
                        {event.html_link && (
                          <a href={event.html_link} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline flex items-center gap-1">
                            <LinkIcon className="h-3 w-3 flex-shrink-0" /> Ver no Google Calendar
                          </a>
                        )}
                      </div>
                      <div className="flex-shrink-0 flex gap-1">
                        {event.type === "meeting" ? (
                          <>
                            <Button variant="ghost" size="icon" onClick={() => handleEditMeeting(event.original_meeting as Meeting)} className="h-7 w-7 text-blue-500 hover:bg-blue-500/10">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteMeeting(event.id, event.google_event_id)} className="h-7 w-7 text-red-500 hover:bg-red-500/10">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button variant="ghost" size="icon" onClick={() => handleEditGoogleEvent(event as GoogleCalendarEvent)} className="h-7 w-7 text-blue-500 hover:bg-blue-500/10">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteGoogleEvent(event.id, event.google_event_id!)} className="h-7 w-7 text-red-500 hover:bg-red-500/10">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card border border-border rounded-xl shadow-sm frosted-glass card-hover-effect">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xl font-semibold text-foreground flex items-center gap-2 min-w-0">
                <ListTodo className="h-5 w-5 text-primary flex-shrink-0" /> Tarefas para {selectedDate ? format(selectedDate, "PPP", { locale: ptBR }) : "Nenhuma Data Selecionada"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <QuickAddTaskInput originBoard="general" onTaskAdded={handleTaskAdded} dueDate={selectedDate} />
              </div>
              {isLoadingTasks ? (
                <p className="text-muted-foreground">Carregando tarefas...</p>
              ) : tasks && tasks.length === 0 ? (
                <p className="text-muted-foreground">Nenhuma tarefa agendada para esta data.</p>
              ) : (
                <div className="space-y-3">
                  {tasks?.map((task) => (
                    <TaskItem key={task.id} task={task} refetchTasks={handleTaskAdded} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="bg-card border border-border rounded-xl shadow-sm frosted-glass card-hover-effect">
        <CardHeader>
          <CardTitle className="text-foreground">Próximas Reuniões</CardTitle>
          <CardDescription className="text-muted-foreground">
            Suas próximas 5 reuniões agendadas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingFutureMeetings ? (
            <p className="text-muted-foreground">Carregando próximas reuniões...</p>
          ) : futureMeetings && futureMeetings.length === 0 ? (
            <p className="text-muted-foreground">Nenhuma reunião futura agendada.</p>
          ) : (
            <div className="space-y-4">
              {futureMeetings?.map((meeting) => (
                <div key={meeting.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/20 border border-border">
                  <Briefcase className="h-5 w-5 text-blue-500 flex-shrink-0 mt-1" />
                  <div className="flex-grow min-w-0">
                    <h3 className="font-semibold text-foreground text-base break-words">{meeting.title}</h3>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <CalendarDays className="h-3 w-3 flex-shrink-0" /> {format(parseISO(meeting.date), "PPP", { locale: ptBR })}
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3 flex-shrink-0" /> {meeting.start_time} {meeting.end_time && `- ${meeting.end_time}`}
                    </p>
                    {meeting.location && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3 flex-shrink-0" /> {meeting.location}
                      </p>
                    )}
                    {meeting.google_html_link && (
                      <a href={meeting.google_html_link} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline flex items-center gap-1">
                        <LinkIcon className="h-3 w-3 flex-shrink-0" /> Ver no Google Calendar
                      </a>
                    )}
                  </div>
                  <div className="flex-shrink-0 flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => handleEditMeeting(meeting)} className="h-7 w-7 text-blue-500 hover:bg-blue-500/10">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteMeeting(meeting.id, meeting.google_event_id)} className="h-7 w-7 text-red-500 hover:bg-red-500/10">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Planner;