"use client";

import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart2, Activity } from "lucide-react";
import { useSession } from "@/integrations/supabase/auth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showError } from "@/utils/toast";
import { Task } from "@/types/task";
import { format, parseISO, isToday, isThisWeek, isThisMonth, startOfWeek, endOfWeek, startOfMonth, endOfMonth, getDay, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { getAdjustedTaskCompletionStatus } from "@/utils/taskHelpers";
import {
  ResponsiveContainer,
  BarChart,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Bar,
  LineChart,
  Line,
} from "recharts";

// --- Funções de Fetch de Dados ---
const fetchAllTasks = async (userId: string): Promise<Task[]> => {
  const { data, error } = await supabase
    .from("tasks")
    .select(`
      id, title, description, due_date, time, is_completed, recurrence_type, recurrence_details, 
      last_successful_completion_date, origin_board, current_board, is_priority, overdue, parent_task_id, created_at, completed_at
    `)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) {
    throw error;
  }
  return data || [];
};

const fetchAllRecurringTasks = async (userId: string): Promise<Task[]> => {
  const { data, error } = await supabase
    .from("tasks")
    .select(`
      id, title, description, due_date, time, is_completed, recurrence_type, recurrence_details, 
      last_successful_completion_date, origin_board, current_board, is_priority, overdue, parent_task_id, created_at, completed_at
    `)
    .eq("user_id", userId)
    .neq("recurrence_type", "none")
    .order("created_at", { ascending: false });
  if (error) {
    throw error;
  }
  return data || [];
};

// --- Componente Principal de Resultados ---
const Results: React.FC = () => {
  const { session } = useSession();
  const userId = session?.user?.id;

  const { data: allTasks, isLoading: isLoadingAllTasks, error: errorAllTasks } = useQuery<Task[], Error>({
    queryKey: ["resultsAllTasks", userId],
    queryFn: () => fetchAllTasks(userId!),
    enabled: !!userId,
  });

  const { data: recurringTasks, isLoading: isLoadingRecurringTasks, error: errorRecurringTasks } = useQuery<Task[], Error>({
    queryKey: ["resultsRecurringTasks", userId],
    queryFn: () => fetchAllRecurringTasks(userId!),
    enabled: !!userId,
  });

  if (isLoadingAllTasks || isLoadingRecurringTasks) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6 bg-background text-foreground">
        <h1 className="text-3xl font-bold">Resultados</h1>
        <p className="text-lg text-muted-foreground">Carregando seu painel de desempenho...</p>
      </div>
    );
  }

  if (errorAllTasks) {
    showError("Erro ao carregar tarefas gerais: " + errorAllTasks.message);
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6 bg-background text-foreground">
        <h1 className="text-3xl font-bold">Resultados</h1>
        <p className="text-lg text-red-500">Erro ao carregar tarefas gerais: {errorAllTasks.message}</p>
      </div>
    );
  }

  if (errorRecurringTasks) {
    showError("Erro ao carregar tarefas recorrentes: " + errorRecurringTasks.message);
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6 bg-background text-foreground">
        <h1 className="text-3xl font-bold">Resultados</h1>
        <p className="text-lg text-red-500">Erro ao carregar tarefas recorrentes: {errorRecurringTasks.message}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6 bg-background text-foreground">
      <h1 className="text-3xl font-bold flex items-center gap-2">
        <BarChart2 className="h-7 w-7 text-primary" /> Resultados
      </h1>
      <p className="text-lg text-muted-foreground">
        Seu painel de desempenho e constância pessoal.
      </p>

      <Tabs defaultValue="habits" className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-2 bg-secondary/50 border border-border rounded-md mb-4">
          <TabsTrigger value="habits" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm data-[state=active]:border-primary/50 rounded-md">
            <Activity className="mr-2 h-4 w-4" /> Hábitos e Constância
          </TabsTrigger>
          <TabsTrigger value="productivity" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm data-[state=active]:border-primary/50 rounded-md">
            <BarChart2 className="mr-2 h-4 w-4" /> Produtividade Geral
          </TabsTrigger>
        </TabsList>

        <TabsContent value="habits" className="flex-1">
          <div className="space-y-6">
            <Card className="bg-card border border-border rounded-xl shadow-lg p-6">
              <CardHeader className="pb-4">
                <CardTitle className="text-2xl font-bold text-foreground">Sua Constância Pessoal</CardTitle>
                <CardDescription className="text-muted-foreground">
                  Acompanhe seus hábitos e rotinas. Você está consistente!
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Conteúdo da seção de Hábitos e Constância será adicionado aqui */}
                <p className="text-muted-foreground">Dados de hábitos e constância serão exibidos aqui.</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="productivity" className="flex-1">
          <div className="space-y-6">
            <Card className="bg-card border border-border rounded-xl shadow-lg p-6">
              <CardHeader className="pb-4">
                <CardTitle className="text-2xl font-bold text-foreground">Sua Produtividade Geral</CardTitle>
                <CardDescription className="text-muted-foreground">
                  Visão geral das suas tarefas de trabalho. Excelente progresso!
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Conteúdo da seção de Produtividade Geral será adicionado aqui */}
                <p className="text-muted-foreground">Dados de produtividade geral serão exibidos aqui.</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Results;