"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CheckCircle2, XCircle, Loader2, CalendarDays, Clock, Info, Link as LinkIcon } from "lucide-react";
import { Client, ClientTask, PublicApprovalLink, ClientTaskStatus } from "@/types/client"; // Importar ClientTaskStatus
import { format, parseISO, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabaseUrl } from "@/integrations/supabase/client"; // Importar supabaseUrl

interface PublicApprovalPageProps {}

const fetchPublicApprovalLink = async (linkId: string): Promise<PublicApprovalLink | null> => {
  const { data, error } = await supabase
    .from("public_approval_links")
    .select(`
      *,
      client:clients(
        id, name, logo_url
      ),
      client_tasks:client_tasks(
        id, title, description, due_date, time, status, is_completed, created_at, updated_at, public_approval_enabled,
        client_task_tags(
          tags(id, name, color)
        )
      )
    `)
    .eq("id", linkId)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  if (data) {
    // Map tags for client_tasks
    const mappedClientTasks = data.client_tasks.map((task: any) => ({
      ...task,
      tags: task.client_task_tags.map((ctt: any) => ctt.tags),
    }));

    return {
      ...data,
      client_tasks: mappedClientTasks,
    } as PublicApprovalLink;
  }
  return null;
};

const PublicApprovalPage: React.FC<PublicApprovalPageProps> = () => {
  const { linkId } = useParams<{ linkId: string }>();
  const queryClient = useQueryClient();

  const { data: approvalLink, isLoading, error, refetch } = useQuery<PublicApprovalLink | null, Error>({
    queryKey: ["publicApprovalLink", linkId],
    queryFn: () => fetchPublicApprovalLink(linkId!),
    enabled: !!linkId,
  });

  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (approvalLink?.client_tasks) {
      // Initialize selectedTasks with tasks that are already approved or under review
      const initialSelected = approvalLink.client_tasks
        .filter(task => task.status === "approved" || task.status === "under_review")
        .map(task => task.id);
      setSelectedTasks(initialSelected);
    }
  }, [approvalLink]);

  const handleTaskSelection = (taskId: string, isChecked: boolean) => {
    setSelectedTasks(prev =>
      isChecked ? [...prev, taskId] : prev.filter(id => id !== taskId)
    );
  };

  const updateTaskStatusMutation = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string; status: ClientTaskStatus }) => {
      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/update-client-task-status-public`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            linkId: linkId,
            taskId: taskId,
            newStatus: status,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || `Erro ao atualizar status da tarefa ${taskId}.`);
        }
        return response.json();
      } catch (err: any) {
        console.error("Erro na função de atualização de status:", err);
        throw err;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["publicApprovalLink", linkId] });
      refetch();
    },
    onError: (err: any) => {
      showError("Erro ao atualizar status da tarefa: " + err.message);
    },
  });

  const handleSubmitApproval = async (newStatus: ClientTaskStatus) => {
    if (!approvalLink || selectedTasks.length === 0) {
      showError("Selecione pelo menos uma tarefa para aprovar/rejeitar.");
      return;
    }
    setIsSubmitting(true);
    try {
      for (const taskId of selectedTasks) {
        await updateTaskStatusMutation.mutateAsync({ taskId, status: newStatus });
      }
      showSuccess(`Tarefas marcadas como "${newStatus.replace('_', ' ')}" com sucesso!`);
      setSelectedTasks([]); // Clear selection after submission
    } catch (err) {
      // Error handled by mutation's onError
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusColor = (status: ClientTaskStatus) => {
    switch (status) {
      case "pending": return "bg-gray-500/20 text-gray-500 border-gray-500/50";
      case "in_progress": return "bg-blue-500/20 text-blue-500 border-blue-500/50";
      case "under_review": return "bg-yellow-500/20 text-yellow-500 border-yellow-500/50";
      case "approved": return "bg-green-500/20 text-green-500 border-green-500/50";
      case "rejected": return "bg-red-500/20 text-red-500 border-red-500/50";
      case "completed": return "bg-purple-500/20 text-purple-500 border-purple-500/50";
      default: return "bg-gray-500/20 text-gray-500 border-gray-500/50";
    }
  };

  const getStatusText = (status: ClientTaskStatus) => {
    switch (status) {
      case "pending": return "Pendente";
      case "in_progress": return "Em Progresso";
      case "under_review": return "Em Revisão";
      case "approved": return "Aprovada";
      case "rejected": return "Rejeitada";
      case "completed": return "Concluída";
      default: return "Desconhecido";
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <h1 className="text-3xl font-bold mt-4">Carregando Link de Aprovação...</h1>
        <p className="text-lg text-muted-foreground">Aguarde um momento.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4">
        <XCircle className="h-12 w-12 text-red-500" />
        <h1 className="text-3xl font-bold mt-4">Erro ao Carregar Link</h1>
        <p className="text-lg text-red-500">Ocorreu um erro: {error.message}</p>
        <p className="text-md text-muted-foreground mt-2">Por favor, verifique o link e tente novamente.</p>
      </div>
    );
  }

  if (!approvalLink || isPast(parseISO(approvalLink.expires_at))) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4">
        <Info className="h-12 w-12 text-orange-500" />
        <h1 className="text-3xl font-bold mt-4">Link de Aprovação Inválido ou Expirado</h1>
        <p className="text-lg text-muted-foreground">Este link de aprovação não é válido ou já expirou.</p>
        <p className="text-md text-muted-foreground mt-2">Entre em contato com o remetente para um novo link.</p>
      </div>
    );
  }

  const tasksForApproval = approvalLink.client_tasks.filter(task => task.public_approval_enabled);

  return (
    <div className="flex flex-col items-center min-h-screen bg-background text-foreground p-4 md:p-8">
      <Card className="w-full max-w-4xl bg-card border border-border rounded-xl shadow-lg p-6 space-y-6">
        <CardHeader className="text-center">
          {approvalLink.client?.logo_url && (
            <img src={approvalLink.client.logo_url} alt={`${approvalLink.client.name} Logo`} className="h-20 w-20 object-contain mx-auto mb-4" />
          )}
          <CardTitle className="text-3xl md:text-4xl font-bold text-foreground">
            Aprovação de Materiais para {approvalLink.client?.name || "Cliente"}
          </CardTitle>
          <CardDescription className="text-lg md:text-xl text-muted-foreground max-w-2xl break-words mx-auto">
            Revise e aprove os materiais abaixo para o mês de {format(parseISO(`${approvalLink.month_year_reference}-01`), "MMMM yyyy", { locale: ptBR })}.
          </CardDescription>
        </CardHeader>

        <Separator className="bg-border" />

        {tasksForApproval.length === 0 ? (
          <p className="text-center text-lg text-muted-foreground">Nenhum material disponível para aprovação neste link.</p>
        ) : (
          <div className="space-y-4">
            {tasksForApproval.map((task) => (
              <Card key={task.id} className="bg-muted/20 border border-border rounded-lg p-4 flex items-start gap-4">
                <Checkbox
                  id={`task-${task.id}`}
                  checked={selectedTasks.includes(task.id)}
                  onCheckedChange={(checked) => handleTaskSelection(task.id, checked as boolean)}
                  className="border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground flex-shrink-0 mt-1"
                  disabled={isSubmitting || task.status === "approved" || task.status === "rejected"} // Disable if already approved/rejected
                />
                <div className="flex-grow min-w-0">
                  <label htmlFor={`task-${task.id}`} className="font-semibold text-foreground text-lg break-words cursor-pointer">
                    {task.title}
                  </label>
                  {task.description && (
                    <p className="text-sm text-muted-foreground break-words mt-1">{task.description}</p>
                  )}
                  <p className="text-xs md:text-sm text-muted-foreground flex items-center gap-1 mb-1">
                    <CalendarDays className="h-3 w-3 flex-shrink-0" /> Vencimento: {format(parseISO(task.due_date), "PPP", { locale: ptBR })}
                  </p>
                  {task.time && (
                    <p className="text-xs md:text-sm text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3 flex-shrink-0" /> Horário: {task.time}
                    </p>
                  )}
                  <Badge variant="secondary" className={`${getStatusColor(task.status)} w-fit flex items-center gap-1 mt-2 text-xs md:text-sm`}>
                    Status: {getStatusText(task.status)}
                  </Badge>
                  {task.tags && task.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {task.tags.map((tag) => (
                        <Badge key={tag.id} style={{ backgroundColor: tag.color, color: '#FFFFFF' }} className="text-xs flex-shrink-0">
                          {tag.name}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}

        {tasksForApproval.length > 0 && (
          <div className="flex flex-col sm:flex-row justify-center gap-4 mt-6">
            <Button
              onClick={() => handleSubmitApproval("approved")}
              disabled={selectedTasks.length === 0 || isSubmitting}
              className="bg-green-600 text-white hover:bg-green-700 flex-1 sm:flex-none"
            >
              {isSubmitting && selectedTasks.length > 0 ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
              Aprovar Selecionados
            </Button>
            <Button
              onClick={() => handleSubmitApproval("rejected")}
              disabled={selectedTasks.length === 0 || isSubmitting}
              className="bg-red-600 text-white hover:bg-red-700 flex-1 sm:flex-none"
            >
              {isSubmitting && selectedTasks.length > 0 ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}
              Rejeitar Selecionados
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
};

export default PublicApprovalPage;