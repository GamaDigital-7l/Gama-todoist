"use client";

import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, CalendarDays, PlusCircle, Settings, LayoutDashboard, ChevronLeft, ChevronRight, AlertCircle, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Client, ClientTask, ClientTaskStatus, ClientTaskGenerationTemplate } from "@/types/client";
import { useSession } from "@/integrations/supabase/auth";
import { format, subMonths, addMonths, parseISO, isBefore, endOfMonth, isSameMonth, differenceInDays, getWeek, getDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import ClientTaskForm from "@/components/client/ClientTaskForm";
import ClientTaskItem from "@/components/client/ClientTaskItem";
import ClientTaskGenerationTemplateForm from "@/components/client/ClientTaskGenerationTemplateForm";
import ClientTaskGenerationTemplateItem from "@/components/client/ClientTaskGenerationTemplateItem";

const KANBAN_COLUMNS: { status: ClientTaskStatus; title: string; color: string }[] = [
  { status: "backlog", title: "Backlog", color: "bg-gray-700" },
  { status: "in_production", title: "Em Produção", color: "bg-blue-700" },
  { status: "in_approval", title: "Em Aprovação", color: "bg-yellow-700" },
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
      )
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
  })) || [];
  return mappedData;
};

const fetchClientTaskTemplates = async (clientId: string, userId: string): Promise<ClientTaskGenerationTemplate[]> => {
  const { data, error } = await supabase
    .from("client_task_generation_templates")
    .select("*")
    .eq("client_id", clientId)
    .eq("user_id", userId)
    .order("template_name", { ascending: true });
  if (error) {
    throw error;
  }
  return data || [];
};

