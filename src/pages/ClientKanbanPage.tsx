"use client";

import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, CalendarDays, PlusCircle, Settings, LayoutDashboard, ChevronLeft, ChevronRight, AlertCircle, CheckCircle2, Share2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Client, ClientTask, ClientTaskStatus, ClientTaskGenerationTemplate, PublicApprovalLink } from "@/types/client";
import { useSession } from "@/integrations/supabase/auth";
import { format, subMonths, addMonths, parseISO, isBefore, endOfMonth, isSameMonth, differenceInDays, getWeek, getDay, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import ClientTaskForm from "@/components/client/ClientTaskForm";
import ClientTaskItem from "@/components/client/ClientTaskItem";
import ClientTaskGenerationTemplateForm from "@/components/client/ClientTaskGenerationTemplateForm";
import ClientTaskGenerationTemplateItem from "@/components/client/ClientTaskGenerationTemplateItem";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { OriginBoard } from "@/types/task"; // Importar OriginBoard

const KANBAN_COLUMNS: { status: ClientTaskStatus; title: string; color: string }[] = [
  { status: "in_production", title: "Em Produção", color: "bg-blue-700" },
  { status: "in_approval", title: "Em Aprovação", color: "bg-yellow-700" },
  { status: "edit_requested", title: "Edição Solicitada", color: "bg-orange-700" },
  { status: "approved", title: "Aprovado", color: "bg-green-700" },
  { status: "scheduled", title: "Agendado", color: "bg-purple-700" },
  { status: "published", title: "Publicado", color: "bg-indigo-700" },
  // Colunas opcionais (Pausado, Reprovado) podem ser adicionadas aqui se ativadas por cliente
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

const fetchClientTaskTemplates = async (clientId: string, userId: string): Promise<ClientTaskGenerationTemplate[]> => {
  const { data, error } = await supabase
    .from("client_task_generation_templates")
    .select(`
      *,
      client_task_tags(
        tags(id, name, color)
      )
    `)
    .eq("client_id", clientId)
    .eq("user_id", userId)
    .order("template_name", { ascending: true });
  if (error) {
    throw error;
  }
  const mappedData = data?.map((template: any) => ({
    ...template,
    client_task_tags: template.client_task_tags.map((ttt: any) => ttt.tags),
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

  const { data: clientTaskTemplates, isLoading: isLoadingTemplates, error: templatesError, refetch: refetchClientTaskTemplates } = useQuery<ClientTaskGenerationTemplate[], Error>({
    queryKey: ["clientTaskTemplates", clientId, userId],
    queryFn: () => fetchClientTaskTemplates(clientId!, userId!),
    enabled: !!clientId && !!userId,
  });

  const { data: publicApprovalLink, isLoading: isLoadingPublicLink, error: publicLinkError, refetch: refetchPublicApprovalLink } = useQuery<PublicApprovalLink | null, Error>({
    queryKey: ["publicApprovalLink", clientId, userId, monthYearRef],
    queryFn: () => fetchPublicApprovalLink(clientId!, userId!, monthYearRef),
    enabled: !!clientId && !!userId,
  });

  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<ClientTask | undefined>(undefined);
  const [isTemplateFormOpen, setIsTemplateFormOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ClientTaskGenerationTemplate | undefined>(undefined);
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
        // Remover o parâmetro da URL para evitar que o formulário abra novamente em um refresh
        searchParams.delete('openTaskId');
        navigate({ search: searchParams.toString() }, { replace: true });
      }
    }
  }, [clientTasks, searchParams, navigate, isTaskFormOpen]);

  // Nova mutação para operações de arrastar e soltar (status e order_index)
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

      // Determinar is_completed e completed_at com base no newStatus para a tarefa do cliente
      if (newStatus === 'approved' || newStatus === 'published') {
        updateData.is_completed = true;
        updateData.completed_at = new Date().toISOString();
      } else if (newStatus === 'edit_requested' || newStatus === 'in_production' || newStatus === 'in_approval' || newStatus === 'scheduled') { // Removido 'backlog'
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

      // Sincronizar com a tarefa principal se for uma tarefa padrão
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
    const newOrderIndex = tasksInTargetColumn.length; // Adicionar ao final da coluna

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

  const handleTemplateSaved = () => {
    refetchClientTaskTemplates();
    setIsTemplateFormOpen(false);
    setEditingTemplate(undefined);
  };

  const handleEditTemplate = (template: ClientTaskGenerationTemplate) => {
    setEditingTemplate(template);
    setIsTemplateFormOpen(true);
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!userId || !clientId) {
      showError("Usuário não autenticado ou cliente não encontrado.");
      return;
    }
    if (window.confirm("Tem certeza que deseja deletar este template de geração de tarefas?")) {
      try {
        const { error } = await supabase
          .from("client_task_generation_templates")
          .delete()
          .eq("id", templateId)
          .eq("client_id", clientId)
          .eq("user_id", userId);

        if (error) throw error;
        showSuccess("Template deletado com sucesso!");
        refetchClientTaskTemplates();
      } catch (err: any) {
        showError("Erro ao deletar template: " + err.message);
        console.error("Erro ao deletar template:", err);
      }
    }
  };

  const handleGenerateTasksForMonth = async () => {
    if (!userId || !clientId || !clientTaskTemplates || clientTaskTemplates.length === 0) {
      showError("Nenhum template de geração de tarefas configurado para este cliente.");
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
      refetchPublicApprovalLink(); // Atualiza o status do link no UI
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

  const completedTasksCount = clientTasks?.filter(task => task.is_completed).length || 0;
  const totalTasksForMonth = clientTasks?.length || 0;
  const progressPercentage = totalTasksForMonth > 0 ? (completedTasksCount / totalTasksForMonth) * 100 : 0;

  const today = new Date();
  const isCurrentMonth = isSameMonth(currentMonth, today);
  const remainingTasks = (client?.monthly_delivery_goal || 0) - completedTasksCount;
  const daysUntilEndOfMonth = differenceInDays(endOfMonth(currentMonth), today);
  const showAlert = isCurrentMonth && remainingTasks > 0 && daysUntilEndOfMonth <= 7;

  useEffect(() => {
    if (userId && clientId && client && client.monthly_delivery_goal > 0 && completedTasksCount >= client.monthly_delivery_goal && progressPercentage >= 100) {
      const sendCompletionNotification = async () => {
        try {
          const { data, error } = await supabase.functions.invoke('send-client-completion-notification', {
            body: {
              clientId,
              monthYearRef,
              completedCount,
              totalCount: client.monthly_delivery_goal,
              clientName: client.name,
            },
            headers: {
              'Authorization': `Bearer ${session?.access_token}`,
            },
          });
          if (error) throw error;
          // console.log("Notificação de conclusão de cliente enviada:", data);
        } catch (err) {
          console.error("Erro ao enviar notificação de conclusão de cliente:", err);
        }
      };
      sendCompletionNotification();
    }
  }, [completedTasksCount, client?.monthly_delivery_goal, progressPercentage, userId, clientId, monthYearRef, client?.name, session?.access_token]);

  useEffect(() => {
    if (publicApprovalLink) {
      setGeneratedLink(`${window.location.origin}/approval/${publicApprovalLink.unique_id}`);
    } else {
      setGeneratedLink(null);
    }
  }, [publicApprovalLink]);


  if (!clientId) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6 bg-background text-foreground">
        <h1 className="text-3xl font-bold">Cliente Não Encontrado</h1>
        <p className="text-lg text-muted-foreground">O ID do cliente não foi fornecido.</p>
        <Button onClick={() => navigate("/clients")} className="w-fit bg-primary text-primary-foreground hover:bg-primary/90">
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para Clientes
        </Button>
      </div>
    );
  }

  if (isLoadingClient) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-background text-foreground z-50">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <h1 className="text-3xl font-bold mt-4">Carregando Cliente...</h1>
        <p className="text-lg text-muted-foreground">Preparando o workspace do cliente.</p>
      </div>
    );
  }

  if (clientError) {
    showError("Erro ao carregar cliente: " + clientError.message);
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-background text-foreground z-50">
        <h1 className="text-3xl font-bold">Erro ao Carregar Cliente</h1>
        <p className="text-lg text-red-500">Ocorreu um erro: {clientError.message}</p>
        <Button onClick={() => navigate("/clients")} className="w-fit bg-primary text-primary-foreground hover:bg-primary/90 mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para Clientes
        </Button>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-background text-foreground z-50">
        <h1 className="text-3xl font-bold">Cliente Não Encontrado</h1>
        <p className="text-lg text-muted-foreground">O cliente que você está procurando não existe ou foi removido.</p>
        <Button onClick={() => navigate("/clients")} className="w-fit bg-primary text-primary-foreground hover:bg-primary/90 mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para Clientes
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 bg-background text-foreground h-full"> {/* Removido padding aqui, será adicionado no ClientDetails */}
      {/* O cabeçalho do cliente (nome, logo, botões de voltar/editar/excluir) foi movido para ClientDetails.tsx */}

      {/* Seletor de Mês e Progresso */}
      <Card className="bg-card border border-border rounded-xl shadow-sm frosted-glass card-hover-effect p-4 mb-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="border-border text-foreground hover:bg-accent hover:text-accent-foreground">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Select
              value={monthYearRef}
              onValueChange={(value) => {
                const [year, month] = value.split('-').map(Number);
                setCurrentMonth(new Date(year, month - 1, 1));
              }}
            >
              <SelectTrigger className="w-full sm:w-[180px] bg-input border-border text-foreground focus-visible:ring-ring">
                <SelectValue placeholder="Selecionar Mês" />
              </SelectTrigger>
              <SelectContent className="bg-popover text-popover-foreground border-border rounded-md shadow-lg">
                {Array.from({ length: 12 }).map((_, i) => {
                  const date = addMonths(new Date(), i - 6);
                  const value = format(date, "yyyy-MM");
                  const label = format(date, "MMMM yyyy", { locale: ptBR });
                  return <SelectItem key={value} value={value}>{label}</SelectItem>;
                })}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="border-border text-foreground hover:bg-accent hover:text-accent-foreground">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex-1 w-full sm:w-auto">
            <div className="flex flex-col sm:flex-row items-center justify-between mb-1 gap-2 sm:gap-0">
              <span className="text-sm font-medium text-foreground text-center sm:text-left">
                Meta do Mês: {client.monthly_delivery_goal} | Concluídas: {completedTasksCount}/{totalTasksForMonth} ({progressPercentage.toFixed(0)}%)
              </span>
              {isCurrentMonth && client.monthly_delivery_goal > 0 && completedTasksCount < client.monthly_delivery_goal && showAlert && (
                <span className="flex items-center gap-1 text-sm text-orange-500 text-center sm:text-right">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" /> Faltam {remainingTasks}/{client.monthly_delivery_goal} até {format(endOfMonth(currentMonth), "dd/MM", { locale: ptBR })}
                </span>
              )}
              {isCurrentMonth && client.monthly_delivery_goal > 0 && completedTasksCount >= client.monthly_delivery_goal && (
                <span className="flex items-center gap-1 text-sm text-green-500 text-center sm:text-right">
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0" /> Meta Batida!
                </span>
              )}
              <Button onClick={handleGenerateTasksForMonth} size="sm" className="bg-secondary text-secondary-foreground hover:bg-secondary/90 w-full sm:w-auto">
                <CalendarDays className="mr-2 h-4 w-4" /> Gerar Tarefas do Mês
              </Button>
            </div>
            <Progress value={progressPercentage} className="w-full" />
          </div>
        </div>
        <div className="mt-4 flex flex-col sm:flex-row items-center gap-2">
          {generatedLink ? (
            <div className="flex-1 w-full flex flex-col sm:flex-row items-center gap-2">
              <Label htmlFor="approval-link" className="sr-only">Link de Aprovação</Label>
              <Input
                id="approval-link"
                type="text"
                value={generatedLink}
                readOnly
                className="flex-grow bg-input border-border text-foreground focus-visible:ring-ring w-full"
              />
              <Button onClick={copyLinkToClipboard} className="bg-primary text-primary-foreground hover:bg-primary/90 w-full sm:w-auto">
                Copiar Link
              </Button>
            </div>
          ) : (
            <Button
              onClick={handleGenerateApprovalLink}
              disabled={isGeneratingLink || (clientTasks?.filter(task => task.status === 'in_approval').length || 0) === 0}
              className="w-full sm:w-auto bg-blue-600 text-white hover:bg-blue-700"
            >
              {isGeneratingLink ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Share2 className="mr-2 h-4 w-4" />
              )}
              Enviar para Aprovação
            </Button>
          )}
        </div>
      </Card>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto">
        {isMobile ? (
          <Carousel
            opts={{
              align: "start",
              dragFree: false, // Ativar snap
            }}
            className="w-full"
          >
            <CarouselContent className="-ml-4">
              {KANBAN_COLUMNS.map((column) => (
                <CarouselItem key={column.status} className="pl-4 basis-full">
                  <Card
                    className="flex flex-col h-full bg-card border border-border rounded-xl shadow-md frosted-glass"
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, column.status)}
                  >
                    <CardHeader className={`p-3 border-b border-border ${column.color} rounded-t-xl`}>
                      <CardTitle className="text-lg font-semibold text-white">{column.title}</CardTitle>
                      <CardDescription className="text-sm text-white/80">
                        {clientTasks?.filter(task => task.status === column.status).length} tarefas
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 p-3 overflow-y-auto space-y-3">
                      {isLoadingTasks ? (
                        <p className="text-muted-foreground">Carregando tarefas...</p>
                      ) : tasksError ? (
                        <p className="text-red-500">Erro: {tasksError.message}</p>
                      ) : (
                        clientTasks?.filter(task => task.status === column.status).map(task => (
                          <ClientTaskItem
                            key={task.id}
                            task={task}
                            refetchTasks={refetchClientTasks}
                            onEdit={handleEditTask}
                            onDragStart={handleDragStart}
                            clientId={clientId!}
                            monthYearRef={monthYearRef}
                          />
                        ))
                      )}
                      <Button onClick={() => handleAddTask(column.status)} variant="outline" className="w-full border-dashed border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground">
                        <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Tarefa
                      </Button>
                    </CardContent>
                  </Card>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="absolute left-2 top-1/2 -translate-y-1/2 z-10" />
            <CarouselNext className="absolute right-2 top-1/2 -translate-y-1/2 z-10" />
          </Carousel>
        ) : (
          <div className="inline-flex h-full space-x-4 flex-nowrap overflow-x-auto scroll-smooth scroll-snap-x-mandatory scroll-p-4">
            {KANBAN_COLUMNS.map((column) => (
              <Card
                key={column.status}
                className="flex flex-col w-[280px] flex-shrink-0 bg-card border border-border rounded-xl shadow-md frosted-glass h-full scroll-snap-align-start"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, column.status)}
              >
                <CardHeader className={`p-3 border-b border-border ${column.color} rounded-t-xl`}>
                  <CardTitle className="text-lg font-semibold text-white">{column.title}</CardTitle>
                  <CardDescription className="text-sm text-white/80">
                    {clientTasks?.filter(task => task.status === column.status).length} tarefas
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 p-3 overflow-y-auto space-y-3">
                  {isLoadingTasks ? (
                    <p className="text-muted-foreground">Carregando tarefas...</p>
                  ) : tasksError ? (
                    <p className="text-red-500">Erro: {tasksError.message}</p>
                  ) : (
                    clientTasks?.filter(task => task.status === column.status).map(task => (
                      <ClientTaskItem
                        key={task.id}
                        task={task}
                        refetchTasks={refetchClientTasks}
                        onEdit={handleEditTask}
                        onDragStart={handleDragStart}
                        clientId={clientId!}
                        monthYearRef={monthYearRef}
                      />
                    ))
                  )}
                  <Button onClick={() => handleAddTask(column.status)} variant="outline" className="w-full border-dashed border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground">
                    <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Tarefa
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Formulário de Tarefa do Cliente */}
      <Dialog open={isTaskFormOpen} onOpenChange={setIsTaskFormOpen}>
        <DialogContent className="sm:max-w-[425px] w-[90vw] bg-card border border-border rounded-lg shadow-lg max-h-[90vh] overflow-y-auto">
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