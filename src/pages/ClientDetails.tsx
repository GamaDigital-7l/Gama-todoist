"use client";

import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Edit, Trash2, Mail, Phone, Info, CalendarIcon, PlusCircle, LayoutDashboard, ListTodo, Settings as SettingsIcon } from "lucide-react";
import { useSession } from "@/integrations/supabase/auth";
import { Client } from "@/types/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import ClientForm from "@/components/ClientForm";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ClientKanbanPage from "./ClientKanbanPage";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale"; // Importação adicionada
import ClientTaskTemplateManagement from "../components/client/ClientTaskTemplateManagement.tsx"; // Alterado para caminho relativo
import { DIALOG_CONTENT_CLASSNAMES } from "@/lib/constants";

const fetchClientById = async (clientId: string): Promise<Client | null> => {
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("id", clientId)
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
    queryKey: ["client", id],
    queryFn: () => fetchClientById(id!),
    enabled: !!id,
  });

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const handleClientSaved = () => {
    refetch();
    setIsFormOpen(false);
  };

  const handleDeleteClient = async () => {
    if (!userId || !client?.id) {
      showError("Usuário não autenticado ou cliente não encontrado.");
      return;
    }
    try {
      const { error } = await supabase
        .from("clients")
        .delete()
        .eq("id", client.id)
        .eq("user_id", userId);

      if (error) throw error;
      showSuccess("Cliente deletado com sucesso!");
      navigate("/clients");
    } catch (err: any) {
      showError("Erro ao deletar cliente: " + err.message);
      console.error("Erro ao deletar cliente:", err);
    } finally {
      setIsDeleteDialogOpen(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 md:px-10 lg:p-6 bg-background text-foreground">
        <h1 className="text-3xl font-bold">Detalhes do Cliente</h1>
        <p className="text-lg text-muted-foreground">Carregando detalhes do cliente...</p>
      </div>
    );
  }

  if (error) {
    showError("Erro ao carregar cliente: " + error.message);
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 md:px-10 lg:p-6 bg-background text-foreground">
        <h1 className="text-3xl font-bold">Erro ao Carregar Cliente</h1>
        <p className="text-lg text-red-500">Ocorreu um erro: {error.message}</p>
        <Button onClick={() => navigate("/clients")} className="w-fit bg-primary text-primary-foreground hover:bg-primary/90">
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para Clientes
        </Button>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 md:px-10 lg:p-6 bg-background text-foreground">
        <h1 className="text-3xl font-bold">Cliente Não Encontrado</h1>
        <p className="text-lg text-muted-foreground">O cliente com o ID "{id}" não foi encontrado.</p>
        <Button onClick={() => navigate("/clients")} className="w-fit bg-primary text-primary-foreground hover:bg-primary/90">
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para Clientes
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:px-10 lg:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4 min-w-0">
          <Button variant="outline" size="icon" onClick={() => navigate("/clients")} className="border-border text-foreground hover:bg-accent hover:text-accent-foreground flex-shrink-0">
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Voltar para Clientes</span>
          </Button>
          {client.logo_url && (
            <img src={client.logo_url} alt={`${client.name} Logo`} className="h-12 w-12 object-contain rounded-md flex-shrink-0" />
          )}
          <h1 className="text-3xl font-bold text-foreground truncate flex-1 min-w-0">{client.name}</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end w-full sm:w-auto">
          <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full sm:w-auto border-primary text-primary hover:bg-primary/10">
                <Edit className="mr-2 h-4 w-4" /> Editar Cliente
              </Button>
            </DialogTrigger>
            <DialogContent className={DIALOG_CONTENT_CLASSNAMES}>
              <DialogHeader>
                <DialogTitle className="text-foreground">Editar Cliente</DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  Atualize as informações do cliente.
                </DialogDescription>
              </DialogHeader>
              <ClientForm
                initialData={client}
                onClientSaved={handleClientSaved}
                onClose={() => setIsFormOpen(false)}
              />
            </DialogContent>
          </Dialog>

          <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="destructive" className="w-full sm:w-auto">
                <Trash2 className="mr-2 h-4 w-4" /> Deletar Cliente
              </Button>
            </DialogTrigger>
            <DialogContent className={DIALOG_CONTENT_CLASSNAMES}>
              <DialogHeader>
                <DialogTitle className="text-foreground">Confirmar Exclusão</DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  Tem certeza que deseja deletar o cliente "{client.name}"? Esta ação não pode ser desfeita.
                </DialogDescription>
              </DialogHeader>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancelar</Button>
                <Button variant="destructive" onClick={handleDeleteClient}>Deletar</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="kanban" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-muted text-muted-foreground h-10">
          <TabsTrigger value="kanban" className="flex items-center gap-2">
            <LayoutDashboard className="h-4 w-4" /> Kanban
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-2">
            <ListTodo className="h-4 w-4" /> Templates
          </TabsTrigger>
          <TabsTrigger value="info" className="flex items-center gap-2">
            <Info className="h-4 w-4" /> Informações
          </TabsTrigger>
        </TabsList>
        <TabsContent value="kanban" className="mt-4">
          <ClientKanbanPage client={client} />
        </TabsContent>
        <TabsContent value="templates" className="mt-4">
          <ClientTaskTemplateManagement client={client} />
        </TabsContent>
        <TabsContent value="info" className="mt-4">
          <Card className="bg-card border border-border rounded-xl shadow-sm frosted-glass card-hover-effect">
            <CardHeader>
              <CardTitle className="text-foreground">Informações do Cliente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {client.contact_email && (
                <p className="text-sm md:text-base text-muted-foreground flex items-center gap-1">
                  <Mail className="h-4 w-4 text-primary flex-shrink-0" /> E-mail: <span className="font-semibold text-foreground">{client.contact_email}</span>
                </p>
              )}
              {client.contact_phone && (
                <p className="text-sm md:text-base text-muted-foreground flex items-center gap-1">
                  <Phone className="h-4 w-4 text-primary flex-shrink-0" /> Telefone: <span className="font-semibold text-foreground">{client.contact_phone}</span>
                </p>
              )}
              {client.description && (
                <p className="text-sm md:text-base text-muted-foreground flex items-start gap-1">
                  <Info className="h-4 w-4 text-primary flex-shrink-0 mt-1" /> Descrição: <span className="font-semibold text-foreground break-words">{client.description}</span>
                </p>
              )}
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-sm md:text-base text-muted-foreground">Meta de Entregas Mensais: <span className="font-semibold text-foreground">{client.monthly_delivery_goal || "Não definida"}</span></p>
                <p className="text-sm md:text-base text-muted-foreground">Criado em: <span className="font-semibold text-foreground">{format(parseISO(client.created_at), "PPP", { locale: ptBR })}</span></p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ClientDetails;