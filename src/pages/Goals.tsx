"use client";

import React from "react";
import { MadeWithDyad } from "@/components/made-with-dyad";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Edit, Trash2, CalendarIcon, CheckCircle2, Hourglass, PlayCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import GoalForm, { GoalFormValues } from "@/components/GoalForm";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useSession } from "@/integrations/supabase/auth";

interface Goal extends GoalFormValues {
  id: string;
  created_at: string;
  updated_at: string;
}

const fetchGoals = async (userId: string): Promise<Goal[]> => {
  const { data, error } = await supabase
    .from("goals")
    .select("*")
    .eq("user_id", userId)
    .order("target_date", { ascending: true, nullsFirst: false });
  if (error) {
    throw error;
  }
  return data || [];
};

const Goals: React.FC = () => {
  const { session } = useSession();
  const userId = session?.user?.id;

  const { data: goals, isLoading, error, refetch } = useQuery<Goal[], Error>({
    queryKey: ["goals", userId],
    queryFn: () => fetchGoals(userId!),
    enabled: !!userId,
  });

  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [editingGoal, setEditingGoal] = React.useState<Goal | undefined>(undefined);

  const handleEditGoal = (goal: Goal) => {
    setEditingGoal(goal);
    setIsFormOpen(true);
  };

  const handleDeleteGoal = async (goalId: string) => {
    if (!userId) {
      showError("Usuário não autenticado.");
      return;
    }
    if (window.confirm("Tem certeza que deseja deletar esta meta?")) {
      try {
        const { error } = await supabase
          .from("goals")
          .delete()
          .eq("id", goalId)
          .eq("user_id", userId);

        if (error) throw error;
        showSuccess("Meta deletada com sucesso!");
        refetch();
      } catch (err: any) {
        showError("Erro ao deletar meta: " + err.message);
        console.error("Erro ao deletar meta:", err);
      }
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Hourglass className="h-4 w-4 text-gray-500" />;
      case "in_progress":
        return <PlayCircle className="h-4 w-4 text-blue-500" />;
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      default:
        return null;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "pending":
        return "Pendente";
      case "in_progress":
        return "Em Progresso";
      case "completed":
        return "Concluída";
      default:
        return "";
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <h1 className="text-3xl font-bold">Suas Metas</h1>
        <p className="text-lg text-muted-foreground">Carregando suas metas...</p>
        <div className="flex-1 flex items-end justify-center">
          <MadeWithDyad />
        </div>
      </div>
    );
  }

  if (error) {
    showError("Erro ao carregar metas: " + error.message);
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <h1 className="text-3xl font-bold">Suas Metas</h1>
        <p className="text-lg text-red-500">Erro ao carregar metas: {error.message}</p>
        <div className="flex-1 flex items-end justify-center">
          <MadeWithDyad />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Suas Metas</h1>
        <Dialog
          open={isFormOpen}
          onOpenChange={(open) => {
            setIsFormOpen(open);
            if (!open) setEditingGoal(undefined); // Limpa a meta de edição ao fechar
          }}
        >
          <DialogTrigger asChild>
            <Button onClick={() => setEditingGoal(undefined)}>
              <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Meta
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{editingGoal ? "Editar Meta" : "Adicionar Nova Meta"}</DialogTitle>
            </DialogHeader>
            <GoalForm
              initialData={editingGoal}
              onGoalSaved={refetch}
              onClose={() => setIsFormOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>
      <p className="text-lg text-muted-foreground">
        Defina e acompanhe suas metas de vida aqui.
      </p>

      {goals && goals.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
          {goals.map((goal) => (
            <Card key={goal.id} className="flex flex-col h-full hover:shadow-lg transition-shadow duration-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xl font-semibold">{goal.title}</CardTitle>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={() => handleEditGoal(goal)}>
                    <Edit className="h-4 w-4 text-blue-500" />
                    <span className="sr-only">Editar Meta</span>
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDeleteGoal(goal.id)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                    <span className="sr-only">Deletar Meta</span>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="flex-grow">
                {goal.description && (
                  <CardDescription className="mb-2">{goal.description}</CardDescription>
                )}
                {goal.target_date && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1 mb-2">
                    <CalendarIcon className="h-4 w-4" /> Data Alvo: {format(parseISO(goal.target_date as string), "PPP", { locale: ptBR })}
                  </p>
                )}
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  {getStatusIcon(goal.status)} Status: {getStatusText(goal.status)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground">Nenhuma meta encontrada. Adicione uma nova meta para começar!</p>
      )}

      <div className="flex-1 flex items-end justify-center mt-8">
        <MadeWithDyad />
      </div>
    </div>
  );
};

export default Goals;