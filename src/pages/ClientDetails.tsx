"use client";

import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Edit, Trash2, LayoutDashboard, KanbanSquare, Settings } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Client, ClientTaskGenerationTemplate } from "@/types/client";
import { useSession } from "@/integrations/supabase/auth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import ClientForm from "@/components/ClientForm";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ClientKanbanPage from "./ClientKanbanPage";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale"; // Importação adicionada
import ClientTaskGenerationTemplateForm from "@/components/client/ClientTaskGenerationTemplateForm";
import ClientTaskGenerationTemplateItem from "@/components/client/ClientTaskGenerationTemplateItem";
import { DIALOG_CONTENT_CLASSNAMES } from "@/lib/constants";

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

const ClientDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { session } = useSession();
  const userId = session?.user?.id;

  const { data: client, isLoading: isLoadingClient, error: clientError, refetch } = useQuery<Client | null, Error>({
    queryKey: ["client", id, userId],
    queryFn: () => fetchClientById(id!, userId!),
    enabled: !!id && !!userId,
  });

  const { data: clientTaskTemplates, isLoading: isLoadingTemplates, error: templatesError, refetch: refetchClientTaskTemplates } = useQuery<ClientTaskGenerationTemplate[], Error>({
    queryKey: ["clientTaskTemplates", id, userId],
    queryFn: () => fetchClientTaskTemplates(id!, userId!),
    enabled: !!id && !!userId,
  });

  const [isClientFormOpen, setIsClientFormOpen] = useState(false);
  const [isTemplateFormOpen, setIsTemplateFormOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ClientTaskGenerationTemplate | undefined>(undefined);

  const handleClientSaved = () => {
    refetch();
    setIsClientFormOpen(false);
  };

  const handleDeleteClient = async () => {
    if (!userId || !client?.id) {
      showError("Usuário não autenticado ou cliente não encontrado.");
      return;
    }
    if (window.confirm(`Tem certeza que deseja deletar o cliente "${client.name}" e todas as suas referências visuais e tarefas?`)) {
      try {
        // Deletar tarefas do cliente
        const { error: deleteTasksError } = await supabase
          .from("client_tasks")
          .delete()
          .eq("client_id", client.id)
          .eq("user_id", userId);
        if (deleteTasksError) console.error("Erro ao deletar tarefas do cliente:", deleteTasksError);

        // Deletar templates de geração de tarefas do cliente
        const { error: deleteTemplatesError } = await supabase
          .from("client_task_generation_templates")
          .delete()
          .eq("client_id", client.id)
          .eq("user_id", userId);
        if (deleteTemplatesError) console.error("Erro ao deletar templates de tarefas do cliente:", deleteTemplatesError);

        // Deletar moodboards do cliente
        const { error: deleteMoodboardsError } = await supabase
          .from("moodboards")
          .delete()
          .eq("client_id", client.id)
          .eq("user_id", userId);
        if (deleteMoodboardsError) console.error("Erro ao deletar moodboards do cliente:", deleteMoodboardsError);

        // Finalmente, deletar o cliente
        const { error } = await supabase
          .from("clients")
          .delete()
          .eq("id", client.id)
          .eq("user_id", userId);

        if (error) throw error;
        showSuccess("Cliente deletado com sucesso!");
        navigate("/clients"); // Voltar para a lista de clientes
      } catch (err: any) {
        showError("Erro ao deletar cliente: " + err.message);
        console.error("Erro ao deletar cliente:", err);
      }
    }
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
    if (!userId || !id) {
      showError("Usuário não autenticado ou cliente não encontrado.");
      return;
    }
    if (window.confirm("Tem certeza que deseja deletar este template de geração de tarefas?")) {
      try {
        const { error } = await supabase
          .from("client_task_generation_templates")
          .delete()
          .eq("id", templateId)
          .eq("client_id", id)
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

  if (!id) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 md:px-10 lg:p-6 bg-background text-foreground">
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
        <p className="text-lg text-muted-foreground">Preparando o dashboard do cliente.</p>
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
    <div className="flex flex-1 flex-col gap-4 p-4 md:px-10 lg:p-6 bg-background text-foreground">
      {/* Área Superior: Nome do Cliente, Logo e Botões */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between flex-wrap gap-4 mb-4">
        <div className="flex items-center gap-4 min-w-0 flex-1"> {/* Adicionado flex-1 aqui */}
          <Button variant="outline" size="icon" onClick={() => navigate("/clients")} className="border-border text-foreground hover:bg-accent hover:text-accent-foreground flex-shrink-0">
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Voltar para Clientes</span>
          </Button>
          {client.logo_url ? (
            <img src={client.logo_url} alt={client.name} className="w-12 h-12 rounded-full object-cover flex-shrink-0" />
          ) : (
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-xl font-semibold flex-shrink-0">
              {client.name.charAt(0).toUpperCase()}
            </div>
          )}
          <h1 className="text-3xl font-bold break-words min-w-0 truncate">{client.name}</h1> {/* Adicionado truncate */}
        </div>
        <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
          <Dialog open={isClientFormOpen} onOpenChange={setIsClientFormOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setIsClientFormOpen(true)} variant="outline" className="border-blue-500 text-blue-500 hover:bg-blue-500/10 w-full sm:w-auto">
                <Edit className="mr-2 h-4 w-4" /> Editar Cliente
              </Button>
            </DialogTrigger>
            <DialogContent className={DIALOG_CONTENT_CLASSNAMES}>
              <DialogHeader>
                <DialogTitle className="text-foreground">Editar Cliente</DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  Atualize os detalhes do seu cliente.
                </DialogDescription>
              </DialogHeader>
              <ClientForm
                initialData={client}
                onClientSaved={handleClientSaved}
                onClose={() => setIsClientFormOpen(false)}
              />
            </DialogContent>
          </Dialog>
          <Button onClick={handleDeleteClient} variant="destructive" className="w-full sm:w-auto">
            <Trash2 className="mr-2 h-4 w-4" /> Excluir Cliente
          </Button>
        </div>
      </div>

      {/* Tabs para Dashboard, Kanban e Templates */}
      <Tabs defaultValue="kanban" className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 bg-secondary/50 border border-border rounded-md mb-4"> {/* Ajustado grid-cols-3 */}
          <TabsTrigger value="dashboard" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm data-[state=active]:border-primary/50 rounded-md text-sm md:text-base">
            <LayoutDashboard className="mr-2 h-4 w-4" /> Dashboard
          </TabsTrigger>
          <TabsTrigger value="kanban" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm data-[state=active]:border-primary/50 rounded-md text-sm md:text-base">
            <KanbanSquare className="mr-2 h-4 w-4" /> Kanban
          </TabsTrigger>
          <TabsTrigger value="templates" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm data-[state=active]:border-primary/50 rounded-md text-sm md:text-base">
            <Settings className="mr-2 h-4 w-4" /> Templates
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="flex-1">
          <Card className="flex-1 flex flex-col bg-card border border-border rounded-xl shadow-sm frosted-glass card-hover-effect">
            <CardHeader>
              <CardTitle className="text-foreground text-lg md:text-xl">Visão Geral do Cliente</CardTitle>
              <CardDescription className="text-muted-foreground text-sm md:text-base">
                Informações detalhadas e um resumo das atividades do cliente.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 p-4">
              {client.description ? (
                <p className="text-sm md:text-base text-muted-foreground mb-3 break-words">{client.description}</p>
              ) : (
                <p className="text-sm md:text-base text-muted-foreground">Nenhuma descrição fornecida para este cliente.</p>
              )}
              {/* Adicionar mais informações do dashboard aqui, se necessário */}
              <div className="mt-4 space-y-1">
                <p className="text-sm md:text-base text-muted-foreground">Tipo de Cliente: <span className="font-semibold text-foreground">{client.type}</span></p>
                <p className="text-sm md:text-base text-muted-foreground">Meta de Entregas Mensais: <span className="font-semibold text-foreground">{client.monthly_delivery_goal}</span></p>
                <p className="text-sm md:text-base text-muted-foreground">Criado em: <span className="font-semibold text-foreground">{format(parseISO(client.created_at), "PPP", { locale: ptBR })}</span></p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="kanban" className="flex-1 flex flex-col">
          {id && <ClientKanbanPage />}
        </TabsContent>

        <TabsContent value="templates" className="flex-1 flex flex-col">
          <Card className="flex-1 flex flex-col bg-card border border-border rounded-xl shadow-sm frosted-glass card-hover-effect">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 flex-wrap gap-2">
              <CardTitle className="text-foreground text-lg md:text-xl">Templates de Geração de Tarefas</CardTitle>
              <Dialog
                open={isTemplateFormOpen}
                onOpenChange={(open) => {
                  setIsTemplateFormOpen(open);
                  if (!open) setEditingTemplate(undefined);
                }}
              >
                <DialogTrigger asChild>
                  <Button onClick={() => setEditingTemplate(undefined)} className="bg-primary text-primary-foreground hover:bg-primary/90 w-full sm:w-auto">
                    <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Template
                  </Button>
                </DialogTrigger>
                <DialogContent className={DIALOG_CONTENT_CLASSNAMES}>
                  <DialogHeader>
                    <DialogTitle className="text-foreground">{editingTemplate ? "Editar Template de Geração" : "Adicionar Novo Template de Geração"}</DialogTitle>
                    <DialogDescription className="text-muted-foreground">
                      {editingTemplate ? "Atualize os detalhes do seu template." : "Crie um novo template para automatizar a geração de tarefas."}
                    </DialogDescription>
                  </DialogHeader>
                  <ClientTaskGenerationTemplateForm
                    clientId={id!}
                    initialData={editingTemplate}
                    onTemplateSaved={handleTemplateSaved}
                    onClose={() => setIsTemplateFormOpen(false)}
                  />
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="flex-1 p-4 space-y-3">
              {isLoadingTemplates ? (
                <p className="text-muted-foreground">Carregando templates...</p>
              ) : templatesError ? (
                <p className="text-red-500">Erro ao carregar templates: {templatesError.message}</p>
              ) : clientTaskTemplates && clientTaskTemplates.length > 0 ? (
                <div className="space-y-3">
                  {clientTaskTemplates.map((template) => (
                    <ClientTaskGenerationTemplateItem
                      key={template.id}
                      template={template}
                      onEdit={handleEditTemplate}
                      onDelete={handleDeleteTemplate}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">Nenhum template de geração de tarefas encontrado. Adicione um novo para automatizar!</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ClientDetails;