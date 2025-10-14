"use client";

import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showError } from "@/utils/toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { format, isToday, parseISO, getDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { ArrowRight, ListTodo, Repeat, Clock, BookOpen, Dumbbell } from "lucide-react";
import { Link } from "react-router-dom";
import { useSession } from "@/integrations/supabase/auth";
import { Badge } from "@/components/ui/badge"; // Importar Badge

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface Task {
  id: string;
  title: string;
  description?: string;
  due_date?: string; // ISO string
  time?: string; // Formato "HH:mm"
  is_completed: boolean;
  recurrence_type: "none" | "daily_weekday" | "weekly" | "monthly";
  recurrence_details?: string;
  task_type: "general" | "reading" | "exercise"; // Novo campo
  target_value?: number; // Novo campo
  current_daily_target?: number; // Novo campo
  last_successful_completion_date?: string; // Novo campo
  tags: Tag[]; // Adicionar tags à interface da tarefa
}

const POINTS_PER_TASK = 10; // Pontos ganhos por tarefa concluída

const fetchTasks = async (): Promise<Task[]> => {
  const { data, error } = await supabase
    .from("tasks")
    .select(`
      *,
      tags (id, name, color)
    `)
    .order("created_at", { ascending: false });
  if (error) {
    throw error;
  }
  return data || [];
};

