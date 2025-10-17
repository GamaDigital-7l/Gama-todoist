"use client";

import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Users, TrendingUp, TrendingDown, CheckCircle2, AlertCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import ClientForm from "@/components/ClientForm";
import ClientCard from "@/components/ClientCard";
import { Client, ClientType } from "@/types/client";
import { useSession } from "@/integrations/supabase/auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "react-router-dom"; // Importar Link para navegação

const fetchClients = async (userId: string, type?: ClientType): Promise<Client[]> => {
  let query = supabase
    .from("clients")
    .select("*")
    .eq("user_id", userId)
    .order("name", { ascending: true });

  if (type) {
    query = query.eq("type", type);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }
  return data || [];
};

const Clients: React.FC = () => {
  const { session } = useSession();
  const userId = session?.user?.id;

  const { data: allClients, isLoading, error, refetch } = useQuery<Client[], Error>({
    queryKey: ["clients", userId],
    queryFn: () => fetchClients(userId!),
    enabled: !!userId,
  });

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<ClientType | "all">("all");

  const handleEditClient = (client: Client) => {
    setEditingClient(client);
    setIsFormOpen(true);
  };

  const handleDeleteClient = async (clientId: string) => {
    if (!userId) {
      showError("Usuário não autenticado.");
      return;
    }
    if (window.confirm("Tem certeza que deseja deletar este cliente e todas as suas referências visuais e tarefas?")) {
      try {
        // Deletar tarefas do cliente
        const { error: deleteTasksError } = await supabase
          .from("client_tasks")
          .delete()
          .eq("client_id", clientId)
          .eq("user_id", userId);
        if (deleteTasksError) console.error("Erro ao deletar tarefas do cliente:", deleteTasksError);

        // Deletar templates de geração de tarefas do cliente
        const { error: deleteTemplatesError } = await supabase
          .from("client_task_generation_templates")
          .delete()
          .eq("client_id", clientId)
          .eq("user_id", userId);
        if (deleteTemplatesError) console.error("Erro ao deletar templates de tarefas do cliente:", deleteTemplatesError);

        // Deletar moodboards do cliente
        const { error: deleteMoodboardsError } = await supabase
          .from("moodboards")
          .delete()
          .eq("client_id", clientId)
          .eq("user_id", userId);
        if (deleteMoodboardsError) console.error("Erro ao deletar moodboards do cliente:", deleteMoodboardsError);

        // Finalmente, deletar o cliente
        const { error } = await supabase
          .from("clients")
          .delete()
          .eq("id", clientId)
          .eq("user_id", userId);

        if (error) throw error;
        showSuccess("Cliente deletado com sucesso!");
        refetch();
      } catch (err: any) {
        showError("Erro ao deletar cliente: " + err.message);
        console.error("Erro ao deletar cliente:", err);
      }
    }
  };

  const filteredClients = activeTab === "all"
    ? allClients
    : allClients?.filter(client => client.type === activeTab);

  // Placeholder para os indicadores do topo
  const totalClients = allClients?.length || 0;
  const fixedClients = allClients?.filter(c => c.type === 'fixed').length || 0;
  const freelaClients = allClients?.filter(c => c.type === 'freela').length || 0;
  const agencyClients = allClients?.filter(c => c.type === 'agency').length || 0;

  // Estes cálculos serão mais complexos e virão em etapas futuras
  const averageProgress = 0; // Placeholder
  const clientsInGreen = 0; // Placeholder
  const clientsInYellow = 0; // Placeholder
  const clientsInRed = 0; // Placeholder
  const mostAdvancedClient = "N/A"; // Placeholder
  const mostDelayedClient = "N/A"; // Placeholder


  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <h1 className="text-3xl font-bold text-foreground">Seus Clientes</h1>
        <p className="text-lg text-muted-foreground">Carregando seus clientes...</p>
      </div>
    );
  }

  if (error) {
    showError("Erro ao carregar clientes: " + error.message);
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <h1 className="text-3xl font-bold text-foreground">Seus Clientes</h1>
        <p className="text-lg text-red-500">Erro ao carregar clientes: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between flex-wrap gap-2">
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
          <Users className="h-7 w-7 text-primary" /> Seus Clientes
        </h1>
        <Dialog
          open={isFormOpen}
          onOpenChange={(open) => {
            setIsFormOpen(open);
            if (!open) setEditingClient(undefined);
          }}
        >
          <DialogTrigger asChild>
            <Button onClick={() => setEditingClient(undefined)} className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90">
              <PlusCircle className="mr-2 h-4 w-4" /> Novo Cliente
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px] w-[90vw] bg-card border border-border rounded-lg shadow-lg">
            <DialogHeader>
              <DialogTitle className="text-foreground">{editingClient ? "Editar Cliente" : "Adicionar Novo Cliente"}</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                {editingClient ? "Atualize os detalhes do seu cliente." : "Adicione um novo cliente para gerenciar suas referências visuais e tarefas."}
              </DialogDescription>
            </DialogHeader>
            <ClientForm
              initialData={editingClient}
              onClientSaved={refetch}
              onClose={() => setIsFormOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>
      <p className="text-lg text-muted-foreground">
        Gerencie seus clientes e acesse seus dashboards de referências visuais e kanban de tarefas.
      </p>

      {/* Indicadores do Topo */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-card border border-border rounded-lg shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total de Clientes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{totalClients}</div>
            <p className="text-xs text-muted-foreground">
              {fixedClients} Fixos, {freelaClients} Freela, {agencyClients} Agência
            </p>
          </CardContent>
        </Card>
        <Card className="bg-card border border-border rounded-lg shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Progresso Médio do Mês</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{averageProgress}%</div>
            <p className="text-xs text-muted-foreground">
              {clientsInGreen} no verde, {clientsInYellow} no amarelo, {clientsInRed} no vermelho
            </p>
          </CardContent>
        </Card>
        <Card className="bg-card border border-border rounded-lg shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Mais Adiantado</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{mostAdvancedClient}</div>
            <p className="text-xs text-muted-foreground">
              (100% concluído)
            </p>
          </CardContent>
        </Card>
        <Card className="bg-card border border-border rounded-lg shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Mais Atrasado</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{mostDelayedClient}</div>
            <p className="text-xs text-muted-foreground">
              (20% concluído)
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="all" className="flex-1 flex flex-col" onValueChange={(value) => setActiveTab(value as ClientType | "all")}>
        <TabsList className="grid w-full grid-cols-4 bg-secondary/50 border border-border rounded-md mb-4">
          <TabsTrigger value="all" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm data-[state=active]:border-primary/50 rounded-md">Todos</TabsTrigger>
          <TabsTrigger value="fixed" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm data-[state=active]:border-primary/50 rounded-md">Fixos</TabsTrigger>
          <TabsTrigger value="freela" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm data-[state=active]:border-primary/50 rounded-md">Freela</TabsTrigger>
          <TabsTrigger value="agency" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm data-[state=active]:border-primary/50 rounded-md">Agência</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="flex-1">
          {filteredClients && filteredClients.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredClients.map((client) => (
                <Link key={client.id} to={`/clients/${client.id}/kanban`}> {/* Link para o Kanban */}
                  <ClientCard
                    client={client}
                    onEdit={handleEditClient}
                    onDelete={handleDeleteClient}
                  />
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">Nenhum cliente encontrado. Adicione um novo para começar!</p>
          )}
        </TabsContent>
        <TabsContent value="fixed" className="flex-1">
          {filteredClients && filteredClients.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredClients.map((client) => (
                <Link key={client.id} to={`/clients/${client.id}/kanban`}>
                  <ClientCard
                    client={client}
                    onEdit={handleEditClient}
                    onDelete={handleDeleteClient}
                  />
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">Nenhum cliente fixo encontrado.</p>
          )}
        </TabsContent>
        <TabsContent value="freela" className="flex-1">
          {filteredClients && filteredClients.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredClients.map((client) => (
                <Link key={client.id} to={`/clients/${client.id}/kanban`}>
                  <ClientCard
                    client={client}
                    onEdit={handleEditClient}
                    onDelete={handleDeleteClient}
                  />
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">Nenhum cliente freela encontrado.</p>
          )}
        </TabsContent>
        <TabsContent value="agency" className="flex-1">
          {filteredClients && filteredClients.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredClients.map((client) => (
                <Link key={client.id} to={`/clients/${client.id}/kanban`}>
                  <ClientCard
                    client={client}
                    onEdit={handleEditClient}
                    onDelete={handleDeleteClient}
                  />
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">Nenhum cliente de agência encontrado.</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Clients;