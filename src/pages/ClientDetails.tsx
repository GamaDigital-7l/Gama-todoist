"use client";

import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Edit, Trash2, PlusCircle, LayoutDashboard, KanbanSquare } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Client, Moodboard } from "@/types/client";
import { useSession } from "@/integrations/supabase/auth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import ClientForm from "@/components/ClientForm";
import MoodboardForm from "@/components/MoodboardForm";
import MoodboardCard from "@/components/MoodboardCard";
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

const fetchMoodboardsByClient = async (clientId: string, userId: string): Promise<Moodboard[]> => {
  const { data, error } = await supabase
    .from("moodboards")
    .select("*")
    .eq("client_id", clientId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) {
    throw error;
  }
  return data || [];
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

  const { data: moodboards, isLoading: isLoadingMoodboards, error: moodboardsError, refetch: refetchMoodboards } = useQuery<Moodboard[], Error>({
    queryKey: ["moodboards", id, userId],
    queryFn: () => fetchMoodboardsByClient(id!, userId!),
    enabled: !!id && !!userId,
  });

  const [isClientFormOpen, setIsClientFormOpen] = useState(false);
  const [isMoodboardFormOpen, setIsMoodboardFormOpen] = useState(false);
  const [editingMoodboard, setEditingMoodboard] = useState<Moodboard | undefined>(undefined);

  const handleClientSaved = () => {
    refetch();
    setIsClientFormOpen(false);
  };

  const handleMoodboardSaved = () => {
    refetchMoodboards();
    setIsMoodboardFormOpen(false);
    setEditingMoodboard(undefined);
  };

  const handleEditMoodboard = (moodboard: Moodboard) => {
    setEditingMoodboard(moodboard);
    setIsMoodboardFormOpen(true);
  };

  const handleDeleteMoodboard = async (moodboardId: string) => {
    if (!userId || !id) {
      showError("Usuário não autenticado ou cliente não encontrado.");
      return;
    }
    if (window.confirm("Tem certeza que deseja deletar este moodboard e todas as suas referências visuais?")) {
      try {
        const { error } = await supabase
          .from("moodboards")
          .delete()
          .eq("id", moodboardId)
          .eq("client_id", id)
          .eq("user_id", userId);

        if (error) throw error;
        showSuccess("Moodboard deletado com sucesso!");
        refetchMoodboards();
      } catch (err: any) {
        showError("Erro ao deletar moodboard: " + err.message);
        console.error("Erro ao deletar moodboard:", err);
      }
    }
  };

  const handleDeleteClient = async () => {
    if (!userId || !client?.id) {
      showError("Usuário não autenticado ou cliente não encontrado.");
      return;
    }
    if (window.confirm(`Tem certeza que deseja deletar o cliente "${client.name}" e todos os seus moodboards e referências visuais?`)) {
      try {
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
      <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6 bg-background text-foreground">
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
    <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6 bg-background text-foreground">
      {/* Área Superior: Nome do Cliente, Logo e Botões */}
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
          <Dialog open={isClientFormOpen} onOpenChange={setIsClientFormOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setIsClientFormOpen(true)} variant="outline" className="border-blue-500 text-blue-500 hover:bg-blue-500/10">
                <Edit className="mr-2 h-4 w-4" /> Editar Cliente
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] w-[90vw] bg-card border border-border rounded-lg shadow-lg">
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
          <Button onClick={handleDeleteClient} variant="destructive">
            <Trash2 className="mr-2 h-4 w-4" /> Excluir Cliente
          </Button>
        </div>
      </div>

      {/* Tabs para Dashboard, Moodboards e Kanban */}
      <Tabs defaultValue="dashboard" className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-3 bg-secondary/50 border border-border rounded-md mb-4">
          <TabsTrigger value="dashboard" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm data-[state=active]:border-primary/50 rounded-md">
            <LayoutDashboard className="mr-2 h-4 w-4" /> Dashboard
          </TabsTrigger>
          <TabsTrigger value="moodboards" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm data-[state=active]:border-primary/50 rounded-md">
            <PlusCircle className="mr-2 h-4 w-4" /> Moodboards
          </TabsTrigger>
          <TabsTrigger value="kanban" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm data-[state=active]:border-primary/50 rounded-md">
            <KanbanSquare className="mr-2 h-4 w-4" /> Kanban
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="flex-1">
          <Card className="flex-1 flex flex-col bg-card border border-border rounded-lg shadow-sm">
            <CardHeader>
              <CardTitle className="text-foreground">Visão Geral do Cliente</CardTitle>
              <CardDescription className="text-muted-foreground">
                Informações detalhadas e um resumo das atividades do cliente.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 p-4">
              {client.description ? (
                <p className="text-muted-foreground">{client.description}</p>
              ) : (
                <p className="text-muted-foreground">Nenhuma descrição fornecida para este cliente.</p>
              )}
              {/* Adicionar mais informações do dashboard aqui, se necessário */}
              <div className="mt-4">
                <p className="text-sm text-muted-foreground">Tipo de Cliente: <span className="font-semibold text-foreground">{client.type}</span></p>
                <p className="text-sm text-muted-foreground">Meta de Entregas Mensais: <span className="font-semibold text-foreground">{client.monthly_delivery_goal}</span></p>
                <p className="text-sm text-muted-foreground">Criado em: <span className="font-semibold text-foreground">{format(parseISO(client.created_at), "PPP", { locale: ptBR })}</span></p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="moodboards" className="flex-1 flex flex-col">
          <div className="flex justify-end mb-4">
            <Dialog open={isMoodboardFormOpen} onOpenChange={setIsMoodboardFormOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => setEditingMoodboard(undefined)} className="bg-primary text-primary-foreground hover:bg-primary/90">
                  <PlusCircle className="mr-2 h-4 w-4" /> Novo Moodboard
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px] w-[90vw] bg-card border border-border rounded-lg shadow-lg">
                <DialogHeader>
                  <DialogTitle className="text-foreground">{editingMoodboard ? "Editar Moodboard" : "Criar Novo Moodboard"}</DialogTitle>
                  <DialogDescription className="text-muted-foreground">
                    {editingMoodboard ? "Atualize os detalhes do seu moodboard." : "Crie um novo moodboard para organizar suas referências visuais."}
                  </DialogDescription>
                </DialogHeader>
                <MoodboardForm
                  clientId={id!}
                  initialData={editingMoodboard}
                  onMoodboardSaved={handleMoodboardSaved}
                  onClose={() => setIsMoodboardFormOpen(false)}
                />
              </DialogContent>
            </Dialog>
          </div>

          {isLoadingMoodboards ? (
            <p className="text-center text-muted-foreground">Carregando moodboards...</p>
          ) : moodboardsError ? (
            <p className="text-red-500">Erro ao carregar moodboards: {moodboardsError.message}</p>
          ) : moodboards && moodboards.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {moodboards.map((moodboard) => (
                <MoodboardCard
                  key={moodboard.id}
                  moodboard={moodboard}
                  onEdit={handleEditMoodboard}
                  onDelete={handleDeleteMoodboard}
                />
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">Nenhum moodboard encontrado para este cliente. Crie um novo para começar!</p>
          )}
        </TabsContent>

        <TabsContent value="kanban" className="flex-1 flex flex-col">
          {id && <ClientKanbanPage />}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ClientDetails;