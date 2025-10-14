"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { Calendar as CalendarIcon, PlusCircle, Edit, Trash2, Search, XCircle, Tag as TagIcon, Check as CheckIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Definição da interface Tag
interface Tag {
  id: string;
  name: string;
  color: string;
}

// Definição da interface Task
interface Task {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  tags?: Tag[]; // Tornando a propriedade tags opcional
}

const taskSchema = z.object({
  title: z.string().min(1, "O título é obrigatório."),
  description: z.string().optional(),
  due_date: z.string().nullable().optional(),
  completed: z.boolean().default(false),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  tag_ids: z.array(z.string()).optional(), // Para enviar IDs de tags
});

type TaskFormValues = z.infer<typeof taskSchema>;

const Tasks: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterCompleted, setFilterCompleted] = useState<string>("all");
  const [filterTag, setFilterTag] = useState<string>("all");

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: "",
      description: "",
      due_date: null,
      completed: false,
      priority: "medium",
      tag_ids: [],
    },
  });

  const fetchTasks = useCallback(async () => {
    let query = supabase
      .from("tasks")
      .select(`
        *,
        task_tags(
          tags(id, name, color)
        )
      `)
      .order("due_date", { ascending: true })
      .order("created_at", { ascending: false });

    if (searchTerm) {
      query = query.ilike("title", `%${searchTerm}%`);
    }

    if (filterPriority !== "all") {
      query = query.eq("priority", filterPriority);
    }

    if (filterCompleted !== "all") {
      query = query.eq("completed", filterCompleted === "true");
    }

    if (filterTag !== "all") {
      query = query.filter("task_tags.tag_id", "eq", filterTag);
    }

    const { data, error } = await query;

    if (error) {
      showError("Erro ao carregar tarefas: " + error.message);
    } else {
      const formattedTasks: Task[] = data.map((task: any) => ({
        ...task,
        tags: task.task_tags.map((tt: any) => tt.tags),
      }));
      setTasks(formattedTasks);
    }
  }, [searchTerm, filterPriority, filterCompleted, filterTag]);

  const fetchTags = useCallback(async () => {
    const { data, error } = await supabase
      .from("tags")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      showError("Erro ao carregar tags: " + error.message);
    } else {
      setTags(data || []);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
    fetchTags();
  }, [fetchTasks, fetchTags]);

  const openModal = (task?: Task) => {
    if (task) {
      setEditingTask(task);
      form.reset({
        title: task.title,
        description: task.description || "",
        due_date: task.due_date,
        completed: task.completed,
        priority: task.priority,
        tag_ids: task.tags?.map(tag => tag.id), // Usar encadeamento opcional aqui também
      });
      setSelectedDate(task.due_date ? new Date(task.due_date) : undefined);
    } else {
      setEditingTask(null);
      form.reset({
        title: "",
        description: "",
        due_date: null,
        completed: false,
        priority: "medium",
        tag_ids: [],
      });
      setSelectedDate(undefined);
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingTask(null);
    form.reset();
    setSelectedDate(undefined);
  };

  const onSubmit = async (values: TaskFormValues) => {
    try {
      const taskData = {
        title: values.title,
        description: values.description || null,
        due_date: values.due_date,
        completed: values.completed,
        priority: values.priority,
      };

      if (editingTask) {
        const { error } = await supabase
          .from("tasks")
          .update(taskData)
          .eq("id", editingTask.id);

        if (error) throw error;

        // Update task_tags
        await supabase.from("task_tags").delete().eq("task_id", editingTask.id);
        if (values.tag_ids && values.tag_ids.length > 0) {
          const taskTagsToInsert = values.tag_ids.map(tagId => ({
            task_id: editingTask.id,
            tag_id: tagId,
          }));
          const { error: tagError } = await supabase.from("task_tags").insert(taskTagsToInsert);
          if (tagError) throw tagError;
        }

        showSuccess("Tarefa atualizada com sucesso!");
      } else {
        const { data, error } = await supabase
          .from("tasks")
          .insert(taskData)
          .select()
          .single();

        if (error) throw error;

        // Insert task_tags
        if (values.tag_ids && values.tag_ids.length > 0) {
          const taskTagsToInsert = values.tag_ids.map(tagId => ({
            task_id: data.id,
            tag_id: tagId,
          }));
          const { error: tagError } = await supabase.from("task_tags").insert(taskTagsToInsert);
          if (tagError) throw tagError;
        }

        showSuccess("Tarefa criada com sucesso!");
      }
      closeModal();
      fetchTasks();
    } catch (error: any) {
      showError("Erro ao salvar tarefa: " + error.message);
      console.error("Erro ao salvar tarefa:", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Tem certeza que deseja excluir esta tarefa?")) return;
    try {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
      showSuccess("Tarefa excluída com sucesso!");
      fetchTasks();
    } catch (error: any) {
      showError("Erro ao excluir tarefa: " + error.message);
      console.error("Erro ao excluir tarefa:", error);
    }
  };

  const handleToggleComplete = async (task: Task) => {
    try {
      const { error } = await supabase
        .from("tasks")
        .update({ completed: !task.completed })
        .eq("id", task.id);
      if (error) throw error;
      showSuccess("Status da tarefa atualizado!");
      fetchTasks();
    } catch (error: any) {
      showError("Erro ao atualizar status da tarefa: " + error.message);
      console.error("Erro ao atualizar status da tarefa:", error);
    }
  };

  const getPriorityColor = (priority: 'low' | 'medium' | 'high') => {
    switch (priority) {
      case 'low': return 'bg-green-500';
      case 'medium': return 'bg-yellow-500';
      case 'high': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6 bg-background text-foreground">
      <h1 className="text-3xl font-bold">Minhas Tarefas</h1>
      <p className="text-lg text-muted-foreground">
        Gerencie suas tarefas diárias e projetos.
      </p>

      <div className="flex flex-col md:flex-row gap-4 mb-4">
        <div className="relative flex-1">
          <Input
            type="text"
            placeholder="Buscar tarefas..."
            className="pl-10 bg-input border-border text-foreground focus-visible:ring-ring"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          {searchTerm && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
              onClick={() => setSearchTerm("")}
            >
              <XCircle className="h-4 w-4" />
            </Button>
          )}
        </div>
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-full md:w-[180px] bg-input border-border text-foreground focus-visible:ring-ring">
            <SelectValue placeholder="Filtrar por Prioridade" />
          </SelectTrigger>
          <SelectContent className="bg-popover text-popover-foreground border-border rounded-md shadow-lg">
            <SelectItem value="all">Todas as Prioridades</SelectItem>
            <SelectItem value="low">Baixa</SelectItem>
            <SelectItem value="medium">Média</SelectItem>
            <SelectItem value="high">Alta</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterCompleted} onValueChange={setFilterCompleted}>
          <SelectTrigger className="w-full md:w-[180px] bg-input border-border text-foreground focus-visible:ring-ring">
            <SelectValue placeholder="Filtrar por Concluído" />
          </SelectTrigger>
          <SelectContent className="bg-popover text-popover-foreground border-border rounded-md shadow-lg">
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="true">Concluídas</SelectItem>
            <SelectItem value="false">Pendentes</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterTag} onValueChange={setFilterTag}>
          <SelectTrigger className="w-full md:w-[180px] bg-input border-border text-foreground focus-visible:ring-ring">
            <SelectValue placeholder="Filtrar por Tag" />
          </SelectTrigger>
          <SelectContent className="bg-popover text-popover-foreground border-border rounded-md shadow-lg">
            <SelectItem value="all">Todas as Tags</SelectItem>
            {tags.map((tag) => (
              <SelectItem key={tag.id} value={tag.id}>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.color }}></span>
                  {tag.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={() => openModal()} className="w-full md:w-auto bg-primary text-primary-foreground hover:bg-primary/90">
          <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Tarefa
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {tasks.length === 0 ? (
          <p className="col-span-full text-center text-muted-foreground">Nenhuma tarefa encontrada.</p>
        ) : (
          tasks.map((task) => (
            <Card key={task.id} className="bg-card border border-border rounded-lg shadow-sm flex flex-col">
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <div className="space-y-1">
                  <CardTitle className={cn("text-lg font-semibold", task.completed && "line-through text-muted-foreground")}>
                    {task.title}
                  </CardTitle>
                  {task.due_date && (
                    <CardDescription className="text-sm text-muted-foreground">
                      Vence em: {format(new Date(task.due_date), "dd/MM/yyyy")}
                    </CardDescription>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={cn("text-xs", getPriorityColor(task.priority))}>
                    {task.priority === 'low' ? 'Baixa' : task.priority === 'medium' ? 'Média' : 'Alta'}
                  </Badge>
                  <Checkbox
                    checked={task.completed}
                    onCheckedChange={() => handleToggleComplete(task)}
                    aria-label="Marcar como concluída"
                  />
                </div>
              </CardHeader>
              <CardContent className="flex-grow">
                {task.description && (
                  <p className="text-sm text-muted-foreground mb-2">{task.description}</p>
                )}
                {/* Usando encadeamento opcional para tags */}
                {task.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {task.tags.map((tag) => (
                      <Badge key={tag.id} style={{ backgroundColor: tag.color, color: '#FFFFFF' }} className="text-xs">
                        <TagIcon className="h-3 w-3 mr-1" /> {tag.name}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
              <div className="flex justify-end gap-2 p-4 pt-0">
                <Button variant="outline" size="sm" onClick={() => openModal(task)}>
                  <Edit className="h-4 w-4" />
                </Button>
                <Button variant="destructive" size="sm" onClick={() => handleDelete(task.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[425px] bg-card text-foreground border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">{editingTask ? "Editar Tarefa" : "Adicionar Nova Tarefa"}</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {editingTask ? "Faça alterações na sua tarefa aqui." : "Crie uma nova tarefa para organizar seu dia."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title" className="text-foreground">Título</Label>
              <Input
                id="title"
                {...form.register("title")}
                className="bg-input border-border text-foreground focus-visible:ring-ring"
              />
              {form.formState.errors.title && (
                <p className="text-red-500 text-sm">{form.formState.errors.title.message}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description" className="text-foreground">Descrição</Label>
              <Textarea
                id="description"
                {...form.register("description")}
                className="bg-input border-border text-foreground focus-visible:ring-ring"
                rows={3}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="due_date" className="text-foreground">Data de Vencimento</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal bg-input border-border text-foreground focus-visible:ring-ring",
                      !selectedDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, "dd/MM/yyyy") : <span>Escolha uma data</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-popover text-popover-foreground border-border rounded-md shadow-lg">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => {
                      setSelectedDate(date);
                      form.setValue("due_date", date ? format(date, "yyyy-MM-dd") : null);
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="priority" className="text-foreground">Prioridade</Label>
              <Select
                onValueChange={(value: "low" | "medium" | "high") => form.setValue("priority", value)}
                value={form.watch("priority")}
              >
                <SelectTrigger id="priority" className="bg-input border-border text-foreground focus-visible:ring-ring">
                  <SelectValue placeholder="Selecionar prioridade" />
                </SelectTrigger>
                <SelectContent className="bg-popover text-popover-foreground border-border rounded-md shadow-lg">
                  <SelectItem value="low">Baixa</SelectItem>
                  <SelectItem value="medium">Média</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tags" className="text-foreground">Tags</Label>
              <Select
                onValueChange={(value) => {
                  const currentTags = form.getValues("tag_ids") || [];
                  if (currentTags.includes(value)) {
                    form.setValue("tag_ids", currentTags.filter(id => id !== value));
                  } else {
                    form.setValue("tag_ids", [...currentTags, value]);
                  }
                }}
                value="" // Reset value after selection
              >
                <SelectTrigger id="tags" className="bg-input border-border text-foreground focus-visible:ring-ring">
                  <SelectValue placeholder="Adicionar Tags" />
                </SelectTrigger>
                <SelectContent className="bg-popover text-popover-foreground border-border rounded-md shadow-lg">
                  {tags.map((tag) => (
                    <SelectItem key={tag.id} value={tag.id}>
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.color }}></span>
                        {tag.name}
                        {form.watch("tag_ids")?.includes(tag.id) && <CheckIcon className="ml-auto h-4 w-4" />}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex flex-wrap gap-1 mt-2">
                {form.watch("tag_ids")?.map(tagId => {
                  const tag = tags.find(t => t.id === tagId);
                  return tag ? (
                    <Badge
                      key={tag.id}
                      style={{ backgroundColor: tag.color, color: '#FFFFFF' }}
                      className="text-xs cursor-pointer"
                      onClick={() => {
                        const currentTags = form.getValues("tag_ids") || [];
                        form.setValue("tag_ids", currentTags.filter(id => id !== tag.id));
                      }}
                    >
                      <TagIcon className="h-3 w-3 mr-1" /> {tag.name} <XCircle className="ml-1 h-3 w-3" />
                    </Badge>
                  ) : null;
                })}
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="completed"
                checked={form.watch("completed")}
                onCheckedChange={(checked) => form.setValue("completed", checked as boolean)}
              />
              <Label htmlFor="completed" className="text-foreground">Concluída</Label>
            </div>
            <DialogFooter>
              <Button type="submit" className="bg-primary text-primary-foreground hover:bg-primary/90">
                {editingTask ? "Salvar Alterações" : "Criar Tarefa"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Tasks;