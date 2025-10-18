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
import { CalendarIcon, Loader2, Image as ImageIcon, XCircle } from "lucide-react";
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
import { useSession } from "@/integrations/supabase/auth";
import TagSelector from "../TagSelector";
import { ClientTask, ClientTaskStatus } from "@/types/client";
import { Checkbox } from "@/components/ui/checkbox";
import TimePicker from "../TimePicker";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { OriginBoard } from "@/types/task"; 
import { DIALOG_CONTENT_CLASSNAMES } from "@/lib/constants"; // Importar a constante

const clientTaskSchema = z.object({
  title: z.string().min(1, "O título da tarefa é obrigatório."),
  description: z.string().optional(),
  due_date: z.date().optional().nullable(),
  time: z.string().optional().nullable(),
  responsible_id: z.string().nullable().optional(),
  status: z.enum(["in_production", "in_approval", "approved", "scheduled", "published", "edit_requested"]).default("in_production"), 
  selected_tag_ids: z.array(z.string()).optional(),
  is_completed: z.boolean().default(false),
  image_files: z.array(z.instanceof(File)).optional(), 
  image_urls: z.array(z.string().url("URL de imagem inválida.")).optional(), 
  is_standard_task: z.boolean().default(false), 
});

export type ClientTaskFormValues = z.infer<typeof clientTaskSchema>;

interface ClientTaskFormProps {
  clientId: string;
  monthYearRef: string;
  initialData?: ClientTask;
  onTaskSaved: () => void;
  onClose: () => void;
}

interface ProfileOption {
  id: string;
  first_name: string;
  last_name: string;
}

const fetchProfiles = async (): Promise<ProfileOption[]> => {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, first_name, last_name")
    .order("first_name", { ascending: true });
  if (error) {
    throw error;
  }
  return data || [];
};

const sanitizeFilename = (filename: string) => {
  return filename
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9.]/g, "-")
    .replace(/--+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
};

