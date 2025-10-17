"use client";

import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import ClientForm from "@/components/ClientForm";
import ClientCard from "@/components/ClientCard";
import { Client } from "@/types/client";
import { useSession } from "@/integrations/supabase/auth";

const fetchClients = async (userId: string): Promise<Client[]> => {
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("user_id", userId)
    .order("name", { ascending: true });
  if (error) {
    throw error;
  }
  return data || [];
};

const Clients: React.FC = () => {
  const { session } = useSession();
  const userId = session?.user?.id;

  const { data: clients, isLoading, error, refetch } = useQuery<Client[], Error>({
    queryKey: ["clients", userId],
    queryFn: () => fetchClients(userId!),
    enabled: !!userId,
  });

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | undefined>(undefined);

  const handleEditClient = (client: Client) => {
    setEditingClient(client);
    setIsFormOpen(true);
  };

  const handleDeleteClient = async (clientId: string) => {
    if (!userId) {
      showError("Usuário não autenticado.");
      return;
    }
    if (window.confirm("Tem certeza que deseja deletar este cliente e todas as suas referências visuais?")) {
      try {
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
                {editingClient ? "Atualize os detalhes do seu cliente." : "Adicione um novo cliente para gerenciar suas referências visuais."}
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
        Gerencie seus clientes e acesse seus dashboards de referências visuais.
      </p>

      {clients && clients.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {clients.map((client) => (
            <ClientCard
              key={client.id}
              client={client}
              onEdit={handleEditClient}
              onDelete={handleDeleteClient}
            />
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground">Nenhum cliente encontrado. Adicione um novo para começar!</p>
      )}
    </div>
  );
};

export default Clients;