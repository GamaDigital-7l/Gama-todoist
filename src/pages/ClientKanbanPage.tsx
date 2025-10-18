"use client";

import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Client, ClientTask, ClientTaskStatus, PublicApprovalLink } from "@/types/client";
import { useSession } from "@/integrations/supabase/auth";
import { format } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { OriginBoard } from "@/types/task";
import { DIALOG_CONTENT_CLASSNAMES } from "@/lib/constants";
import ClientKanbanHeader from "@/components/client/ClientKanbanHeader"; // Novo componente
import KanbanColumn from "@/components/client/KanbanColumn"; // Novo componente
import ClientTaskForm from "@/components/client/ClientTaskForm"; // Mantido

const KANBAN_COLUMNS: { status: ClientTaskStatus; title: string; color: string }[] = [
  { status: "in_production", title: "Em Produção", color: "bg-blue-700" },
  { status: "in_approval", title: "Em Aprovação", color: "bg-yellow-700" },
  { status: "edit_requested", title: "Edição Solicitada", color: "bg-orange-700" },
  { status: "approved", title: "Aprovado", color: "bg-green-700" },
  { status: "scheduled", title: "Agendado", color: "bg-purple-700" },
  { status: "published", title: "Publicado", color: "bg-indigo-700" },
];

const fetchClientById = async (clientId: string, userId: string): Promise<Client | null> => {
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .eq("user_id", userId)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }
  return data || null;
};

const fetchClientTasks = async (clientId: string, userId: string, monthYearRef: string): Promise<ClientTask[]> => {
  const { data, error } = await supabase
    .from("client_tasks")
    .select(`
      *,
      client_task_tags(
        tags(id, name, color)
      ),
      responsible:profiles(id, first_name, last_name, avatar_url)
    `)
    .eq("client_id", clientId)
    .eq("user_id", userId)
    .eq("month_year_reference", monthYearRef)
    .order("order_index", { ascending: true });

  if (error) {
    throw error;
  }
  const mappedData = data?.map((task: any) => ({
    ...task,
    tags: task.client_task_tags.map((ctt: any) => ctt.tags),
    responsible: task.responsible ? task.responsible : null,
  })) || [];
  return mappedData;
};

const fetchPublicApprovalLink = async (clientId: string, userId: string, monthYearRef: string): Promise<PublicApprovalLink | null> => {
  const { data, error } = await supabase
    .from("public_approval_links")
    .select('*')
    .eq("client_id", clientId)
    .eq("user_id", userId)
    .eq("month_year_reference", monthYearRef)
    .single();

  if (error && error.code !== 'PGRST116') {
    return null;
  }
  return data || null;
};

