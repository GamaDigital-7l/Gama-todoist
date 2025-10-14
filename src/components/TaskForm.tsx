"use client";

import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Brain, Loader2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import TimePicker from "./TimePicker";
import { useSession } from "@/integrations/supabase/auth";
import TagSelector from "./TagSelector"; // Importar o TagSelector
import { Checkbox } from "@/components/ui/checkbox"; // Importar Checkbox

const DAYS_OF_WEEK = [
  { value: "Sunday", label: "Domingo" },
  { value: "Monday", label: "Segunda-feira" },
  { value: "Tuesday", label: "Terça-feira" },
  { value: "Wednesday", label: "Quarta-feira" },
  { value: "Thursday", label: "Quinta-feira" },
  { value: "Friday", label: "Sexta-feira" },
  { value: "Saturday", label: "Sábado" },
];

const taskSchema = z.object({
  title: z.string().min(1, "O título da tarefa é obrigatório."),
  description: z.string().optional(),
  due_date: z.date().optional().nullable(),
  time: z.string().optional().nullable(),
  recurrence_type: z.enum(["none", "daily", "weekly", "monthly"]).default("none"), // Updated enum
  recurrence_details: z.string().optional().nullable(), // Will store comma-separated days for 'weekly'
  task_type: z.enum(["general", "reading", "exercise"]).default("general"),
  target_value: z.preprocess(
    (val) => (val === "" ? null : Number(val)),
    z.number().min(0, "O valor alvo deve ser um número positivo.").nullable().optional(),
  ),
  selected_tag_ids: z.array(z.string()).optional(),
});

export type TaskFormValues = z.infer<typeof taskSchema>;

interface TaskFormProps {
  initialData?: Omit<TaskFormValues, 'due_date' | 'recurrence_details'> & {
    id: string;
    due_date?: string | Date | null;
    recurrence_details?: string | null; // Ensure this is string for initialData
    tags?: { id: string; name: string; color: string }[];
  };
  onTaskSaved: () => void;
  onClose: () => void;
}

