"use client";

import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Edit, Trash2, LayoutDashboard, KanbanSquare } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Client } from "@/types/client";
import { useSession } from "@/integrations/supabase/auth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import ClientForm from "@/components/ClientForm";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ClientKanbanPage from "./ClientKanbanPage";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale"; // Importação adicionada

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

const ClientDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { session } = useSession();
  const userId = session?.user?.id;

  const { data: client, isLoading, error, refetch } = useQuery<Client | null, Error>({
    queryKey: ["client", id, userId],
    queryFn: () => fetchClientById(id!, userId!),
    enabled: !!id && !!userId,
  });

  const [isClientFormOpen, setIsClientFormOpen] = useState(false);

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

  if (isLoading) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-background text-foreground z-50">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <h1 className="text-3xl font-bold mt-4">Carregando Cliente...</h1>
        <p className="text-lg text-muted-foreground">Preparando o dashboard do cliente.</p>
      </div>
    );
  }

  if (error) {
    showError("Erro ao carregar cliente: " + error.message);
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-background text-foreground z-50">
        <h1 className="text-3xl font-bold">Erro ao Carregar Cliente</h1>
        <p className="text-lg text-red-500">Ocorreu um erro: {error.message}</p>
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
        <div className="flex items-center gap-4 min-w-0">
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
          <h1 className="text-3xl font-bold break-words min-w-0">{client.name}</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
          <Dialog open={isClientFormOpen} onOpenChange={setIsClientFormOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setIsClientFormOpen(true)} variant="outline" className="border-blue-500 text-blue-500 hover:bg-blue-500/10 w-full sm:w-auto">
                <Edit className="mr-2 h-4 w-4" /> Editar Cliente
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] w-[90vw] bg-card border border-border rounded-lg shadow-lg max-h-[90vh] overflow-y-auto">
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

      {/* Tabs para Dashboard e Kanban */}
      <Tabs defaultValue="dashboard" className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-2 bg-secondary/50 border border-border rounded-md mb-4">
          <TabsTrigger value="dashboard" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm data-[state=active]:border-primary/50 rounded-md text-sm md:text-base"> {/* Fontes adaptáveis */}
            <LayoutDashboard className="mr-2 h-4 w-4" /> Dashboard
          </TabsTrigger>
          <TabsTrigger value="kanban" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm data-[state=active]:border-primary/50 rounded-md text-sm md:text-base"> {/* Fontes adaptáveis */}
            <KanbanSquare className="mr-2 h-4 w-4" /> Kanban
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="flex-1">
          <Card className="flex-1 flex flex-col bg-card border border-border rounded-xl shadow-sm frosted-glass card-hover-effect">
            <CardHeader>
              <CardTitle className="text-foreground text-lg md:text-xl">Visão Geral do Cliente</CardTitle> {/* Fontes adaptáveis */}
              <CardDescription className="text-muted-foreground text-sm md:text-base"> {/* Fontes adaptáveis */}
                Informações detalhadas e um resumo das atividades do cliente.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 p-4">
              {client.description ? (
                <p className="text-muted-foreground break-words text-sm md:text-base">{client.description}</p> {/* Fontes adaptáveis */}
              ) : (
                <p className="text-muted-foreground text-sm md:text-base">Nenhuma descrição fornecida para este cliente.</p> {/* Fontes adaptáveis */}
              )}
              {/* Adicionar mais informações do dashboard aqui, se necessário */}
              <div className="mt-4 space-y-1"> {/* Espaçamento uniforme */}
                <p className="text-sm md:text-base text-muted-foreground">Tipo de Cliente: <span className="font-semibold text-foreground">{client.type}</span></p> {/* Fontes adaptáveis */}
                <p className="text-sm md:text-base text-muted-foreground">Meta de Entregas Mensais: <span className="font-semibold text-foreground">{client.monthly_delivery_goal}</span></p> {/* Fontes adaptáveis */}
                <p className="text-sm md:text-base text-muted-foreground">Criado em: <span className="font-semibold text-foreground">{format(parseISO(client.created_at), "PPP", { locale: ptBR })}</span></p> {/* Fontes adaptáveis */}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="kanban" className="flex-1 flex flex-col">
          {id && <ClientKanbanPage />}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ClientDetails;