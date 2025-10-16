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
      // Valores padrão para a tarefa rápida
      let finalDueDate: string | null = null;
      let finalTags: string[] = [];
      let tagName: string | undefined;
      let tagColor: string | undefined;

      // Define a data de vencimento e tags com base no originBoard
      if (originBoard === "today_priority") {
        finalDueDate = format(new Date(), "yyyy-MM-dd");
        tagName = 'hoje-prioridade';
        tagColor = '#EF4444';
      } else if (originBoard === "today_no_priority") {
        finalDueDate = format(new Date(), "yyyy-MM-dd");
        tagName = 'hoje-sem-prioridade';
        tagColor = '#3B82F6';
      } else if (originBoard === "jobs_woe_today") {
        finalDueDate = format(new Date(), "yyyy-MM-dd");
        tagName = 'jobs-woe-hoje';
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
        title: input, // O input do usuário é o título
        description: null, // Sem descrição por padrão
        due_date: finalDueDate,
        time: null,
        recurrence_type: "none", // Não recorrente por padrão
        recurrence_details: null,
        task_type: "general", // Tipo geral por padrão
        target_value: null,
        origin_board: originBoard,
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
    <div className="flex flex-col sm:flex-row gap-2">
      <Input
        type="text"
        placeholder="Adicionar tarefa rapidamente (ex: 'Comprar pão')"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyPress={(e) => e.key === "Enter" && handleAddTask()}
        className="flex-grow bg-input border-border text-foreground focus-visible:ring-ring"
        disabled={isLoading}
      />
      <Button onClick={handleAddTask} disabled={isLoading || input.trim() === ""} className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90">
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