const ClientKanbanPage: React.FC = () => {
  const { id: clientId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { session } = useSession();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const isMobile = useIsMobile();

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const monthYearRef = format(currentMonth, "yyyy-MM");

  const { data: client, isLoading: isLoadingClient, error: clientError } = useQuery<Client | null, Error>({
    queryKey: ["client", clientId, userId],
    queryFn: () => fetchClientById(clientId!, userId!),
    enabled: !!clientId && !!userId,
  });

  const { data: clientTasks, isLoading: isLoadingTasks, error: tasksError, refetch: refetchClientTasks } = useQuery<ClientTask[], Error>({
    queryKey: ["clientTasks", clientId, userId, monthYearRef],
    queryFn: () => fetchClientTasks(clientId!, userId!, monthYearRef),
    enabled: !!clientId && !!userId,
  });

  const { data: publicApprovalLink, isLoading: isLoadingPublicLink, error: publicLinkError, refetch: refetchPublicApprovalLink } = useQuery<PublicApprovalLink | null, Error>({
    queryKey: ["publicApprovalLink", clientId, userId, monthYearRef],
    queryFn: () => fetchPublicApprovalLink(clientId!, userId!, monthYearRef),
    enabled: !!clientId && !!userId,
  });

  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<ClientTask | undefined>(undefined);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);

  // Estados para Drag and Drop
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [draggedFromStatus, setDraggedFromStatus] = useState<ClientTaskStatus | null>(null);

  // Efeito para abrir o formulário de edição de tarefa se `openTaskId` estiver na URL
  useEffect(() => {
    if (clientTasks && !isTaskFormOpen) {
      const openTaskId = searchParams.get('openTaskId');
      if (openTaskId) {
        const taskToOpen = clientTasks.find(task => task.id === openTaskId);
        if (taskToOpen) {
          handleEditTask(taskToOpen);
        }
        searchParams.delete('openTaskId');
        navigate({ search: searchParams.toString() }, { replace: true });
      }
    }
  }, [clientTasks, searchParams, navigate, isTaskFormOpen]);

  const updateClientTaskKanbanMutation = useMutation({
    mutationFn: async ({ taskId, newStatus, newOrderIndex }: { taskId: string; newStatus: ClientTaskStatus; newOrderIndex: number }) => {
      if (!userId || !clientId) throw new Error("Usuário não autenticado ou cliente não encontrado.");

      const { data: currentTask, error: fetchError } = await supabase
        .from("client_tasks")
        .select('is_standard_task, main_task_id')
        .eq('id', taskId)
        .single();

      if (fetchError) throw fetchError;

      const updateData: Partial<ClientTask> = {
        status: newStatus,
        order_index: newOrderIndex,
        updated_at: new Date().toISOString(),
      };

      if (newStatus === 'approved' || newStatus === 'published') {
        updateData.is_completed = true;
        updateData.completed_at = new Date().toISOString();
      } else if (newStatus === 'edit_requested' || newStatus === 'in_production' || newStatus === 'in_approval' || newStatus === 'scheduled') {
        updateData.is_completed = false;
        updateData.completed_at = null;
      }

      const { error } = await supabase
        .from("client_tasks")
        .update(updateData)
        .eq("id", taskId)
        .eq("client_id", clientId)
        .eq("user_id", userId);

      if (error) throw error;

      if (currentTask.is_standard_task && currentTask.main_task_id) {
        const mainTaskUpdateData: { is_completed?: boolean; current_board?: OriginBoard; updated_at: string } = {
          updated_at: new Date().toISOString(),
        };
        if (updateData.is_completed) {
          mainTaskUpdateData.is_completed = true;
          mainTaskUpdateData.current_board = 'completed';
        } else {
          mainTaskUpdateData.is_completed = false;
          mainTaskUpdateData.current_board = 'client_tasks';
        }
        
        const { error: mainTaskError } = await supabase
          .from("tasks")
          .update(mainTaskUpdateData)
          .eq("id", currentTask.main_task_id)
          .eq("user_id", userId);
        if (mainTaskError) console.error("Erro ao sincronizar tarefa principal:", mainTaskError);
        queryClient.invalidateQueries({ queryKey: ["allTasks", userId] });
        queryClient.invalidateQueries({ queryKey: ["dashboardTasks", "client_tasks", userId] });
        queryClient.invalidateQueries({ queryKey: ["dashboardTasks", "completed", userId] });
      }
    },
    onSuccess: () => {
      showSuccess("Status da tarefa atualizado!");
      refetchClientTasks();
      queryClient.invalidateQueries({ queryKey: ["clientTasks", clientId, userId, monthYearRef] });
    },
    onError: (err: any) => {
      showError("Erro ao atualizar status da tarefa: " + err.message);
      console.error("Erro ao atualizar status da tarefa:", err);
    },
  });

  const handleDragStart = (e: React.DragEvent, taskId: string, currentStatus: ClientTaskStatus) => {
    setDraggedTaskId(taskId);
    setDraggedFromStatus(currentStatus);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", taskId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: ClientTaskStatus) => {
    e.preventDefault();
    if (!draggedTaskId || !draggedFromStatus || draggedFromStatus === targetStatus) {
      setDraggedTaskId(null);
      setDraggedFromStatus(null);
      return;
    }

    const droppedTaskId = draggedTaskId;
    const tasksInTargetColumn = clientTasks?.filter(task => task.status === targetStatus) || [];
    const newOrderIndex = tasksInTargetColumn.length;

    await updateClientTaskKanbanMutation.mutateAsync({
      taskId: droppedTaskId,
      newStatus: targetStatus,
      newOrderIndex: newOrderIndex,
    });

    setDraggedTaskId(null);
    setDraggedFromStatus(null);
  };

  const handleAddTask = (status: ClientTaskStatus) => {
    setEditingTask({
      id: "",
      client_id: clientId!,
      user_id: userId!,
      title: "",
      description: null,
      month_year_reference: monthYearRef,
      status: status,
      due_date: null,
      time: null,
      responsible_id: null,
      is_completed: false,
      completed_at: null,
      order_index: clientTasks?.filter(t => t.status === status).length || 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      tags: [],
      responsible: null,
      image_urls: [],
      edit_reason: null,
      is_standard_task: false,
      main_task_id: null,
    });
    setIsTaskFormOpen(true);
  };

  const handleEditTask = (task: ClientTask) => {
    setEditingTask(task);
    setIsTaskFormOpen(true);
  };

  const handleTaskSaved = () => {
    refetchClientTasks();
    setIsTaskFormOpen(false);
    setEditingTask(undefined);
  };

  const handleGenerateTasksForMonth = async () => {
    if (!userId || !clientId) {
      showError("Usuário não autenticado ou cliente não encontrado.");
      return;
    }

    // Fetch templates here, as it's needed for the check
    const { data: clientTaskTemplates, error: templatesError } = await supabase
      .from("client_task_generation_templates")
      .select(`id`)
      .eq("client_id", clientId)
      .eq("user_id", userId)
      .eq("is_active", true);

    if (templatesError) {
      showError("Erro ao buscar templates de geração: " + templatesError.message);
      return;
    }

    if (!clientTaskTemplates || clientTaskTemplates.length === 0) {
      showError("Nenhum template de geração de tarefas ativo configurado para este cliente.");
      return;
    }

    if (!window.confirm(`Tem certeza que deseja gerar tarefas para ${format(currentMonth, "MMMM yyyy", { locale: ptBR })} com base nos templates?`)) {
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('generate-client-tasks', {
        body: { clientId, monthYearRef },
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
        },
      });

      if (error) {
        throw error;
      }
      showSuccess(data.message || "Tarefas geradas com sucesso!");
      refetchClientTasks();
    } catch (err: any) {
      showError("Erro ao gerar tarefas: " + err.message);
      console.error("Erro ao gerar tarefas:", err);
    }
  };

  const handleGenerateApprovalLink = async () => {
    if (!userId || !clientId) {
      showError("Usuário não autenticado ou cliente não encontrado.");
      return;
    }

    const tasksInApproval = clientTasks?.filter(task => task.status === 'in_approval') || [];
    if (tasksInApproval.length === 0) {
      showError("Não há tarefas na coluna 'Em Aprovação' para gerar um link.");
      return;
    }

    setIsGeneratingLink(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-approval-link', {
        body: { clientId, monthYearRef },
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
        },
      });

      if (error) {
        throw error;
      }
      const uniqueId = data.uniqueId;
      const publicLink = `${window.location.origin}/approval/${uniqueId}`;
      setGeneratedLink(publicLink);
      refetchPublicApprovalLink();
      showSuccess("Link de aprovação gerado com sucesso!");
    } catch (err: any) {
      showError("Erro ao gerar link de aprovação: " + err.message);
      console.error("Erro ao gerar link de aprovação:", err);
    } finally {
      setIsGeneratingLink(false);
    }
  };

  const copyLinkToClipboard = () => {
    if (generatedLink) {
      navigator.clipboard.writeText(generatedLink);
      showSuccess("Link copiado para a área de transferência!");
    }
  };

  useEffect(() => {
    if (publicApprovalLink) {
      setGeneratedLink(`${window.location.origin}/approval/${publicApprovalLink.unique_id}`);
    } else {
      setGeneratedLink(null);
    }
  }, [publicApprovalLink]);

  if (!clientId || !client) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-background text-foreground h-full">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <h1 className="text-3xl font-bold mt-4">Carregando Cliente...</h1>
        <p className="text-lg text-muted-foreground">Preparando o workspace do cliente.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 bg-background text-foreground h-full">
      <ClientKanbanHeader
        client={client}
        clientTasks={clientTasks}
        currentMonth={currentMonth}
        setCurrentMonth={setCurrentMonth}
        handleGenerateTasksForMonth={handleGenerateTasksForMonth}
        handleGenerateApprovalLink={handleGenerateApprovalLink}
        generatedLink={generatedLink}
        copyLinkToClipboard={copyLinkToClipboard}
        isGeneratingLink={isGeneratingLink}
        publicApprovalLink={publicApprovalLink}
        session={session}
        userId={userId}
      />

      <div className="flex-1 overflow-hidden">
        {isMobile ? (
          <Carousel
            opts={{
              align: "start",
              dragFree: false,
            }}
            className="w-full"
          >
            <CarouselContent className="-ml-4">
              {KANBAN_COLUMNS.map((column) => (
                <CarouselItem key={column.status} className="pl-4 basis-full">
                  <KanbanColumn
                    column={column}
                    tasks={clientTasks}
                    isLoadingTasks={isLoadingTasks}
                    tasksError={tasksError}
                    handleAddTask={handleAddTask}
                    handleEditTask={handleEditTask}
                    handleDragStart={handleDragStart}
                    handleDragOver={handleDragOver}
                    handleDrop={handleDrop}
                    clientId={clientId!}
                    monthYearRef={monthYearRef}
                  />
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="absolute left-2 top-1/2 -translate-y-1/2 z-10" />
            <CarouselNext className="absolute right-2 top-1/2 -translate-y-1/2 z-10" />
          </Carousel>
        ) : (
          <div className="flex h-full gap-4 overflow-x-auto pb-4 scroll-smooth scroll-snap-x-mandatory scroll-p-4">
            {KANBAN_COLUMNS.map((column) => (
              <KanbanColumn
                key={column.status}
                column={column}
                tasks={clientTasks}
                isLoadingTasks={isLoadingTasks}
                tasksError={tasksError}
                handleAddTask={handleAddTask}
                handleEditTask={handleEditTask}
                handleDragStart={handleDragStart}
                handleDragOver={handleDragOver}
                handleDrop={handleDrop}
                clientId={clientId!}
                monthYearRef={monthYearRef}
              />
            ))}
          </div>
        )}
      </div>

      <Dialog open={isTaskFormOpen} onOpenChange={setIsTaskFormOpen}>
        <DialogContent className={DIALOG_CONTENT_CLASSNAMES}>
          <DialogHeader>
            <DialogTitle className="text-foreground">{editingTask?.id ? "Editar Tarefa do Cliente" : "Adicionar Nova Tarefa do Cliente"}</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {editingTask?.id ? "Atualize os detalhes da tarefa." : "Crie uma nova tarefa para este cliente."}
            </DialogDescription>
          </DialogHeader>
          <ClientTaskForm
            clientId={clientId!}
            monthYearRef={monthYearRef}
            initialData={editingTask}
            onTaskSaved={handleTaskSaved}
            onClose={() => setIsTaskFormOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClientKanbanPage;