"use client";

import React, { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showError } from "@/utils/toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Brain, Loader2 } from "lucide-react";
import { useSession } from "@/integrations/supabase/auth";
import { getAdjustedTaskCompletionStatus } from "@/utils/taskHelpers";
import { Task, DAYS_OF_WEEK_MAP } from "@/types/task"; // Importar Task e DAYS_OF_WEEK_MAP

const fetchIncompleteTodayTasks = async (userId: string): Promise<Task[]> => {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("user_id", userId)
    .in('origin_board', ['today_priority', 'today_no_priority', 'jobs_woe_today']) // Atualizado
    .order("time", { ascending: true, nullsFirst: false });

  if (error) {
    throw error;
  }
  
  // Filtra as tarefas que são devidas hoje e não estão concluídas para o período
  return (data || []).filter(task => !getAdjustedTaskCompletionStatus(task));
};

const TaskAIHelper: React.FC = () => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const { data: incompleteTasks, isLoading: isLoadingTasks, error: tasksError } = useQuery<Task[], Error>({
    queryKey: ["incompleteTodayTasks", userId],
    queryFn: () => fetchIncompleteTodayTasks(userId!),
    enabled: !!userId,
  });

  const handleGetAITips = async () => {
    if (!userId || !incompleteTasks || incompleteTasks.length === 0) {
      showError("Nenhuma tarefa incompleta para obter dicas.");
      return;
    }

    setIsGenerating(true);
    setAiResponse(null);

    try {
      const taskList = incompleteTasks.map(task => {
        let taskString = `- ${task.title}`;
        if (task.description) taskString += `: ${task.description}`;
        if (task.time) taskString += ` (Horário: ${task.time})`;
        if (task.recurrence_type !== "none") {
          taskString += ` (Recorrência: ${task.recurrence_type === "daily" ? "Diariamente" : task.recurrence_type === "weekly" ? `Semanalmente nos dias ${task.recurrence_details}` : `Mensalmente no dia ${task.recurrence_details}`})`;
        }
        return taskString;
      }).join("\n");

      const prompt = `Eu tenho as seguintes tarefas incompletas para hoje:\n${taskList}\n\nCom base nessas tarefas, me dê dicas e sugestões sobre como posso priorizá-las e cumpri-las de forma mais eficiente hoje. Pense em técnicas de produtividade, como dividir tarefas, focar no mais importante, etc. Seja conciso e direto ao ponto.`;

      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: { messages: [{ role: "user", content: prompt }] },
      });

      if (error) {
        throw error;
      }

      setAiResponse(data.response);
    } catch (err: any) {
      showError("Erro ao obter dicas da IA: " + err.message);
      console.error("Erro na chamada da Edge Function ai-chat para dicas de tarefas:", err);
      setAiResponse("Desculpe, não consegui gerar dicas no momento. Tente novamente mais tarde.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card className="w-full bg-card border border-border rounded-lg shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-semibold flex items-center gap-2 text-foreground">
          <Brain className="h-5 w-5 text-blue-500" /> Assistente de Tarefas IA
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoadingTasks ? (
          <p className="text-muted-foreground">Carregando tarefas para a IA...</p>
        ) : tasksError ? (
          <p className="text-red-500">Erro ao carregar tarefas: {tasksError.message}</p>
        ) : incompleteTasks && incompleteTasks.length > 0 ? (
          <>
            <p className="text-sm text-muted-foreground">
              Você tem {incompleteTasks.length} tarefas incompletas para hoje. Clique abaixo para obter dicas da IA sobre como maximizar sua produtividade!
            </p>
            <Button
              onClick={handleGetAITips}
              disabled={isGenerating}
              className="w-full bg-blue-600 text-white hover:bg-blue-700"
            >
              {isGenerating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Brain className="mr-2 h-4 w-4" />
              )}
              Obter Dicas da IA
            </Button>
            {aiResponse && (
              <div className="mt-4 p-3 bg-secondary rounded-md text-secondary-foreground border border-border">
                <p className="font-semibold mb-2">Dicas da IA:</p>
                <p className="text-sm whitespace-pre-wrap break-words">{aiResponse}</p>
              </div>
            )}
          </>
        ) : (
          <p className="text-muted-foreground">
            Parabéns! Nenhuma tarefa incompleta para hoje nos quadros "Hoje".
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default TaskAIHelper;