const TaskForm: React.FC<TaskFormProps> = ({ initialData, onTaskSaved, onClose }) => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const [isGeneratingAISuggestions, setIsGeneratingAISuggestions] = useState(false);

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: initialData ? {
      ...initialData,
      due_date: initialData.due_date ? (typeof initialData.due_date === 'string' ? parseISO(initialData.due_date) : initialData.due_date) : undefined,
      time: initialData.time || undefined,
      recurrence_details: initialData.recurrence_details || undefined, // Keep as string
      task_type: initialData.task_type || "general",
      target_value: initialData.target_value || undefined,
      selected_tag_ids: initialData.tags?.map(tag => tag.id) || [],
    } : {
      title: "",
      description: "",
      due_date: undefined,
      time: undefined,
      recurrence_type: "none",
      recurrence_details: undefined,
      task_type: "general",
      target_value: undefined,
      selected_tag_ids: [],
    },
  });

  const recurrenceType = form.watch("recurrence_type");
  const taskType = form.watch("task_type");
  const selectedTagIds = form.watch("selected_tag_ids") || [];
  const watchedRecurrenceDetails = form.watch("recurrence_details"); // Watch recurrence_details

  // State for selected days for weekly recurrence
  const [selectedDays, setSelectedDays] = useState<string[]>([]);

  useEffect(() => {
    if (recurrenceType === "weekly" && watchedRecurrenceDetails) {
      setSelectedDays(watchedRecurrenceDetails.split(','));
    } else {
      setSelectedDays([]);
    }
  }, [recurrenceType, watchedRecurrenceDetails]);

  const handleDayToggle = (dayValue: string) => {
    setSelectedDays(prev => {
      const newDays = prev.includes(dayValue)
        ? prev.filter(d => d !== dayValue)
        : [...prev, dayValue];
      form.setValue("recurrence_details", newDays.join(','), { shouldDirty: true });
      return newDays;
    });
  };

  const handleTagSelectionChange = (newSelectedTagIds: string[]) => {
    form.setValue("selected_tag_ids", newSelectedTagIds, { shouldDirty: true });
  };

  const onSubmit = async (values: TaskFormValues) => {
    if (!userId) {
      showError("Usuário não autenticado.");
      return;
    }

    try {
      let taskId: string;

      const dataToSave = {
        title: values.title,
        description: values.description,
        due_date: values.due_date ? format(values.due_date, "yyyy-MM-dd") : null,
        time: values.time || null,
        recurrence_type: values.recurrence_type,
        recurrence_details: values.recurrence_type === "weekly" ? selectedDays.join(',') || null : values.recurrence_details || null, // Use selectedDays for weekly
        task_type: values.task_type,
        target_value: values.target_value || null,
        current_daily_target: values.target_value || null,
        updated_at: new Date().toISOString(),
      };

      if (initialData) {
        const { data, error } = await supabase
          .from("tasks")
          .update(dataToSave)
          .eq("id", initialData.id)
          .eq("user_id", userId)
          .select("id")
          .single();

        if (error) throw error;
        taskId = data.id;
        showSuccess("Tarefa atualizada com sucesso!");
      } else {
        const { data, error } = await supabase.from("tasks").insert({
          ...dataToSave,
          is_completed: false,
          user_id: userId,
        }).select("id").single();

        if (error) throw error;
        taskId = data.id;
        showSuccess("Tarefa adicionada com sucesso!");
      }

      // Lidar com as tags
      await supabase.from("task_tags").delete().eq("task_id", taskId);

      if (values.selected_tag_ids && values.selected_tag_ids.length > 0) {
        const taskTagsToInsert = values.selected_tag_ids.map(tagId => ({
          task_id: taskId,
          tag_id: tagId,
        }));
        const { error: tagInsertError } = await supabase.from("task_tags").insert(taskTagsToInsert);
        if (tagInsertError) throw tagInsertError;
      }

      form.reset();
      onTaskSaved();
      onClose();
    } catch (error: any) {
      showError("Erro ao salvar tarefa: " + error.message);
      console.error("Erro ao salvar tarefa:", error);
    }
  };

  const handleGenerateAISuggestions = async () => {
    const currentTitle = form.getValues("title");
    const currentDescription = form.getValues("description");

    if (!currentTitle && !currentDescription) {
      showError("Por favor, insira um título ou descrição para a IA gerar sugestões.");
      return;
    }

    setIsGeneratingAISuggestions(true);
    try {
      const prompt = `Dada a seguinte tarefa (título: "${currentTitle}", descrição: "${currentDescription || ''}"), sugira uma descrição mais detalhada, uma data de vencimento adequada (formato YYYY-MM-DD, se aplicável, caso contrário null), um horário (formato HH:mm, se aplicável, caso contrário null), um tipo de recorrência (none, daily, weekly, monthly) com detalhes se aplicável (ex: 'Monday,Wednesday' para semanal, '15' para mensal, caso contrário null), um tipo de tarefa (general, reading, exercise) e um valor alvo (numeric, se aplicável, caso contrário null). Retorne a resposta em JSON com as chaves: "description", "due_date", "time", "recurrence_type", "recurrence_details", "task_type", "target_value".`;

      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: { messages: [{ role: "user", content: prompt }] },
      });

      if (error) {
        throw error;
      }

      const aiSuggestions = JSON.parse(data.response);

      // Atualizar o formulário com as sugestões da IA
      if (aiSuggestions.description) form.setValue("description", aiSuggestions.description);
      if (aiSuggestions.due_date) {
        try {
          form.setValue("due_date", parseISO(aiSuggestions.due_date));
        } catch (e) {
          console.warn("AI suggested invalid due_date format:", aiSuggestions.due_date);
        }
      } else {
        form.setValue("due_date", null);
      }
      if (aiSuggestions.time) form.setValue("time", aiSuggestions.time); else form.setValue("time", null);
      if (aiSuggestions.recurrence_type) form.setValue("recurrence_type", aiSuggestions.recurrence_type);
      if (aiSuggestions.recurrence_details) {
        form.setValue("recurrence_details", aiSuggestions.recurrence_details);
        if (aiSuggestions.recurrence_type === "weekly") {
          setSelectedDays(aiSuggestions.recurrence_details.split(','));
        }
      } else {
        form.setValue("recurrence_details", null);
        setSelectedDays([]);
      }
      if (aiSuggestions.task_type) form.setValue("task_type", aiSuggestions.task_type);
      if (aiSuggestions.target_value) form.setValue("target_value", aiSuggestions.target_value); else form.setValue("target_value", null);

      showSuccess("Sugestões da IA aplicadas!");

    } catch (err: any) {
      showError("Erro ao gerar sugestões da IA: " + err.message);
      console.error("Erro na chamada da Edge Function ai-chat para sugestões de tarefas:", err);
    } finally {
      setIsGeneratingAISuggestions(false);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-4 bg-card">
      <div>
        <Label htmlFor="title" className="text-foreground">Título</Label>
        <Input
          id="title"
          {...form.register("title")}
          placeholder="Ex: Fazer exercícios"
          className="bg-input border-border text-foreground focus-visible:ring-ring"
        />
        {form.formState.errors.title && (
          <p className="text-red-500 text-sm mt-1">
            {form.formState.errors.title.message}
          </p>
        )}
      </div>
      <div>
        <Label htmlFor="description" className="text-foreground">Descrição (Opcional)</Label>
        <Textarea
          id="description"
          {...form.register("description")}
          placeholder="Detalhes da tarefa..."
          className="bg-input border-border text-foreground focus-visible:ring-ring"
        />
      </div>
      
      <Button
        type="button"
        onClick={handleGenerateAISuggestions}
        disabled={isGeneratingAISuggestions || (!form.watch("title") && !form.watch("description"))}
        className="w-full bg-blue-600 text-white hover:bg-blue-700"
      >
        {isGeneratingAISuggestions ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Brain className="mr-2 h-4 w-4" />
        )}
        Gerar Sugestões com IA
      </Button>

      <div>
        <Label htmlFor="task_type" className="text-foreground">Tipo de Tarefa</Label>
        <Select
          onValueChange={(value: "general" | "reading" | "exercise") =>
            form.setValue("task_type", value)
          }
          value={taskType}
        >
          <SelectTrigger id="task_type" className="bg-input border-border text-foreground focus-visible:ring-ring">
            <SelectValue placeholder="Selecionar tipo" />
          </SelectTrigger>
          <SelectContent className="bg-popover text-popover-foreground border-border rounded-md shadow-lg">
            <SelectItem value="general">Geral</SelectItem>
            <SelectItem value="reading">Leitura</SelectItem>
            <SelectItem value="exercise">Exercício</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {(taskType === "reading" || taskType === "exercise") && (
        <div>
          <Label htmlFor="target_value" className="text-foreground">Valor Alvo (Ex: Páginas, Repetições, Minutos)</Label>
          <Input
            id="target_value"
            type="number"
            step="1"
            {...form.register("target_value", { valueAsNumber: true })}
            placeholder={taskType === "reading" ? "Ex: 10 páginas" : "Ex: 30 minutos"}
            className="bg-input border-border text-foreground focus-visible:ring-ring"
          />
          {form.formState.errors.target_value && (
            <p className="text-red-500 text-sm mt-1">
              {form.formState.errors.target_value.message}
            </p>
          )}
        </div>
      )}

      <div>
        <Label htmlFor="due_date" className="text-foreground">Data de Vencimento (Opcional)</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={"outline"}
              className={cn(
                "w-full justify-start text-left font-normal bg-input border-border text-foreground hover:bg-accent hover:text-accent-foreground",
                !form.watch("due_date") && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {form.watch("due_date") ? (
                format(form.watch("due_date")!, "PPP")
              ) : (
                <span>Escolha uma data</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 bg-popover border-border rounded-md shadow-lg">
            <Calendar
              mode="single"
              selected={form.watch("due_date") || undefined}
              onSelect={(date) => form.setValue("due_date", date || null)}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      <div>
        <Label htmlFor="time" className="text-foreground">Horário (Opcional)</Label>
        <TimePicker
          value={form.watch("time") || undefined}
          onChange={(time) => form.setValue("time", time || null)}
        />
      </div>

      <div>
        <Label htmlFor="recurrence_type" className="text-foreground">Recorrência</Label>
        <Select
          onValueChange={(value: "none" | "daily" | "weekly" | "monthly") => { // Updated values
            form.setValue("recurrence_type", value);
            form.setValue("recurrence_details", null); // Reset details when type changes
            setSelectedDays([]); // Reset selected days for weekly
          }}
          value={recurrenceType}
        >
          <SelectTrigger id="recurrence_type" className="bg-input border-border text-foreground focus-visible:ring-ring">
            <SelectValue placeholder="Selecionar tipo de recorrência" />
          </SelectTrigger>
          <SelectContent className="bg-popover text-popover-foreground border-border rounded-md shadow-lg">
            <SelectItem value="none">Nenhuma</SelectItem>
            <SelectItem value="daily">Diário</SelectItem> {/* New daily option */}
            <SelectItem value="weekly">Semanal (selecionar dias)</SelectItem> {/* Updated weekly option */}
            <SelectItem value="monthly">Mensal</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {recurrenceType === "weekly" && (
        <div>
          <Label className="text-foreground">Dias da Semana</Label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
            {DAYS_OF_WEEK.map((day) => (
              <div key={day.value} className="flex items-center space-x-2">
                <Checkbox
                  id={`day-${day.value}`}
                  checked={selectedDays.includes(day.value)}
                  onCheckedChange={() => handleDayToggle(day.value)}
                  className="border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                />
                <Label htmlFor={`day-${day.value}`} className="text-foreground">
                  {day.label}
                </Label>
              </div>
            ))}
          </div>
          {form.formState.errors.recurrence_details && (
            <p className="text-red-500 text-sm mt-1">
              {form.formState.errors.recurrence_details.message}
            </p>
          )}
        </div>
      )}

      {recurrenceType === "monthly" && (
        <div>
          <Label htmlFor="recurrence_details_monthly" className="text-foreground">Dia do Mês</Label>
          <Input
            id="recurrence_details_monthly"
            type="number"
            min="1"
            max="31"
            {...form.register("recurrence_details", { valueAsNumber: true })}
            placeholder="Ex: 15"
            className="bg-input border-border text-foreground focus-visible:ring-ring"
          />
          {form.formState.errors.recurrence_details && (
            <p className="text-red-500 text-sm mt-1">
              {form.formState.errors.recurrence_details.message}
            </p>
          )}
        </div>
      )}

      <TagSelector
        selectedTagIds={selectedTagIds}
        onTagSelectionChange={handleTagSelectionChange}
      />

      <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90">{initialData ? "Atualizar Tarefa" : "Adicionar Tarefa"}</Button>
    </form>
  );
};

export default TaskForm;