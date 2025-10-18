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
import { CalendarIcon, Loader2 } from "lucide-react"; 
import { format } from "date-fns";
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
import TagSelector from "./TagSelector";
import { Checkbox } from "@/components/ui/checkbox";
import { OriginBoard, RecurrenceType, Task } from "@/types/task";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ptBR } from "date-fns/locale";
import { DIALOG_CONTENT_CLASSNAMES } from "@/lib/constants"; // Importar a constante

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
  recurrence_type: z.enum(["none", "daily", "weekly", "monthly"]).default("none"),
  recurrence_details: z.string().optional().nullable(),
  recurrence_time: z.string().optional().nullable(), 
  selected_tag_ids: z.array(z.string()).optional(),
  origin_board: z.enum(["general", "today_priority", "today_no_priority", "overdue", "completed", "recurrent", "jobs_woe_today", "client_tasks"]).default("general"),
  current_board: z.enum(["general", "today_priority", "today_no_priority", "overdue", "completed", "recurrent", "jobs_woe_today", "client_tasks"]).default("general"), 
  is_priority: z.boolean().default(false), 
  parent_task_id: z.string().nullable().optional(),
});

export type TaskFormValues = z.infer<typeof taskSchema>;

interface TaskFormProps {
  initialData?: Omit<TaskFormValues, 'due_date' | 'recurrence_details' | 'current_board'> & {
    id: string;
    due_date?: string | Date | null;
    recurrence_details?: string | null;
    tags?: { id: string; name: string; color: string }[];
    current_board?: OriginBoard; 
  };
  onTaskSaved: () => void;
  onClose: () => void;
  initialOriginBoard?: OriginBoard;
  initialParentTaskId?: string;
  initialDueDate?: Date; 
}

interface ParentTaskOption {
  id: string;
  title: string;
}

const fetchUserTasks = async (userId: string): Promise<ParentTaskOption[]> => {
  const { data, error } = await supabase
    .from("tasks")
    .select("id, title")
    .eq("user_id", userId)
    .is("parent_task_id", null)
    .order("title", { ascending: true });
  if (error) {
    throw error;
  }
  return data || [];
};

