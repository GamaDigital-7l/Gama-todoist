"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, Edit, XCircle, CalendarDays, Clock, User } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Client, ClientTask, PublicApprovalLink } from "@/types/client";
import { format, parseISO, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";
import FullScreenImageViewer from "@/components/client/FullScreenImageViewer";
import EditReasonDialog from "@/components/client/EditReasonDialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface PublicApprovalPageProps {
  // Não recebe props, usa useParams
}

const fetchApprovalData = async (uniqueId: string): Promise<{ client: Client; tasks: ClientTask[]; approvalLink: PublicApprovalLink } | null> => {
  // 1. Buscar o link de aprovação
  const { data: approvalLink, error: fetchLinkError } = await supabase
    .from('public_approval_links')
    .select('*')
    .eq('unique_id', uniqueId)
    .single();

  if (fetchLinkError || !approvalLink) {
    throw new Error("Link de aprovação inválido ou não encontrado.");
  }

  if (new Date() > new Date(approvalLink.expires_at)) {
    throw new Error("Este link de aprovação expirou.");
  }

  // 2. Buscar o cliente
  const { data: client, error: fetchClientError } = await supabase
    .from('clients')
    .select('*')
    .eq('id', approvalLink.client_id)
    .eq('user_id', approvalLink.user_id)
    .single();

  if (fetchClientError || !client) {
    throw new Error("Cliente associado ao link não encontrado.");
  }

  // 3. Buscar as tarefas do cliente para o mês de referência que estão 'in_approval' ou 'edit_requested'
  const { data: tasks, error: fetchTasksError } = await supabase
    .from('client_tasks')
    .select(`
      *,
      client_task_tags(
        tags(id, name, color)
      ),
      responsible:profiles(id, first_name, last_name, avatar_url)
    `)
    .eq('client_id', approvalLink.client_id)
    .eq('user_id', approvalLink.user_id)
    .eq('month_year_reference', approvalLink.month_year_reference)
    .in('status', ['in_approval', 'edit_requested']) // Apenas tarefas que precisam de ação
    .order('order_index', { ascending: true });

  if (fetchTasksError) {
    throw new Error("Erro ao carregar tarefas para aprovação.");
  }

  const mappedTasks = tasks?.map((task: any) => ({
    ...task,
    tags: task.client_task_tags.map((ctt: any) => ctt.tags),
    responsible: task.responsible ? task.responsible : null,
  })) || [];

  return { client, tasks: mappedTasks, approvalLink };
};

