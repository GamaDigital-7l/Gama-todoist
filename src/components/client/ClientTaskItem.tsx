"use client";

import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { Button } from "@/components/ui/button";
import { Edit, Trash2, CalendarDays, CheckCircle2, AlertCircle, Clock, User, Image as ImageIcon, XCircle } from "lucide-react";
import { useSession } from "@/integrations/supabase/auth";
import { ClientTask, ClientTaskStatus } from "@/types/client";
import { Badge } from "@/components/ui/badge";
import { format, parseISO, isPast, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import FullScreenImageViewer from "./FullScreenImageViewer";
import EditReasonDialog from "./EditReasonDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import ClientTaskForm from "./ClientTaskForm";
import { OriginBoard } from "@/types/task";

interface ClientTaskItemProps {
  task: ClientTask;
  refetchTasks: () => void;
  onEdit: (task: ClientTask) => void;
  onDragStart: (e: React.DragEvent, taskId: string, currentStatus: ClientTask['status']) => void;
  clientId: string;
  monthYearRef: string;
}

const ClientTaskItem: React.FC<ClientTaskItemProps> = ({ task, refetchTasks, onEdit, onDragStart, clientId, monthYearRef }) => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();

  const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isEditReasonDialogOpen, setIsEditReasonDialogOpen] = useState(false);
  const [taskToEditId, setTaskToEditId] = useState<string | null>(null);
  const [initialEditReason, setInitialEditReason] = useState<string | null>(null);
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false); // Para o formulário de edição da tarefa

  const updateTaskStatusMutation = useMutation({
    mutationFn: async ({ taskId, newStatus, editReason }: { taskId: string; newStatus: ClientTaskStatus; editReason?: string | null }) => {
      if (!userId) {
        showError("Usuário não autenticado.");
        throw new Error("Usuário não autenticado.");
      }

      const updateData: Partial<ClientTask> = {
        status: newStatus,
        updated_at: new Date().toISOString(),
        edit_reason: editReason || null,
      };

      // Se a tarefa for aprovada, marcar como concluída
      if (newStatus === 'approved') {
        updateData.is_completed = true;
        updateData.completed_at = new Date().toISOString();
      } else if (newStatus === 'edit_requested') {
        updateData.is_completed = false;
        updateData.completed_at = null;
      }

      const { error } = await supabase
        .from("client_tasks")
        .update(updateData)
        .eq("id", taskId)
        .eq("client_id", task.client_id)
        .eq("user_id", userId);

      if (error) throw error;

      // Sincronizar com a tarefa principal se for uma tarefa padrão
      if (task.is_standard_task && task.main_task_id) {
        const mainTaskUpdateData: { is_completed?: boolean; current_board?: OriginBoard; updated_at: string } = {
          updated_at: new Date().toISOString(),
        };
        if (newStatus === 'approved') {
          mainTaskUpdateData.is_completed = true;
          mainTaskUpdateData.current_board = 'completed';
        } else if (newStatus === 'edit_requested') {
          mainTaskUpdateData.is_completed = false;
          mainTaskUpdateData.current_board = 'general'; // Ou outro board padrão para tarefas não concluídas
        }
        
        const { error: mainTaskError } = await supabase
          .from("tasks")
          .update(mainTaskUpdateData)
          .eq("id", task.main_task_id)
          .eq("user_id", userId);
        if (mainTaskError) console.error("Erro ao sincronizar tarefa principal:", mainTaskError);
        queryClient.invalidateQueries({ queryKey: ["allTasks", userId] });
        queryClient.invalidateQueries({ queryKey: ["dashboardTasks", "general", userId] });
        queryClient.invalidateQueries({ queryKey: ["dashboardTasks", "completed", userId] });
      }
    },
    onSuccess: () => {
      showSuccess("Status da tarefa atualizado!");
      refetchTasks();
      queryClient.invalidateQueries({ queryKey: ["clientTasks", task.client_id, userId, task.month_year_reference] });
    },
    onError: (err: any) => {
      showError("Erro ao atualizar status da tarefa: " + err.message);
      console.error("Erro ao atualizar status da tarefa:", err);
    },
  });

  const handleDeleteTask = useMutation({
    mutationFn: async (taskId: string) => {
      if (!userId) {
        showError("Usuário não autenticado.");
        throw new Error("Usuário não autenticado.");
      }
      // Se for uma tarefa padrão, deletar também do dashboard principal
      if (task.is_standard_task && task.main_task_id) {
        await supabase.from("task_tags").delete().eq("task_id", task.main_task_id);
        await supabase.from("tasks").delete().eq("id", task.main_task_id).eq("user_id", userId);
        queryClient.invalidateQueries({ queryKey: ["allTasks", userId] });
        queryClient.invalidateQueries({ queryKey: ["dashboardTasks", "general", userId] });
      }

      // Primeiro, deletar as associações de tags
      const { error: deleteTagsError } = await supabase
        .from("client_task_tags")
        .delete()
        .eq("client_task_id", taskId);
      if (deleteTagsError) throw deleteTagsError;

      // Depois, deletar a tarefa
      const { error } = await supabase
        .from("client_tasks")
        .delete()
        .eq("id", taskId)
        .eq("client_id", task.client_id)
        .eq("user_id", userId);

      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Tarefa do cliente deletada com sucesso!");
      refetchTasks();
      queryClient.invalidateQueries({ queryKey: ["clientTasks", task.client_id, userId, task.month_year_reference] });
    },
    onError: (err: any) => {
      showError("Erro ao deletar tarefa do cliente: " + err.message);
      console.error("Erro ao deletar tarefa do cliente:", err);
    },
  });

  const handleApproveTask = () => {
    updateTaskStatusMutation.mutate({ taskId: task.id, newStatus: 'approved' });
  };

  const handleRequestEdit = (reason: string) => {
    updateTaskStatusMutation.mutate({ taskId: task.id, newStatus: 'edit_requested', editReason: reason });
    setIsEditReasonDialogOpen(false);
  };

  const openImageViewer = (imageUrl: string) => {
    setSelectedImage(imageUrl);
    setIsImageViewerOpen(true);
  };

  const isOverdue = task.due_date && isPast(parseISO(task.due_date)) && !task.is_completed;
  const isAwaitingApproval = task.status === 'in_approval';
  const isScheduled = task.status === 'scheduled';
  const isApproved = task.status === 'approved';
  const isEditRequested = task.status === 'edit_requested';

  return (
    <div
      className={cn(
        "flex flex-col p-0 bg-card border rounded-lg shadow-sm cursor-grab active:cursor-grabbing overflow-hidden",
        isOverdue ? "border-red-500" : "border-border",
        task.is_completed && "opacity-70",
        isEditRequested && "border-orange-500"
      )}
      draggable="true"
      onDragStart={(e) => onDragStart(e, task.id, task.status)}
    >
      {task.image_urls && task.image_urls.length > 0 && (
        <div className="relative w-full h-40 bg-gray-200 dark:bg-gray-800 flex items-center justify-center overflow-hidden rounded-t-lg">
          <img
            src={task.image_urls[0]}
            alt={task.title}
            className="w-full h-full object-cover cursor-pointer"
            onClick={() => openImageViewer(task.image_urls![0])}
          />
          {task.image_urls.length > 1 && (
            <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
              +{task.image_urls.length - 1}
            </div>
          )}
        </div>
      )}
      <div className="p-3 flex flex-col flex-grow">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <Checkbox
              id={`client-task-${task.id}`}
              checked={task.is_completed}
              onCheckedChange={(checked) => updateTaskStatusMutation.mutate({ taskId: task.id, newStatus: checked ? 'published' : 'backlog' })}
              className="border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground flex-shrink-0"
              disabled={task.status === 'published'}
            />
            <label
              htmlFor={`client-task-${task.id}`}
              className={cn(
                "text-sm font-medium leading-none text-foreground break-words min-w-0",
                task.is_completed && "line-through text-muted-foreground"
              )}
            >
              {isOverdue && <AlertCircle className="h-4 w-4 text-red-500 inline-block mr-1" />}
              {task.title}
            </label>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <Dialog open={isTaskFormOpen} onOpenChange={setIsTaskFormOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" onClick={() => onEdit(task)} className="h-7 w-7 text-blue-500 hover:bg-blue-500/10">
                  <Edit className="h-4 w-4" />
                  <span className="sr-only">Editar Tarefa</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px] w-[90vw] bg-card border border-border rounded-lg shadow-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="text-foreground">Editar Tarefa do Cliente</DialogTitle>
                  <DialogDescription className="text-muted-foreground">
                    Atualize os detalhes da tarefa.
                  </DialogDescription>
                </DialogHeader>
                <ClientTaskForm
                  clientId={clientId}
                  monthYearRef={monthYearRef}
                  initialData={task}
                  onTaskSaved={refetchTasks}
                  onClose={() => setIsTaskFormOpen(false)}
                />
              </DialogContent>
            </Dialog>
            <Button variant="ghost" size="icon" onClick={() => handleDeleteTask.mutate(task.id)} className="h-7 w-7 text-red-500 hover:bg-red-500/10">
              <Trash2 className="h-4 w-4" />
              <span className="sr-only">Deletar Tarefa</span>
            </Button>
          </div>
        </div>
        {task.description && (
          <p className="text-xs text-muted-foreground mb-2 break-words">{task.description}</p>
        )}
        {task.due_date && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <CalendarDays className="h-3 w-3" /> Vencimento: {format(parseISO(task.due_date), "PPP", { locale: ptBR })}
          </p>
        )}
        {task.time && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" /> Horário: {task.time}
          </p>
        )}
        {task.responsible && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <User className="h-3 w-3" /> Responsável: {task.responsible.first_name} {task.responsible.last_name}
          </p>
        )}
        {isEditRequested && task.edit_reason && (
          <Badge variant="secondary" className="bg-orange-500/20 text-orange-500 border-orange-500/50 mb-2 w-fit break-words">
            Edição Solicitada: {task.edit_reason}
          </Badge>
        )}
        {task.tags && task.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-auto">
            {task.tags.map((tag) => (
              <Badge key={tag.id} style={{ backgroundColor: tag.color, color: '#FFFFFF' }} className="text-xs">
                {tag.name}
              </Badge>
            ))}
          </div>
        )}
        <div className="flex flex-col sm:flex-row gap-2 mt-3">
          <Button
            onClick={handleApproveTask}
            disabled={task.status === 'approved' || task.status === 'published'}
            className="w-full bg-green-600 text-white hover:bg-green-700"
          >
            <CheckCircle2 className="mr-2 h-4 w-4" /> Aprovar
          </Button>
          <Button
            onClick={() => setIsEditReasonDialogOpen(true)}
            disabled={task.status === 'approved' || task.status === 'published'}
            variant="outline"
            className="w-full border-orange-500 text-orange-500 hover:bg-orange-500/10"
          >
            <Edit className="mr-2 h-4 w-4" /> Editar
          </Button>
        </div>
      </div>

      <FullScreenImageViewer
        isOpen={isImageViewerOpen}
        onClose={() => setIsImageViewerOpen(false)}
        imageUrl={selectedImage || ""}
        description={task.description}
      />

      <EditReasonDialog
        isOpen={isEditReasonDialogOpen}
        onClose={() => setIsEditReasonDialogOpen(false)}
        onSubmit={handleRequestEdit}
        initialReason={task.edit_reason}
      />
    </div>
  );
};

export default ClientTaskItem;