const ClientTaskForm: React.FC<ClientTaskFormProps> = ({ clientId, monthYearRef, initialData, onTaskSaved, onClose }) => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();

  const form = useForm<ClientTaskFormValues>({
    resolver: zodResolver(clientTaskSchema),
    defaultValues: initialData ? {
      ...initialData,
      due_date: initialData.due_date ? parseISO(initialData.due_date) : undefined,
      time: initialData.time || undefined,
      responsible_id: initialData.responsible_id || undefined,
      selected_tag_ids: initialData.tags?.map(tag => tag.id) || [],
      image_files: undefined,
      image_urls: initialData.image_urls || [],
      is_standard_task: initialData.is_standard_task || false,
    } : {
      title: "",
      description: "",
      due_date: undefined,
      time: undefined,
      responsible_id: undefined,
      status: "in_production", 
      selected_tag_ids: [],
      is_completed: false,
      image_files: undefined,
      image_urls: [],
      is_standard_task: false,
    },
  });

  const selectedTagIds = form.watch("selected_tag_ids") || [];
  const existingImageUrls = form.watch("image_urls") || [];

  const { data: profiles, isLoading: isLoadingProfiles } = useQuery<ProfileOption[], Error>({
    queryKey: ["profiles"],
    queryFn: fetchProfiles,
  });

  const handleTagSelectionChange = (newSelectedTagIds: string[]) => {
    form.setValue("selected_tag_ids", newSelectedTagIds, { shouldDirty: true });
  };

  const handleRemoveImage = (urlToRemove: string) => {
    form.setValue("image_urls", existingImageUrls.filter(url => url !== urlToRemove), { shouldDirty: true });
  };

  const onSubmit = async (values: ClientTaskFormValues) => {
    if (!userId) {
      showError("Usuário não autenticado.");
      return;
    }

    try {
      let clientTaskId: string;
      let finalImageUrls: string[] = [...(values.image_urls || [])]; 

      if (values.image_files && values.image_files.length > 0) {
        for (const file of values.image_files) {
          const sanitizedFilename = sanitizeFilename(file.name);
          const filePath = `client-task-images/${userId}/${clientId}/${Date.now()}-${sanitizedFilename}`;

          const { data: uploadData, error: uploadError } = await supabase.storage
            .from("client-task-images")
            .upload(filePath, file, {
              cacheControl: "3600",
              upsert: false,
            });

          if (uploadError) {
            throw new Error("Erro ao fazer upload da imagem: " + uploadError.message);
          }

          const { data: publicUrlData } = supabase.storage
            .from("client-task-images")
            .getPublicUrl(filePath);
          
          finalImageUrls.push(publicUrlData.publicUrl);
        }
      }

      const dataToSave = {
        title: values.title,
        description: values.description || null,
        due_date: values.due_date ? format(values.due_date, "yyyy-MM-dd") : null,
        time: values.time || null,
        responsible_id: values.responsible_id || null,
        status: values.status,
        is_completed: values.is_completed,
        completed_at: values.is_completed ? new Date().toISOString() : null,
        image_urls: finalImageUrls.length > 0 ? finalImageUrls : null,
        is_standard_task: values.is_standard_task,
        updated_at: new Date().toISOString(),
      };

      let mainTaskId: string | null = null;

      if (initialData?.id) {
        const { data, error } = await supabase
          .from("client_tasks")
          .update(dataToSave)
          .eq("id", initialData.id)
          .eq("client_id", clientId)
          .eq("user_id", userId)
          .select("id, main_task_id")
          .single();

        if (error) throw error;
        clientTaskId = data.id;
        mainTaskId = data.main_task_id;
        showSuccess("Tarefa do cliente atualizada com sucesso!");
      } else {
        const { data, error } = await supabase.from("client_tasks").insert({
          ...dataToSave,
          client_id: clientId,
          user_id: userId,
          month_year_reference: monthYearRef,
          order_index: 0, 
        }).select("id, main_task_id").single();

        if (error) throw error;
        clientTaskId = data.id;
        mainTaskId = data.main_task_id;
        showSuccess("Tarefa do cliente adicionada com sucesso!");
      }

      if (values.is_standard_task) {
        const taskDataForMainDashboard = {
          user_id: userId,
          title: values.title,
          description: values.description || null,
          due_date: values.due_date ? format(values.due_date, "yyyy-MM-dd") : null,
          time: values.time || null,
          recurrence_type: "none", 
          recurrence_details: null,
          recurrence_time: values.time || null,
          origin_board: "client_tasks" as OriginBoard, 
          current_board: values.is_completed ? "completed" : "client_tasks" as OriginBoard, 
          is_completed: values.is_completed,
          is_priority: false, 
          overdue: false, 
          completed_at: values.is_completed ? new Date().toISOString() : null,
        };

        if (mainTaskId) {
          const { error: updateMainTaskError } = await supabase
            .from("tasks")
            .update(taskDataForMainDashboard)
            .eq("id", mainTaskId)
            .eq("user_id", userId);
          if (updateMainTaskError) throw updateMainTaskError;
        } else {
          const { data: newMainTask, error: insertMainTaskError } = await supabase
            .from("tasks")
            .insert(taskDataForMainDashboard)
            .select("id")
            .single();
          if (insertMainTaskError) throw insertMainTaskError;
          mainTaskId = newMainTask.id;

          await supabase
            .from("client_tasks")
            .update({ main_task_id: mainTaskId })
            .eq("id", clientTaskId)
            .eq("user_id", userId);
        }

        await supabase.from("task_tags").delete().eq("task_id", mainTaskId);
        if (values.selected_tag_ids && values.selected_tag_ids.length > 0) {
          const mainTaskTagsToInsert = values.selected_tag_ids.map(tagId => ({
            task_id: mainTaskId!,
            tag_id: tagId,
          }));
          const { error: mainTagInsertError } = await supabase.from("task_tags").insert(mainTaskTagsToInsert);
          if (mainTagInsertError) throw mainTagInsertError;
        }
        queryClient.invalidateQueries({ queryKey: ["allTasks", userId] });
        queryClient.invalidateQueries({ queryKey: ["dashboardTasks", "client_tasks", userId] }); 
      } else if (mainTaskId && !values.is_standard_task) {
        await supabase.from("task_tags").delete().eq("task_id", mainTaskId);
        await supabase.from("tasks").delete().eq("id", mainTaskId).eq("user_id", userId);
        await supabase.from("client_tasks").update({ main_task_id: null }).eq("id", clientTaskId).eq("user_id", userId);
        queryClient.invalidateQueries({ queryKey: ["allTasks", userId] });
        queryClient.invalidateQueries({ queryKey: ["dashboardTasks", "client_tasks", userId] }); 
      }

      await supabase.from("client_task_tags").delete().eq("client_task_id", clientTaskId);
      if (values.selected_tag_ids && values.selected_tag_ids.length > 0) {
        const clientTaskTagsToInsert = values.selected_tag_ids.map(tagId => ({
          client_task_id: clientTaskId,
          tag_id: tagId,
        }));
        const { error: tagInsertError } = await supabase.from("client_task_tags").insert(clientTaskTagsToInsert);
        if (tagInsertError) throw tagInsertError;
      }

      form.reset();
      onTaskSaved();
      onClose();
    } catch (error: any) {
      showError("Erro ao salvar tarefa do cliente: " + error.message);
      console.error("Erro ao salvar tarefa do cliente:", error);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-4 bg-card">
      <div>
        <Label htmlFor="title" className="text-foreground">Título da Tarefa</Label>
        <Input
          id="title"
          {...form.register("title")}
          placeholder="Ex: Criar 4 posts para Instagram"
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
          placeholder="Detalhes da tarefa..."
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
        <Label htmlFor="responsible_id" className="text-foreground">Responsável (Opcional)</Label>
        <Select
          onValueChange={(value: string) => form.setValue("responsible_id", value === "none-selected" ? null : value)}
          value={form.watch("responsible_id") || "none-selected"}
          disabled={isLoadingProfiles}
        >
          <SelectTrigger id="responsible_id" className="w-full bg-input border-border text-foreground focus-visible:ring-ring">
            {isLoadingProfiles ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" /> Carregando...
              </div>
            ) : (
              <SelectValue placeholder="Selecionar responsável" />
            )}
          </SelectTrigger>
          <SelectContent className="bg-popover text-popover-foreground border-border rounded-md shadow-lg">
            <SelectItem value="none-selected">Nenhum</SelectItem>
            {profiles?.map(profile => (
              <SelectItem key={profile.id} value={profile.id}>
                {profile.first_name} {profile.last_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="status" className="text-foreground">Status</Label>
        <Select
          onValueChange={(value: ClientTaskStatus) => form.setValue("status", value)}
          value={form.watch("status")}
        >
          <SelectTrigger id="status" className="w-full bg-input border-border text-foreground focus-visible:ring-ring">
            <SelectValue placeholder="Selecionar status" />
          </SelectTrigger>
          <SelectContent className="bg-popover text-popover-foreground border-border rounded-md shadow-lg">
            <SelectItem value="in_production">Em Produção</SelectItem>
            <SelectItem value="in_approval">Em Aprovação</SelectItem>
            <SelectItem value="approved">Aprovado</SelectItem>
            <SelectItem value="scheduled">Agendado</SelectItem>
            <SelectItem value="published">Publicado</SelectItem>
            <SelectItem value="edit_requested">Edição Solicitada</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="is_completed"
          checked={form.watch("is_completed")}
          onCheckedChange={(checked) => form.setValue("is_completed", checked as boolean)}
          className="border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground flex-shrink-0"
        />
        <Label htmlFor="is_completed" className="text-foreground">Concluída</Label>
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="is_standard_task"
          checked={form.watch("is_standard_task")}
          onCheckedChange={(checked) => form.setValue("is_standard_task", checked as boolean)}
          className="border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground flex-shrink-0"
        />
        <Label htmlFor="is_standard_task" className="text-foreground">Tarefa Padrão (aparece no Dashboard Principal)</Label>
      </div>

      <div>
        <Label htmlFor="image_files" className="text-foreground">Imagens (Opcional)</Label>
        <Input
          id="image_files"
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => form.setValue("image_files", Array.from(e.target.files || []))}
          className="w-full bg-input border-border text-foreground focus-visible:ring-ring"
        />
        {form.formState.errors.image_files && (
          <p className="text-red-500 text-sm mt-1">
            {form.formState.errors.image_files.message}
          </p>
        )}
        {existingImageUrls.length > 0 && (
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2"> 
            {existingImageUrls.map((url, index) => (
              <div key={index} className="relative group">
                <img src={url} alt={`Imagem ${index + 1}`} className="w-full h-24 object-cover rounded-md" />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute top-1 right-1 h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => handleRemoveImage(url)}
                >
                  <XCircle className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <TagSelector
        selectedTagIds={selectedTagIds}
        onTagSelectionChange={handleTagSelectionChange}
      />

      <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
        {initialData?.id ? "Atualizar Tarefa" : "Adicionar Tarefa"}
      </Button>
    </form>
  );
};

export default ClientTaskForm;