const PublicApprovalPage: React.FC<PublicApprovalPageProps> = () => {
  const { uniqueId } = useParams<{ uniqueId: string }>();

  const { data, isLoading, error, refetch } = useQuery<
    { client: Client; tasks: ClientTask[]; approvalLink: PublicApprovalLink } | null,
    Error
  >({
    queryKey: ["publicApprovalData", uniqueId],
    queryFn: () => fetchApprovalData(uniqueId!),
    enabled: !!uniqueId,
  });

  const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedImageDescription, setSelectedImageDescription] = useState<string | null>(null);
  const [isEditReasonDialogOpen, setIsEditReasonDialogOpen] = useState(false);
  const [taskToEditId, setTaskToEditId] = useState<string | null>(null);
  const [initialEditReason, setInitialEditReason] = useState<string | null>(null);

  const updateTaskStatusPublic = async (taskId: string, newStatus: ClientTaskStatus, editReason?: string | null) => {
    try {
      const response = await fetch(`${supabase.supabaseUrl}/functions/v1/update-client-task-status-public`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ uniqueId, taskId, newStatus, editReason }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Erro desconhecido ao atualizar status da tarefa.");
      }

      showSuccess(`Tarefa ${newStatus === 'approved' ? 'aprovada' : 'com edição solicitada'} com sucesso!`);
      refetch(); // Re-fetch data to update UI
    } catch (err: any) {
      showError("Erro ao atualizar status da tarefa: " + err.message);
      console.error("Erro ao atualizar status da tarefa:", err);
    }
  };

  const handleApproveTask = (taskId: string) => {
    updateTaskStatusPublic(taskId, 'approved');
  };

  const handleRequestEditClick = (taskId: string, currentReason?: string | null) => {
    setTaskToEditId(taskId);
    setInitialEditReason(currentReason || null);
    setIsEditReasonDialogOpen(true);
  };

  const handleRequestEditSubmit = (reason: string) => {
    if (taskToEditId) {
      updateTaskStatusPublic(taskToEditId, 'edit_requested', reason);
    }
    setIsEditReasonDialogOpen(false);
    setTaskToEditId(null);
    setInitialEditReason(null);
  };

  const openImageViewer = (imageUrl: string, description?: string | null) => {
    setSelectedImage(imageUrl);
    setSelectedImageDescription(description || null);
    setIsImageViewerOpen(true);
  };

  if (!uniqueId) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground p-4">
        <h1 className="text-3xl font-bold mb-4">Link Inválido</h1>
        <p className="text-lg text-muted-foreground">O link de aprovação não foi fornecido.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground p-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <h1 className="text-3xl font-bold mt-4">Carregando Materiais...</h1>
        <p className="text-lg text-muted-foreground">Preparando a página de aprovação.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground p-4">
        <h1 className="text-3xl font-bold text-red-500">Erro ao Carregar</h1>
        <p className="text-lg text-red-500 text-center">{error.message}</p>
      </div>
    );
  }

  if (!data || !data.client || !data.tasks) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground p-4">
        <h1 className="text-3xl font-bold">Conteúdo Não Encontrado</h1>
        <p className="text-lg text-muted-foreground">Não foi possível carregar os materiais para aprovação.</p>
      </div>
    );
  }

  const { client, tasks, approvalLink } = data;
  const isLinkExpired = new Date() > new Date(approvalLink.expires_at);

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col items-center justify-center text-center mb-8">
        {/* Logo da Agência (Ex: Gama Creative) - Pode ser uma imagem fixa ou configurável */}
        <img src="/favicon.png" alt="Gama Creative Logo" className="h-16 w-16 mb-4" />
        <h1 className="text-4xl font-bold mb-2">Gama Creative</h1>
        
        {client.logo_url && (
          <img src={client.logo_url} alt={client.name} className="h-20 w-20 rounded-full object-cover mt-4 mb-2" />
        )}
        <h2 className="text-3xl font-semibold text-primary mb-2">{client.name}</h2>
        <p className="text-lg text-muted-foreground max-w-2xl">
          Revise e aprove os materiais abaixo para o mês de {format(parseISO(`${approvalLink.month_year_reference}-01`), "MMMM yyyy", { locale: ptBR })}.
        </p>
        {isLinkExpired && (
          <p className="text-red-500 text-xl font-bold mt-4">Este link de aprovação expirou!</p>
        )}
      </header>

      <main className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {tasks.length === 0 ? (
          <div className="col-span-full text-center text-muted-foreground text-xl mt-8">
            Nenhum material pendente de aprovação para este mês.
          </div>
        ) : (
          tasks.map((task) => (
            <Card key={task.id} className={cn(
              "flex flex-col h-full bg-card border rounded-lg shadow-lg overflow-hidden",
              isLinkExpired && "opacity-50 cursor-not-allowed",
              task.status === 'approved' && "border-green-500",
              task.status === 'edit_requested' && "border-orange-500"
            )}>
              {task.image_urls && task.image_urls.length > 0 && (
                <div className="relative w-full h-60 bg-gray-200 dark:bg-gray-800 flex items-center justify-center overflow-hidden">
                  <img
                    src={task.image_urls[0]}
                    alt={task.title}
                    className="w-full h-full object-cover cursor-pointer"
                    onClick={() => !isLinkExpired && openImageViewer(task.image_urls![0], task.description)}
                  />
                  {task.image_urls.length > 1 && (
                    <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
                      +{task.image_urls.length - 1}
                    </div>
                  )}
                </div>
              )}
              <CardHeader className="pb-2">
                <CardTitle className="text-xl font-semibold text-foreground break-words">{task.title}</CardTitle>
                {task.responsible && (
                  <CardDescription className="text-sm text-muted-foreground flex items-center gap-1">
                    <User className="h-4 w-4" /> Responsável: {task.responsible.first_name} {task.responsible.last_name}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="flex-grow flex flex-col justify-between p-4">
                {task.description && (
                  <p className="text-sm text-muted-foreground mb-3 break-words">{task.description}</p>
                )}
                {task.due_date && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                    <CalendarDays className="h-3 w-3" /> Vencimento: {format(parseISO(task.due_date), "PPP", { locale: ptBR })}
                  </p>
                )}
                {task.time && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mb-3">
                    <Clock className="h-3 w-3" /> Horário: {task.time}
                  </p>
                )}
                {task.tags && task.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-auto mb-3">
                    {task.tags.map((tag) => (
                      <Badge key={tag.id} style={{ backgroundColor: tag.color, color: '#FFFFFF' }} className="text-xs">
                        {tag.name}
                      </Badge>
                    ))}
                  </div>
                )}

                {task.status === 'approved' ? (
                  <Button disabled className="w-full bg-green-600 text-white">
                    <CheckCircle2 className="mr-2 h-4 w-4" /> Aprovado
                  </Button>
                ) : task.status === 'edit_requested' ? (
                  <>
                    <Button disabled className="w-full bg-orange-600 text-white mb-2">
                      <Edit className="mr-2 h-4 w-4" /> Edição Solicitada
                    </Button>
                    {task.edit_reason && (
                      <p className="text-xs text-orange-500 italic break-words">Motivo: {task.edit_reason}</p>
                    )}
                    <Button
                      onClick={() => handleApproveTask(task.id)}
                      disabled={isLinkExpired}
                      className="w-full bg-green-600 text-white hover:bg-green-700 mt-2"
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" /> Aprovar Mesmo Assim
                    </Button>
                  </>
                ) : (
                  <div className="flex flex-col gap-2 mt-auto">
                    <Button
                      onClick={() => handleApproveTask(task.id)}
                      disabled={isLinkExpired}
                      className="w-full bg-green-600 text-white hover:bg-green-700"
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" /> Aprovar
                    </Button>
                    <Button
                      onClick={() => handleRequestEditClick(task.id, task.edit_reason)}
                      disabled={isLinkExpired}
                      variant="outline"
                      className="w-full border-orange-500 text-orange-500 hover:bg-orange-500/10"
                    >
                      <Edit className="mr-2 h-4 w-4" /> Solicitar Edição
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </main>

      <FullScreenImageViewer
        isOpen={isImageViewerOpen}
        onClose={() => setIsImageViewerOpen(false)}
        imageUrl={selectedImage || ""}
        description={selectedImageDescription}
      />

      <EditReasonDialog
        isOpen={isEditReasonDialogOpen}
        onClose={() => setIsEditReasonDialogOpen(false)}
        onSubmit={handleRequestEditSubmit}
        initialReason={initialEditReason}
      />
    </div>
  );
};

export default PublicApprovalPage;