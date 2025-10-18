"use client";

import React, { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { Client, ClientTaskGenerationTemplate } from "@/types/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import ClientTaskGenerationTemplateForm from "./ClientTaskGenerationTemplateForm";
import ClientTaskGenerationTemplateItem from "./ClientTaskGenerationTemplateItem";
import { useSession } from "@/integrations/supabase/auth";
import { DIALOG_CONTENT_CLASSNAMES } from "@/lib/constants";

interface ClientTaskTemplateManagementProps {
  client: Client;
}

const fetchClientTaskTemplates = async (clientId: string, userId: string): Promise<ClientTaskGenerationTemplate[]> => {
  const { data, error } = await supabase
    .from("client_task_generation_templates")
    .select(`
      id, template_name, delivery_count, generation_pattern, is_active, default_due_days, is_standard_task, created_at, updated_at
    `)
    .eq("client_id", clientId)
    .eq("user_id", userId)
    .order("template_name", { ascending: true });

  if (error) {
    throw error;
  }
  return data || [];
};

const ClientTaskTemplateManagement: React.FC<ClientTaskTemplateManagementProps> = ({ client }) => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ClientTaskGenerationTemplate | undefined>(undefined);

  const { data: templates, isLoading, error, refetch } = useQuery<ClientTaskGenerationTemplate[], Error>({
    queryKey: ["clientTaskTemplates", client.id, userId],
    queryFn: () => fetchClientTaskTemplates(client.id, userId!),
    enabled: !!userId && !!client.id,
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      if (!userId) {
        throw new Error("Usuário não autenticado.");
      }
      const { error } = await supabase
        .from("client_task_generation_templates")
        .delete()
        .eq("id", templateId)
        .eq("client_id", client.id)
        .eq("user_id", userId);

      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Template de geração deletado com sucesso!");
      refetch();
      queryClient.invalidateQueries({ queryKey: ["clientTaskTemplates", client.id, userId] });
    },
    onError: (err: any) => {
      showError("Erro ao deletar template de geração: " + err.message);
      console.error("Erro ao deletar template de geração:", err);
    },
  });

  const handleTemplateSaved = () => {
    refetch();
    setIsFormOpen(false);
    setEditingTemplate(undefined);
  };

  const handleEditTemplate = (template: ClientTaskGenerationTemplate) => {
    setEditingTemplate(template);
    setIsFormOpen(true);
  };

  const handleDeleteTemplate = (templateId: string) => {
    if (window.confirm("Tem certeza que deseja deletar este template de geração?")) {
      deleteTemplateMutation.mutate(templateId);
    }
  };

  if (isLoading) {
    return (
      <Card className="w-full bg-card border border-border rounded-xl shadow-sm frosted-glass card-hover-effect">
        <CardHeader>
          <CardTitle className="text-foreground">Templates de Geração de Tarefas</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Carregando templates...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full bg-card border border-border rounded-xl shadow-sm frosted-glass card-hover-effect">
        <CardHeader>
          <CardTitle className="text-foreground">Templates de Geração de Tarefas</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-500">Erro ao carregar templates: {error.message}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between flex-wrap gap-2">
        <h2 className="text-2xl font-bold text-foreground">Templates de Geração de Tarefas</h2>
        <Dialog
          open={isFormOpen}
          onOpenChange={(open) => {
            setIsFormOpen(open);
            if (!open) setEditingTemplate(undefined);
          }}
        >
          <DialogTrigger asChild>
            <Button onClick={() => setEditingTemplate(undefined)} className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90">
              <PlusCircle className="mr-2 h-4 w-4" /> Novo Template
            </Button>
          </DialogTrigger>
          <DialogContent className={DIALOG_CONTENT_CLASSNAMES}>
            <DialogHeader>
              <DialogTitle className="text-foreground">
                {editingTemplate ? "Editar Template de Geração" : "Adicionar Novo Template de Geração"}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                {editingTemplate ? "Atualize os detalhes do seu template." : "Crie um novo template para automatizar a geração de tarefas."}
              </DialogDescription>
            </DialogHeader>
            <ClientTaskGenerationTemplateForm
              clientId={client.id}
              initialData={editingTemplate}
              onTemplateSaved={handleTemplateSaved}
              onClose={() => setIsFormOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {templates && templates.length > 0 ? (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
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
    </div>
  );
};

export default ClientTaskTemplateManagement;