const ClientKanbanPage: React.FC = () => {
  const { id: clientId } = useParams<{ id: string }>(); // Renomeado para clientId
  const navigate = useNavigate();
  const { session } = useSession();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();

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

  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<ClientTask | undefined>(undefined);
  const [isTemplateFormOpen, setIsTemplateFormOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ClientTaskGenerationTemplate | undefined>(undefined);

  // Estados para Drag and Drop
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [draggedFromStatus, setDraggedFromStatus] = useState<ClientTaskStatus | null>(null);

  const updateTaskStatusMutation = useMutation({
    mutationFn: async ({ taskId, newStatus, newOrderIndex }: { taskId: string; newStatus: ClientTaskStatus; newOrderIndex: number }) => {
      if (!userId || !clientId) throw new Error("Usuário não autenticado ou cliente não encontrado.");
      const { error } = await supabase
        .from("client_tasks")
        .update({ status: newStatus, order_index: newOrderIndex, updated_at: new Date().toISOString() })
        .eq("id", taskId)
        .eq("client_id", clientId)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      refetchClientTasks(); // Refetch para atualizar a lista após o drop
      queryClient.invalidateQueries({ queryKey: ["clientTasks", clientId, userId, monthYearRef] });
      showSuccess("Status da tarefa atualizado com sucesso!");
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
    e.dataTransfer.setData("text/plain", taskId); // Necessário para Firefox
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Permite o drop
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
    const newOrderIndex = tasksInTargetColumn.length; // Adiciona ao final da coluna

    await updateTaskStatusMutation.mutateAsync({
      taskId: droppedTaskId,
      newStatus: targetStatus,
      newOrderIndex: newOrderIndex,
    });

    setDraggedTaskId(null);
    setDraggedFromStatus(null);
  };

  const handleAddTask = (status: ClientTaskStatus) => {
    setEditingTask({
      id: "", // Será gerado no form
      client_id: clientId!,
      user_id: userId!,
      title: "",
      description: null,
      month_year_reference: monthYearRef,
      status: status,
      due_date: null,
      is_completed: false,
      completed_at: null,
      order_index: clientTasks?.filter(t => t.status === status).length || 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      tags: [],
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
      refetchClientTasks(); // Refetch para ver as novas tarefas
    } catch (err: any) {
      showError("Erro ao gerar tarefas: " + err.message);
      console.error("Erro ao gerar tarefas:", err);
    }
  };

  const completedTasksCount = clientTasks?.filter(task => task.is_completed).length || 0;
  const totalTasksForMonth = clientTasks?.length || 0;
  const progressPercentage = totalTasksForMonth > 0 ? (completedTasksCount / totalTasksForMonth) * 100 : 0;

  // Lógica para alerta de "Mês atual" e "Próximo mês"
  const today = new Date();
  const isCurrentMonth = isSameMonth(currentMonth, today);
  const isNextMonth = isSameMonth(currentMonth, addMonths(today, 1));

  // Lógica para alerta de "Faltam X/Y até DD/MM"
  const remainingTasks = (client?.monthly_delivery_goal || 0) - completedTasksCount;
  const daysUntilEndOfMonth = differenceInDays(endOfMonth(currentMonth), today);
  const showAlert = isCurrentMonth && remainingTasks > 0 && daysUntilEndOfMonth <= 7; // Alerta se faltam 7 dias ou menos

  // Disparar notificação de 100% de conclusão
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
          console.log("Notificação de conclusão de cliente enviada:", data);
        } catch (err) {
          console.error("Erro ao enviar notificação de conclusão de cliente:", err);
        }
      };
      sendCompletionNotification();
    }
  }, [completedTasksCount, client?.monthly_delivery_goal, progressPercentage, userId, clientId, monthYearRef, client?.name, session?.access_token]);


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
    <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6 bg-background text-foreground">
      {/* Header do Kanban */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between flex-wrap gap-4 mb-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => navigate("/clients")} className="border-border text-foreground hover:bg-accent hover:text-accent-foreground">
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Voltar para Clientes</span>
          </Button>
          {client.logo_url ? (
            <img src={client.logo_url} alt={client.name} className="w-12 h-12 rounded-full object-cover" />
          ) : (
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-xl font-semibold">
              {client.name.charAt(0).toUpperCase()}
            </div>
          )}
          <h1 className="text-3xl font-bold break-words">{client.name}</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button onClick={() => navigate(`/clients/${clientId}`)} variant="secondary">
            <LayoutDashboard className="mr-2 h-4 w-4" /> Ver Dashboard do Cliente
          </Button>
          <Dialog open={isTemplateFormOpen} onOpenChange={setIsTemplateFormOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditingTemplate(undefined)} variant="outline" className="border-blue-500 text-blue-500 hover:bg-blue-500/10">
                <Settings className="mr-2 h-4 w-4" /> Gerenciar Templates
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] w-[90vw] bg-card border border-border rounded-lg shadow-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-foreground">Gerenciar Templates de Tarefas</DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  Crie e edite padrões para gerar tarefas automaticamente.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 p-4">
                <Button onClick={() => setEditingTemplate({ id: "", client_id: clientId!, user_id: userId!, template_name: "", delivery_count: 0, generation_pattern: [], created_at: new Date().toISOString(), updated_at: new Date().toISOString() })} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                  <PlusCircle className="mr-2 h-4 w-4" /> Novo Template
                </Button>
                {clientTaskTemplates && clientTaskTemplates.length > 0 ? (
                  <div className="space-y-2">
                    {clientTaskTemplates.map(template => (
                      <ClientTaskGenerationTemplateItem
                        key={template.id}
                        template={template}
                        onEdit={handleEditTemplate}
                        onDelete={handleDeleteTemplate}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center">Nenhum template configurado.</p>
                )}
                {editingTemplate && (
                  <ClientTaskGenerationTemplateForm
                    clientId={clientId!}
                    initialData={editingTemplate}
                    onTemplateSaved={handleTemplateSaved}
                    onClose={() => setEditingTemplate(undefined)}
                  />
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Seletor de Mês e Progresso */}
      <Card className="bg-card border border-border rounded-lg shadow-sm p-4 mb-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
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
              <SelectTrigger className="w-[180px] bg-input border-border text-foreground focus-visible:ring-ring">
                <SelectValue placeholder="Selecionar Mês" />
              </SelectTrigger>
              <SelectContent className="bg-popover text-popover-foreground border-border rounded-md shadow-lg">
                {Array.from({ length: 12 }).map((_, i) => {
                  const date = addMonths(new Date(), i - 6); // Exibe 6 meses para trás e 5 para frente
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
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-foreground">
                Meta do Mês: {client.monthly_delivery_goal} | Concluídas: {completedTasksCount}/{totalTasksForMonth} ({progressPercentage.toFixed(0)}%)
              </span>
              {isCurrentMonth && client.monthly_delivery_goal > 0 && completedTasksCount < client.monthly_delivery_goal && showAlert && (
                <span className="flex items-center gap-1 text-sm text-orange-500">
                  <AlertCircle className="h-4 w-4" /> Faltam {remainingTasks}/{client.monthly_delivery_goal} até {format(endOfMonth(currentMonth), "dd/MM", { locale: ptBR })}
                </span>
              )}
              {isCurrentMonth && client.monthly_delivery_goal > 0 && completedTasksCount >= client.monthly_delivery_goal && (
                <span className="flex items-center gap-1 text-sm text-green-500">
                  <CheckCircle2 className="h-4 w-4" /> Meta Batida!
                </span>
              )}
              <Button onClick={handleGenerateTasksForMonth} size="sm" className="bg-secondary text-secondary-foreground hover:bg-secondary/90">
                <CalendarDays className="mr-2 h-4 w-4" /> Gerar Tarefas do Mês
              </Button>
            </div>
            <Progress value={progressPercentage} className="w-full" />
          </div>
        </div>
      </Card>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto">
        <div className="inline-flex h-full space-x-4 p-1">
          {KANBAN_COLUMNS.map((column) => (
            <Card
              key={column.status}
              className="flex flex-col w-80 flex-shrink-0 bg-card border border-border rounded-lg shadow-md"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, column.status)}
            >
              <CardHeader className={`p-3 border-b border-border ${column.color} rounded-t-lg`}>
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