const TaskForm: React.FC<TaskFormProps> = ({ initialData, onTaskSaved, onClose, initialOriginBoard = "general", initialParentTaskId, initialDueDate }) => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const queryClient = useQueryClient(); 

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: initialData ? {
      ...initialData,
      due_date: initialData.due_date ? (typeof initialData.due_date === 'string' ? new Date(initialData.due_date) : initialData.due_date) : undefined,
      time: initialData.time || undefined,
      recurrence_details: initialData.recurrence_details || undefined,
      recurrence_time: initialData.recurrence_time || undefined, 
      selected_tag_ids: initialData.tags?.map(tag => tag.id) || [],
      origin_board: initialData.origin_board || initialOriginBoard,
      current_board: initialData.current_board || initialOriginBoard, 
      is_priority: initialData.is_priority || false, 
      parent_task_id: initialData.parent_task_id || initialParentTaskId || null,
    } : {
      title: "",
      description: "",
      due_date: initialDueDate || undefined, 
      time: undefined,
      recurrence_type: "none",
      recurrence_details: undefined,
      recurrence_time: undefined, 
      selected_tag_ids: [],
      origin_board: initialOriginBoard,
      current_board: initialOriginBoard, 
      is_priority: false, 
      parent_task_id: initialParentTaskId || null,
    },
  });

  const recurrenceType = form.watch("recurrence_type");
  const selectedTagIds = form.watch("selected_tag_ids") || [];
  const watchedRecurrenceDetails = form.watch("recurrence_details");
  const watchedOriginBoard = form.watch("origin_board");
  const watchedParentTaskId = form.watch("parent_task_id");
  const watchedIsPriority = form.watch("is_priority"); 

  const [selectedDays, setSelectedDays] = useState<string[]>([]);

  const { data: userTasks, isLoading: isLoadingUserTasks } = useQuery<ParentTaskOption[], Error>({
    queryKey: ["userTasksForParentSelection", userId],
    queryFn: () => fetchUserTasks(userId!),
    enabled: !!userId && !initialParentTaskId,
  });

  useEffect(() => {
    if (recurrenceType === "weekly" && watchedRecurrenceDetails) {
      setSelectedDays(watchedRecurrenceDetails.split(','));
    } else {
      setSelectedDays([]);
    }
  }, [recurrenceType, watchedRecurrenceDetails]);

  useEffect(() => {
    const setupInitialBoardDefaults = async () => {
      if (!initialData && userId && (initialOriginBoard === "today_priority" || initialOriginBoard === "today_no_priority" || initialOriginBoard === "jobs_woe_today")) {
        form.setValue("due_date", initialDueDate || new Date()); 
        form.setValue("current_board", initialOriginBoard); 
        
        let tagName: string;
        let tagColor: string;
        let isPriority = false;

        if (initialOriginBoard === "today_priority") {
          tagName = 'hoje-prioridade';
          tagColor = '#EF4444';
          isPriority = true;
        } else if (initialOriginBoard === "today_no_priority") {
          tagName = 'hoje-sem-prioridade';
          tagColor = '#3B82F6';
        } else {
          tagName = 'jobs-woe-hoje';
          tagColor = '#8B5CF6';
        }

        form.setValue("is_priority", isPriority); 

        let tagId: string | undefined;

        const { data: existingTag, error: fetchTagError } = await supabase
          .from('tags')
          .select('id')
          .eq('user_id', userId)
          .eq('name', tagName)
          .single();

        if (fetchTagError && fetchTagError.code !== 'PGRST116') {
          console.error("Erro ao buscar tag:", fetchTagError);
          showError("Erro ao buscar tag padrão.");
        } else if (existingTag) {
          tagId = existingTag.id;
        } else {
          const { data: newTag, error: createTagError } = await supabase
            .from('tags')
            .insert({ user_id: userId, name: tagName, color: tagColor })
            .select('id')
            .single();
          if (createTagError) {
            console.error("Erro ao criar tag padrão:", createTagError);
            showError("Erro ao criar tag padrão.");
          } else {
            tagId = newTag.id;
          }
        }

        if (tagId) {
          form.setValue("selected_tag_ids", [tagId]);
        }
      }
    };

    setupInitialBoardDefaults();
  }, [initialData, initialOriginBoard, userId, form, initialDueDate]);


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
        description: values.description || null,
        due_date: values.due_date ? format(values.due_date, "yyyy-MM-dd") : null,
        time: values.time || null,
        recurrence_type: values.recurrence_type,
        recurrence_details: values.recurrence_type === "weekly" ? selectedDays.join(',') || null : values.recurrence_details || null,
        recurrence_time: values.recurrence_time || null, 
        updated_at: new Date().toISOString(),
        origin_board: values.origin_board,
        current_board: values.current_board, 
        is_priority: values.is_priority, 
        parent_task_id: values.parent_task_id || null,
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
          overdue: false, 
          user_id: userId,
        }).select("id").single();

        if (error) throw error;
        taskId = data.id;
        showSuccess("Tarefa adicionada com sucesso!");
      }

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
      queryClient.invalidateQueries({ queryKey: ["allTasks", userId] });
      queryClient.invalidateQueries({ queryKey: ["dashboardTasks", values.origin_board, userId] });
      queryClient.invalidateQueries({ queryKey: ["dailyPlannerTasks", userId] });
      queryClient.invalidateQueries({ queryKey: ["userTasksForParentSelection", userId] });
    } catch (error: any) {
      showError("Erro ao salvar tarefa: " + error.message);
      console.error("Erro ao salvar tarefa:", error);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-4 bg-card rounded-xl frosted-glass card-hover-effect">
      <div>
        <Label htmlFor="title" className="text-foreground">Título</Label>
        <Input
          id="title"
          {...form.register("title")}
          placeholder="Ex: Fazer exercícios"
          className="w-full bg-input border-border text-foreground focus-visible:ring-ring"
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
          placeholder="Detalhes da tarefa (ex: 30 minutos de leitura, 10 páginas, 1h de estudo)..."
          className="w-full bg-input border-border text-foreground focus-visible:ring-ring"
        />
      </div>
      
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
              <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
              {form.watch("due_date") ? (
                format(form.watch("due_date")!, "PPP", { locale: ptBR })
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
              locale={ptBR}
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
          onValueChange={(value: RecurrenceType) => {
            form.setValue("recurrence_type", value);
            form.setValue("recurrence_details", null);
            form.setValue("recurrence_time", null); 
            setSelectedDays([]);
          }}
          value={recurrenceType}
        >
          <SelectTrigger id="recurrence_type" className="w-full bg-input border-border text-foreground focus-visible:ring-ring">
            <SelectValue placeholder="Selecionar tipo de recorrência" />
          </SelectTrigger>
          <SelectContent className="bg-popover text-popover-foreground border-border rounded-md shadow-lg">
            <SelectItem value="none">Nenhuma</SelectItem>
            <SelectItem value="daily">Diário</SelectItem>
            <SelectItem value="weekly">Semanal (selecionar dias)</SelectItem>
            <SelectItem value="monthly">Mensal</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {recurrenceType !== "none" && (
        <div>
          <Label htmlFor="recurrence_time" className="text-foreground">Horário de Recorrência (Opcional)</Label>
          <TimePicker
            value={form.watch("recurrence_time") || null}
            onChange={(time) => form.setValue("recurrence_time", time || null)}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Se definido, você receberá uma notificação neste horário para a tarefa recorrente.
          </p>
        </div>
      )}

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
                  className="border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground flex-shrink-0"
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
            className="w-full bg-input border-border text-foreground focus-visible:ring-ring"
          />
          {form.formState.errors.recurrence_details && (
            <p className="text-red-500 text-sm mt-1">
              {form.formState.errors.recurrence_details.message}
            </p>
          )}
        </div>
      )}

      <div>
        <Label htmlFor="origin_board" className="text-foreground">Quadro de Origem</Label>
        <Select
          onValueChange={(value: OriginBoard) => {
            form.setValue("origin_board", value);
            form.setValue("current_board", value); 
            form.setValue("is_priority", value === "today_priority"); 
          }}
          value={watchedOriginBoard}
          disabled={!!initialData}
        >
          <SelectTrigger id="origin_board" className="w-full bg-input border-border text-foreground focus-visible:ring-ring">
            <SelectValue placeholder="Selecionar quadro" />
          </SelectTrigger>
          <SelectContent className="bg-popover text-popover-foreground border-border rounded-md shadow-lg">
            <SelectItem value="general">Geral</SelectItem>
            <SelectItem value="today_priority">Hoje - Prioridade</SelectItem>
            <SelectItem value="today_no_priority">Hoje - Sem Prioridade</SelectItem>
            <SelectItem value="jobs_woe_today">Jobs Woe hoje</SelectItem>
            <SelectItem value="overdue">Atrasadas</SelectItem>
            <SelectItem value="completed">Finalizadas</SelectItem>
            <SelectItem value="recurrent">Recorrentes</SelectItem>
            <SelectItem value="client_tasks">Tarefas de Clientes</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="is_priority"
          checked={watchedIsPriority}
          onCheckedChange={(checked) => form.setValue("is_priority", checked as boolean)}
          className="border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground flex-shrink-0"
        />
        <Label htmlFor="is_priority" className="text-foreground">Marcar como Prioritária</Label>
      </div>

      {!initialParentTaskId && (
        <div>
          <Label htmlFor="parent_task_id" className="text-foreground">Tarefa Pai (Opcional)</Label>
          <Select
            onValueChange={(value: string) => form.setValue("parent_task_id", value === "none-selected" ? null : value)}
            value={watchedParentTaskId || "none-selected"}
            disabled={isLoadingUserTasks}
          >
            <SelectTrigger id="parent_task_id" className="w-full bg-input border-border text-foreground focus-visible:ring-ring">
              <SelectValue placeholder="Selecionar tarefa pai" />
            </SelectTrigger>
            <SelectContent className="bg-popover text-popover-foreground border-border rounded-md shadow-lg">
              <SelectItem value="none-selected">Nenhuma</SelectItem>
              {userTasks?.map(task => (
                <SelectItem key={task.id} value={task.id}>{task.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
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