"use client";

import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PlusCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { useSession } from "@/integrations/supabase/auth";
import { useQueryClient } from "@tanstack/react-query";
import { OriginBoard } from "@/types/task";
import { format, parseISO } from "date-fns";

interface QuickAddTaskInputProps {
  originBoard: OriginBoard;
  onTaskAdded: () => void;
}

const QuickAddTaskInput: React.FC<QuickAddTaskInputProps> = ({ originBoard, onTaskAdded }) => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleAddTask = async () => {
    if (input.trim() === "" || isLoading) return;
    if (!userId) {
      showError("Usuário não autenticado. Faça login para adicionar tarefas.");
      return;
    }

    setIsLoading(true);

    try {
      // Usar IA para parsear o input de texto natural
      const prompt = `Parse the following natural language task description into a JSON object.
      The task should be assigned to the board "${originBoard}".
      If a due date is mentioned (e.g., "tomorrow", "next monday", "on 25/12"), convert it to "YYYY-MM-DD" format. If no year is specified, assume the current year. If "today" is mentioned, use today's date. If no date is mentioned, set due_date to null.
      If a time is mentioned (e.g., "at 9am", "14:30"), convert it to "HH:mm" format. If no time is mentioned, set time to null.
      Identify if the task is recurrent (e.g., "daily", "every monday", "monthly on the 15th").
      For weekly recurrence, recurrence_details should be a comma-separated string of day names (e.g., "Monday,Wednesday").
      For monthly recurrence, recurrence_details should be the day of the month (e.g., "15").
      For daily recurrence, recurrence_details should be null.
      If no recurrence is mentioned, set recurrence_type to "none" and recurrence_details to null.
      Identify task type (general, reading, exercise, study) and target value if applicable (e.g., "read 10 pages", "run 30 minutes", "study 2 hours"). For 'study', target value is in minutes.
      The output JSON should have the following keys: "title", "description", "due_date", "time", "recurrence_type", "recurrence_details", "task_type", "target_value".
      Example 1: "adicionar revisar proposta amanhã 9h urgente" -> {"title": "Revisar proposta", "description": null, "due_date": "YYYY-MM-DD", "time": "09:00", "recurrence_type": "none", "recurrence_details": null, "task_type": "general", "target_value": null}
      Example 2: "correr 30 minutos diariamente" -> {"title": "Correr", "description": "Correr por 30 minutos", "due_date": null, "time": null, "recurrence_type": "daily", "recurrence_details": null, "task_type": "exercise", "target_value": 30}
      Example 3: "estudar react por 2 horas toda terça" -> {"title": "Estudar React", "description": "Estudar React por 2 horas", "due_date": null, "time": null, "recurrence_type": "weekly", "recurrence_details": "Tuesday", "task_type": "study", "target_value": 120}
      Example 4: "ler 20 paginas do livro de historia" -> {"title": "Ler livro de história", "description": "Ler 20 páginas do livro de história", "due_date": null, "time": null, "recurrence_type": "none", "recurrence_details": null, "task_type": "reading", "target_value": 20}
      
      Task: "${input}"`;

      const { data: aiData, error: aiError } = await supabase.functions.invoke('ai-chat', {
        body: { messages: [{ role: "user", content: prompt }] },
      });

      if (aiError) {
        throw aiError;
      }

      const parsedTask = JSON.parse(aiData.response);

      // Ajustar due_date e tags para "urgent_today" e "non_urgent_today"
      let finalDueDate = parsedTask.due_date;
      let finalTags = [];

      if (originBoard === "urgent_today" || originBoard === "non_urgent_today") {
        finalDueDate = format(new Date(), "yyyy-MM-dd"); // Força a data de hoje
        const { data: tagData, error: tagError } = await supabase
          .from('tags')
          .select('id')
          .eq('user_id', userId)
          .eq('name', originBoard === "urgent_today" ? 'hoje-urgente' : 'hoje-sem-urgencia')
          .single();

        if (tagError && tagError.code !== 'PGRST116') { // PGRST116 = no rows found
          throw tagError;
        }

        if (tagData) {
          finalTags.push(tagData.id);
        } else {
          // Criar a tag se não existir
          const { data: newTag, error: createTagError } = await supabase
            .from('tags')
            .insert({
              user_id: userId,
              name: originBoard === "urgent_today" ? 'hoje-urgente' : 'hoje-sem-urgencia',
              color: originBoard === "urgent_today" ? '#EF4444' : '#3B82F6', // Vermelho para urgente, Azul para sem urgência
            })
            .select('id')
            .single();
          if (createTagError) throw createTagError;
          finalTags.push(newTag.id);
        }
      }

      const { data: newTask, error: insertError } = await supabase.from("tasks").insert({
        user_id: userId,
        title: parsedTask.title,
        description: parsedTask.description || null,
        due_date: finalDueDate,
        time: parsedTask.time || null,
        recurrence_type: parsedTask.recurrence_type || "none",
        recurrence_details: parsedTask.recurrence_details || null,
        task_type: parsedTask.task_type || "general",
        target_value: parsedTask.target_value || null,
        origin_board: originBoard, // Define o quadro de origem
        is_completed: false,
      }).select("id").single();

      if (insertError) throw insertError;

      // Associar tags
      if (finalTags.length > 0) {
        const taskTagsToInsert = finalTags.map(tagId => ({
          task_id: newTask.id,
          tag_id: tagId,
        }));
        const { error: tagInsertError } = await supabase.from("task_tags").insert(taskTagsToInsert);
        if (tagInsertError) throw tagInsertError;
      }

      showSuccess("Tarefa adicionada com sucesso!");
      setInput("");
      onTaskAdded(); // Notifica o pai para recarregar as tarefas
      queryClient.invalidateQueries({ queryKey: ["tags", userId] }); // Invalida tags para garantir que novas tags sejam carregadas
    } catch (err: any) {
      showError("Erro ao adicionar tarefa: " + err.message);
      console.error("Erro ao adicionar tarefa:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex gap-2">
      <Input
        type="text"
        placeholder="Adicionar tarefa rapidamente (ex: 'revisar proposta amanhã 9h urgente')"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyPress={(e) => e.key === "Enter" && handleAddTask()}
        className="flex-grow bg-input border-border text-foreground focus-visible:ring-ring"
        disabled={isLoading}
      />
      <Button onClick={handleAddTask} disabled={isLoading || input.trim() === ""} className="bg-primary text-primary-foreground hover:bg-primary/90">
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <PlusCircle className="h-4 w-4" />
        )}
        <span className="sr-only">Adicionar</span>
      </Button>
    </div>
  );
};

export default QuickAddTaskInput;