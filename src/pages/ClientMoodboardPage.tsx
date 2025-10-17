"use client";

import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showError } from "@/utils/toast";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Edit, LayoutDashboard } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Moodboard } from "@/types/client";
import { useSession } from "@/integrations/supabase/auth";
import VisualReferencesCanvas from "@/components/VisualReferencesCanvas";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import MoodboardForm from "@/components/MoodboardForm";

const fetchMoodboardById = async (moodboardId: string, userId: string): Promise<Moodboard | null> => {
  const { data, error } = await supabase
    .from("moodboards")
    .select("*")
    .eq("id", moodboardId)
    .eq("user_id", userId)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }
  return data || null;
};

const ClientMoodboardPage: React.FC = () => {
  const { clientId, moodboardId } = useParams<{ clientId: string; moodboardId: string }>();
  const navigate = useNavigate();
  const { session } = useSession();
  const userId = session?.user?.id;

  const { data: moodboard, isLoading, error, refetch } = useQuery<Moodboard | null, Error>({
    queryKey: ["moodboard", moodboardId, userId],
    queryFn: () => fetchMoodboardById(moodboardId!, userId!),
    enabled: !!moodboardId && !!userId,
  });

  const [isFormOpen, setIsFormOpen] = React.useState(false);

  const handleMoodboardSaved = () => {
    refetch();
    setIsFormOpen(false);
  };

  if (!clientId || !moodboardId) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6 bg-background text-foreground">
        <h1 className="text-3xl font-bold">Moodboard Não Encontrado</h1>
        <p className="text-lg text-muted-foreground">O ID do cliente ou do moodboard não foi fornecido.</p>
        <Button onClick={() => navigate(`/clients/${clientId}`)} className="w-fit bg-primary text-primary-foreground hover:bg-primary/90">
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para o Cliente
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-background text-foreground z-50">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <h1 className="text-3xl font-bold mt-4">Carregando Moodboard...</h1>
        <p className="text-lg text-muted-foreground">Preparando seu canvas de referências.</p>
      </div>
    );
  }

  if (error) {
    showError("Erro ao carregar moodboard: " + error.message);
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-background text-foreground z-50">
        <h1 className="text-3xl font-bold">Erro ao Carregar Moodboard</h1>
        <p className="text-lg text-red-500">Ocorreu um erro: {error.message}</p>
        <Button onClick={() => navigate(`/clients/${clientId}`)} className="w-fit bg-primary text-primary-foreground hover:bg-primary/90 mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para o Cliente
        </Button>
      </div>
    );
  }

  if (!moodboard) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-background text-foreground z-50">
        <h1 className="text-3xl font-bold">Moodboard Não Encontrado</h1>
        <p className="text-lg text-muted-foreground">O moodboard que você está procurando não existe ou foi removido.</p>
        <Button onClick={() => navigate(`/clients/${clientId}`)} className="w-fit bg-primary text-primary-foreground hover:bg-primary/90 mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para o Cliente
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6 bg-background text-foreground">
      {/* Área Superior: Título do Moodboard e Botões */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between flex-wrap gap-4 mb-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => navigate(`/clients/${clientId}`)} className="border-border text-foreground hover:bg-accent hover:text-accent-foreground">
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Voltar para o Cliente</span>
          </Button>
          <h1 className="text-3xl font-bold break-words">{moodboard.title}</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setIsFormOpen(true)} variant="outline" className="border-blue-500 text-blue-500 hover:bg-blue-500/10">
                <Edit className="mr-2 h-4 w-4" /> Editar Moodboard
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] w-[90vw] bg-card border border-border rounded-lg shadow-lg">
              <DialogHeader>
                <DialogTitle className="text-foreground">Editar Moodboard</DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  Atualize os detalhes do seu moodboard.
                </DialogDescription>
              </DialogHeader>
              <MoodboardForm
                clientId={clientId}
                initialData={moodboard}
                onMoodboardSaved={handleMoodboardSaved}
                onClose={() => setIsFormOpen(false)}
              />
            </DialogContent>
          </Dialog>
          {/* Botão para voltar ao dashboard do cliente, se houver um */}
          <Button onClick={() => navigate(`/clients/${clientId}`)} variant="secondary">
            <LayoutDashboard className="mr-2 h-4 w-4" /> Ver Dashboard do Cliente
          </Button>
        </div>
      </div>

      {moodboard.description && (
        <p className="text-lg text-muted-foreground mb-4">{moodboard.description}</p>
      )}

      {/* Área Principal: Canvas de Referências Visuais */}
      <Card className="flex-1 flex flex-col bg-card border border-border rounded-lg shadow-sm">
        <CardHeader className="border-b border-border">
          <CardTitle className="text-foreground">Canvas de Referências</CardTitle>
          <CardDescription className="text-muted-foreground">
            Um canvas interativo para suas referências visuais. Arraste e solte imagens, cole URLs ou adicione notas de texto.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 p-0">
          {moodboardId && <VisualReferencesCanvas moodboardId={moodboardId} />}
        </CardContent>
      </Card>
    </div>
  );
};

export default ClientMoodboardPage;