const DashboardTaskList: React.FC = () => {
  const { session } = useSession();
  const queryClient = useQueryClient();
  const { data: tasks, isLoading, error, refetch } = useQuery<Task[], Error>({
    queryKey: ["dashboardTasks"],
    queryFn: fetchTasks,
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, currentStatus }: { taskId: string; currentStatus: boolean }) => {
      const { error: updateError } = await supabase
        .from("tasks")
        .update({ 
          is_completed: !currentStatus, 
          updated_at: new Date().toISOString(),
          last_successful_completion_date: !currentStatus ? new Date().toISOString().split('T')[0] : null, // Define a data de conclusão se for marcada como completa
          current_daily_target: !currentStatus ? null : undefined, // Reseta o target diário ao completar
        })
        .eq("id", taskId);

      if (updateError) throw updateError;

      // Se a tarefa foi marcada como concluída e o usuário está logado, adicione pontos
      if (!currentStatus && session?.user?.id) {
        let currentPoints = 0;
        const { data: existingProfile, error: fetchProfileError } = await supabase
          .from("profiles")
          .select("points")
          .eq("id", session.user.id)
          .single();

        if (fetchProfileError && fetchProfileError.code !== 'PGRST116') { // PGRST116 significa que nenhuma linha foi encontrada
          throw fetchProfileError; // Re-lança outros erros
        }

        if (existingProfile) {
          currentPoints = existingProfile.points || 0;
        } else {
          // O perfil não existe, cria um com pontos padrão
          const { error: insertProfileError } = await supabase
            .from("profiles")
            .insert({ id: session.user.id, points: 0 }); // Insere com 0 pontos padrão

          if (insertProfileError) {
            throw insertProfileError;
          }
          // currentPoints permanece 0, pois é um novo perfil
        }

        const newPoints = currentPoints + POINTS_PER_TASK;
        const { error: pointsError } = await supabase
          .from("profiles")
          .update({ points: newPoints })
          .eq("id", session.user.id);

        if (pointsError) throw pointsError;
        queryClient.invalidateQueries({ queryKey: ["userProfile"] }); // Invalida o cache do perfil para atualizar os pontos
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboardTasks"] }); // Invalida o cache para refetch
    },
    onError: (err: any) => {
      showError("Erro ao atualizar tarefa: " + err.message);
      console.error("Erro ao atualizar tarefa:", err);
    },
  });

  const handleToggleComplete = (taskId: string, currentStatus: boolean) => {
    updateTaskMutation.mutate({ taskId, currentStatus });
  };

  const getRecurrenceText = (task: Task) => {
    switch (task.recurrence_type) {
      case "daily_weekday":
        return "Recorre de Seg. a Sex.";
      case "weekly":
        return `Recorre Semanalmente às ${task.recurrence_details}`;
      case "monthly":
        return `Recorre Mensalmente no dia ${task.recurrence_details}`;
      case "none":
      default:
        return null;
    }
  };

  const getTodayTasks = (allTasks: Task[]): Task[] => {
    const today = new Date();
    const currentDayOfWeek = getDay(today); // 0 = Dom, 1 = Seg, ..., 6 = Sáb
    const currentDayOfMonth = today.getDate().toString();

    return allTasks.filter(task => {
      // Tarefas recorrentes
      if (task.recurrence_type !== "none") {
        if (task.recurrence_type === "daily_weekday" && (currentDayOfWeek >= 1 && currentDayOfWeek <= 5)) {
          return true;
        }
        if (task.recurrence_type === "weekly" && task.recurrence_details) {
          const dayMap: { [key: string]: number } = {
            "Sunday": 0, "Monday": 1, "Tuesday": 2, "Wednesday": 3,
            "Thursday": 4, "Friday": 5, "Saturday": 6
          };
          if (dayMap[task.recurrence_details] === currentDayOfWeek) {
            return true;
          }
        }
        if (task.recurrence_type === "monthly" && task.recurrence_details) {
          if (parseInt(task.recurrence_details) === parseInt(currentDayOfMonth)) {
            return true;
          }
        }
      }

      // Tarefas com data de vencimento única
      if (task.due_date) {
        const dueDate = parseISO(task.due_date);
        return isToday(dueDate);
      }
      return false;
    }).sort((a, b) => {
      // Ordenar por horário, se disponível
      if (a.time && b.time) {
        return a.time.localeCompare(b.time);
      }
      if (a.time) return -1; // Tarefas com horário primeiro
      if (b.time) return 1;
      return 0;
    });
  };

  const todayTasks = tasks ? getTodayTasks(tasks) : [];

  return (
    <Card className="w-full bg-card border border-border rounded-lg shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-semibold flex items-center gap-2 text-foreground">
          <ListTodo className="h-5 w-5 text-primary" /> Tarefas de Hoje
        </CardTitle>
        <Link to="/tasks">
          <Button variant="ghost" size="sm" className="text-primary hover:bg-primary/10">
            Ver Todas <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {isLoading && <p className="text-muted-foreground">Carregando tarefas...</p>}
        {error && <p className="text-red-500">Erro ao carregar tarefas: {error.message}</p>}
        {!isLoading && !error && todayTasks.length === 0 && (
          <p className="text-muted-foreground">Nenhuma tarefa para hoje. Que tal adicionar uma?</p>
        )}
        <div className="space-y-3">
          {todayTasks.map((task) => (
            <div key={task.id} className="flex items-center justify-between p-3 border border-border rounded-md bg-background shadow-sm">
              <div className="flex items-center gap-3">
                <Checkbox
                  id={`dashboard-task-${task.id}`}
                  checked={task.is_completed}
                  onCheckedChange={() => handleToggleComplete(task.id, task.is_completed)}
                  className="border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                />
                <div className="grid gap-1.5">
                  <label
                    htmlFor={`dashboard-task-${task.id}`}
                    className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${
                      task.is_completed ? "line-through text-muted-foreground" : "text-foreground"
                    }`}
                  >
                    {task.title}
                  </label>
                  {task.description && (
                    <p className="text-xs text-muted-foreground line-clamp-1">{task.description}</p>
                  )}
                  {task.time && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {task.time}
                    </p>
                  )}
                  {task.recurrence_type !== "none" && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Repeat className="h-3 w-3" /> {getRecurrenceText(task)}
                    </p>
                  )}
                  {(task.task_type === "reading" || task.task_type === "exercise") && task.current_daily_target !== null && task.current_daily_target !== undefined && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      {task.task_type === "reading" ? <BookOpen className="h-3 w-3" /> : <Dumbbell className="h-3 w-3" />}
                      Meta: {task.current_daily_target} {task.task_type === "reading" ? "páginas" : "minutos/reps"}
                    </p>
                  )}
                  {task.tags && task.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {task.tags.map((tag) => (
                        <Badge key={tag.id} style={{ backgroundColor: tag.color, color: '#FFFFFF' }} className="text-xs">
                          {tag.name}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default DashboardTaskList;