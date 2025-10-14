"use client";

import React from "react";
import { MadeWithDyad } from "@/components/made-with-dyad";
import TaskForm from "@/components/TaskForm";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { showError } from "@/utils/toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { format, isToday, isThisWeek, isThisMonth, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Trash2, Repeat, Clock } from "lucide-react"; // Importar ícone de relógio

interface Task {
  id: string;
  title: string;
  description?: string;
  due_date?: string; // ISO string
  time?: string; // Formato "HH:mm"
  is_completed: boolean;
  recurrence_type: "none" | "daily_weekday" | "weekly" | "monthly";
  recurrence_details?: string;
}

const fetchTasks = async (): Promise<Task[]> => {
  const { data, error } = await supabase.from("tasks").select("*").order("created_at", { ascending: false });
  if (error) {
    throw error;
  }
  return data || [];
};

const Tasks: React.FC = () => {
  const { data: tasks, isLoading, error, refetch } = useQuery<Task[], Error>({
    queryKey: ["tasks"],
    queryFn: fetchTasks,
  });

  const handleToggleComplete = async (taskId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("tasks")
        .update({ is_completed: !currentStatus, updated_at: new Date().toISOString() })
        .eq("id", taskId);

      if (error) throw error;
      refetch();
    } catch (err: any) {
      showError("Erro ao atualizar tarefa: " + err.message);
      console.error("Erro ao atualizar tarefa:", err);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      const { error } = await supabase
        .from("tasks")
        .delete()
        .eq("id", taskId);

      if (error) throw error;
      refetch();
    } catch (err: any) {
      showError("Erro ao deletar tarefa: " + err.message);
      console.error("Erro ao deletar tarefa:", err);
    }
  };

  const getRecurrenceText = (task: Task) => {
    switch (task.recurrence_type) {
      case "daily_weekday":
        return "Recorre de Segunda a Sexta";
      case "weekly":
        return `Recorre Semanalmente às ${task.recurrence_details}`;
      case "monthly":
        return `Recorre Mensalmente no dia ${task.recurrence_details}`;
      case "none":
      default:
        return null;
    }
  };

  const filterTasks = (task: Task, filterType: "daily" | "weekly" | "monthly" | "all") => {
    // Lógica para tarefas recorrentes
    if (task.recurrence_type !== "none") {
      const today = new Date();
      const currentDayOfWeek = format(today, "EEEE", { locale: ptBR }); // Ex: "Segunda-feira"
      const currentDayOfMonth = today.getDate().toString();

      switch (task.recurrence_type) {
        case "daily_weekday":
          return filterType === "daily" && today.getDay() >= 1 && today.getDay() <= 5; // Seg-Sex
        case "weekly":
          return filterType === "weekly" && task.recurrence_details?.toLowerCase() === currentDayOfWeek.toLowerCase();
        case "monthly":
          return filterType === "monthly" && task.recurrence_details === currentDayOfMonth;
        default:
          return filterType === "all";
      }
    }

    // Lógica para tarefas com data de vencimento única
    if (!task.due_date) return false;
    const dueDate = parseISO(task.due_date);

    switch (filterType) {
      case "daily":
        return isToday(dueDate);
      case "weekly":
        return isThisWeek(dueDate, { locale: ptBR });
      case "monthly":
        return isThisMonth(dueDate, { locale: ptBR });
      case "all":
      default:
        return true;
    }
  };

  const renderTaskList = (filteredTasks: Task[]) => {
    if (filteredTasks.length === 0) {
      return <p className="text-muted-foreground">Nenhuma tarefa encontrada para esta categoria.</p>;
    }
    return (
      <div className="space-y-3">
        {filteredTasks.map((task) => (
          <div key={task.id} className="flex items-center justify-between p-3 border rounded-md bg-background">
            <div className="flex items-center gap-3">
              <Checkbox
                id={`task-${task.id}`}
                checked={task.is_completed}
                onCheckedChange={() => handleToggleComplete(task.id, task.is_completed)}
              />
              <div className="grid gap-1.5">
                <label
                  htmlFor={`task-${task.id}`}
                  className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${
                    task.is_completed ? "line-through text-muted-foreground" : ""
                  }`}
                >
                  {task.title}
                </label>
                {task.description && (
                  <p className="text-sm text-muted-foreground">{task.description}</p>
                )}
                {task.due_date && task.recurrence_type === "none" && (
                  <p className="text-xs text-muted-foreground">
                    Vencimento: {format(parseISO(task.due_date), "PPP", { locale: ptBR })}
                  </p>
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
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => handleDeleteTask(task.id)}>
              <Trash2 className="h-4 w-4 text-red-500" />
              <span className="sr-only">Deletar Tarefa</span>
            </Button>
          </div>
        ))}
      </div>
    );
  };

  if (isLoading) return <p>Carregando tarefas...</p>;
  if (error) return <p className="text-red-500">Erro ao carregar tarefas: {error.message}</p>;

  const dailyTasks = tasks?.filter((task) => filterTasks(task, "daily")) || [];
  const weeklyTasks = tasks?.filter((task) => filterTasks(task, "weekly")) || [];
  const monthlyTasks = tasks?.filter((task) => filterTasks(task, "monthly")) || [];
  const allTasks = tasks || [];

  return (
    <div className="flex flex-1 flex-col gap-4">
      <h1 className="text-3xl font-bold">Suas Tarefas</h1>
      <p className="text-lg text-muted-foreground">
        Organize suas tarefas diárias, semanais e mensais aqui.
      </p>

      <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-2">
        <TaskForm onTaskAdded={refetch} />

        <Card>
          <CardHeader>
            <CardTitle>Minhas Tarefas</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="daily" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="daily">Diárias</TabsTrigger>
                <TabsTrigger value="weekly">Semanais</TabsTrigger>
                <TabsTrigger value="monthly">Mensais</TabsTrigger>
                <TabsTrigger value="all">Todas</TabsTrigger>
              </TabsList>
              <div className="mt-4">
                <TabsContent value="daily">{renderTaskList(dailyTasks)}</TabsContent>
                <TabsContent value="weekly">{renderTaskList(weeklyTasks)}</TabsContent>
                <TabsContent value="monthly">{renderTaskList(monthlyTasks)}</TabsContent>
                <TabsContent value="all">{renderTaskList(allTasks)}</TabsContent>
              </div>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <div className="flex-1 flex items-end justify-center">
        <MadeWithDyad />
      </div>
    </div>
  );
};

export default Tasks;