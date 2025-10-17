"use client";

import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Edit, Trash2, Image as ImageIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Client } from "@/types/client";
import { useSession } from "@/integrations/supabase/auth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import ClientForm from "@/components/ClientForm";
import VisualReferencesCanvas from "@/components/VisualReferencesCanvas";

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

  const [isFormOpen, setIsFormOpen] = useState(false);

  const handleClientSaved = () => {
    refetch();
    setIsFormOpen(false);
  };

  const handleDeleteClient = async () => {
    if (!userId || !client?.id) {
      showError("Usuário não autenticado ou cliente não encontrado.");
      return;
    }
    if (window.confirm(`Tem certeza que deseja deletar o cliente "${client.name}" e todas as suas referências visuais?`)) {
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
          <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setIsFormOpen(true)} variant="outline" className="border-blue-500 text-blue-500 hover:bg-blue-500/10">
                <Edit className="mr-2 h-4 w-4" /> Editar
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
                onClose={() => setIsFormOpen(false)}
              />
            </DialogContent>
          </Dialog>
          <Button onClick={handleDeleteClient} variant="destructive">
            <Trash2 className="mr-2 h-4 w-4" /> Excluir
          </Button>
        </div>
      </div>

      {/* Área Principal: Canvas de Referências Visuais */}
      <Card className="flex-1 flex flex-col bg-card border border-border rounded-lg shadow-sm">
        <CardHeader className="border-b border-border">
          <CardTitle className="text-foreground flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-primary" /> Referências Visuais
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Um canvas interativo para suas referências visuais. Arraste e solte imagens, cole URLs ou adicione notas de texto.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 p-0">
          {id && <VisualReferencesCanvas clientId={id} />}
        </CardContent>
      </Card>
    </div>
  );
};

export default ClientDetails;