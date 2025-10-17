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
import { format } from "date-fns";

interface QuickAddTaskInputProps {
  originBoard: OriginBoard;
  onTaskAdded: () => void;
  dueDate?: Date; // Nova prop opcional para data de vencimento
}

// Função para sanitizar o nome da tag
const sanitizeTagName = (name: string) => {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .replace(/\s+/g, '-')
    .toLowerCase();
};

const QuickAddTaskInput: React.FC<QuickAddTaskInputProps> = ({ originBoard, onTaskAdded, dueDate }) => {
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
      let finalDueDate: string | null = null;
      let finalTags: string[] = [];
      let tagName: string | undefined;
      let tagColor: string | undefined;

      // Se uma dueDate for fornecida, use-a. Caso contrário, use a lógica existente.
      if (dueDate) {
        finalDueDate = format(dueDate, "yyyy-MM-dd");
      } else if (originBoard === "hoje-prioridade") {
        finalDueDate = format(new Date(), "yyyy-MM-dd");
        tagName = 'hoje-prioridade';
        tagColor = '#EF4444';
      } else if (originBoard === "hoje-sem-prioridade") {
        finalDueDate = format(new Date(), "yyyy-MM-dd");
        tagName = 'hoje-sem-prioridade';
        tagColor = '#3B82F6';
      } else if (originBoard === "woe-hoje") {
        finalDueDate = format(new Date(), "yyyy-MM-dd");
        tagName = 'woe-hoje';
        tagColor = '#8B5CF6';
      }

      if (tagName && tagColor) {
        let tagId: string | undefined;
        const { data: existingTag, error: fetchTagError } = await supabase
          .from('tags')
          .select('id')
          .eq('user_id', userId)
          .eq('name', tagName)
          .single();

        if (fetchTagError && fetchTagError.code !== 'PGRST116') {
          throw fetchTagError;
        } else if (existingTag) {
          tagId = existingTag.id;
        } else {
          const { data: newTag, error: createTagError } = await supabase
            .from('tags')
            .insert({ user_id: userId, name: tagName, color: tagColor })
            .select('id')
            .single();
          if (createTagError) throw createTagError;
          tagId = newTag.id;
        }
        if (tagId) {
          finalTags.push(tagId);
        }
      }

      const { data: newTask, error: insertError } = await supabase.from("tasks").insert({
        user_id: userId,
        title: input,
        description: null,
        due_date: finalDueDate,
        time: null,
        recurrence_type: "none",
        recurrence_rule: null,
        origin_board: originBoard,
        is_completed: false,
        current_board: originBoard, // Initialize current_board
        is_priority: false,
        overdue: false,
      }).select("id").single();

      if (insertError) throw insertError;

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
      onTaskAdded(); // Chama o refetch do componente pai
      // Invalidação de cache mais granular
      queryClient.invalidateQueries({ queryKey: ["allTasks", userId] });
      queryClient.invalidateQueries({ queryKey: ["dashboardTasks", originBoard, userId] });
      queryClient.invalidateQueries({ queryKey: ["dailyPlannerTasks", userId] });
      queryClient.invalidateQueries({ queryKey: ["tags", userId] });
    } catch (err: any) {
      showError("Erro ao adicionar tarefa: " + err.message);
      console.error("Erro ao adicionar tarefa:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row gap-2">
      <Input
        type="text"
        placeholder="Adicionar tarefa rapidamente (ex: 'Comprar pão')"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyPress={(e) => e.key === "Enter" && handleAddTask()}
        className="flex-grow bg-input border-border text-foreground focus-visible:ring-ring rounded-xl"
        disabled={isLoading}
      />
      <Button onClick={handleAddTask} disabled={isLoading || input.trim() === ""} className="w-full sm:w-auto bg-gradient-primary text-primary-foreground hover:opacity-90 btn-glow">
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <PlusCircle className="h-4 w-4" />
        )}
        <span className="sr-only sm:not-sr-only sm:ml-2">Adicionar</span>
      </Button>
    </div>
  );
};

export default QuickAddTaskInput;