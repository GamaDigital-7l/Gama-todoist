"use client";

import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Edit, Trash2, Scale, CalendarIcon, NotebookText } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import HealthMetricForm, { HealthMetricFormValues } from "@/components/HealthMetricForm";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useSession } from "@/integrations/supabase/auth";

interface HealthMetric extends HealthMetricFormValues {
  id: string;
  created_at: string;
  updated_at: string;
}

const fetchHealthMetrics = async (userId: string): Promise<HealthMetric[]> => {
  const { data, error } = await supabase
    .from("health_metrics")
    .select("*")
    .eq("user_id", userId)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) {
    throw error;
  }
  return data || [];
};

const Health: React.FC = () => {
  const { session } = useSession();
  const userId = session?.user?.id;

  const { data: healthMetrics, isLoading, error, refetch } = useQuery<HealthMetric[], Error>({
    queryKey: ["healthMetrics", userId],
    queryFn: () => fetchHealthMetrics(userId!),
    enabled: !!userId,
  });

  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [editingMetric, setEditingMetric] = React.useState<HealthMetric | undefined>(undefined);

  const handleEditMetric = (metric: HealthMetric) => {
    setEditingMetric(metric);
    setIsFormOpen(true);
  };

  const handleDeleteMetric = async (metricId: string) => {
    if (!userId) {
      showError("Usuário não autenticado.");
      return;
    }
    if (window.confirm("Tem certeza que deseja deletar esta métrica de saúde?")) {
      try {
        const { error } = await supabase
          .from("health_metrics")
          .delete()
          .eq("id", metricId)
          .eq("user_id", userId);

        if (error) throw error;
        showSuccess("Métrica de saúde deletada com sucesso!");
        refetch();
      } catch (err: any) {
        showError("Erro ao deletar métrica de saúde: " + err.message);
        console.error("Erro ao deletar métrica de saúde:", err);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <h1 className="text-3xl font-bold text-foreground">Minha Saúde</h1>
        <p className="text-lg text-muted-foreground">Carregando suas métricas de saúde...</p>
      </div>
    );
  }

  if (error) {
    showError("Erro ao carregar métricas de saúde: " + error.message);
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <h1 className="text-3xl font-bold text-foreground">Minha Saúde</h1>
        <p className="text-lg text-red-500">Erro ao carregar métricas de saúde: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">Minha Saúde</h1>
        <Dialog
          open={isFormOpen}
          onOpenChange={(open) => {
            setIsFormOpen(open);
            if (!open) setEditingMetric(undefined);
          }}
        >
          <DialogTrigger asChild>
            <Button onClick={() => setEditingMetric(undefined)} className="bg-primary text-primary-foreground hover:bg-primary/90">
              <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Métrica
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px] bg-card border border-border rounded-lg shadow-lg">
            <DialogHeader>
              <DialogTitle className="text-foreground">{editingMetric ? "Editar Métrica de Saúde" : "Adicionar Nova Métrica de Saúde"}</DialogTitle>
            </DialogHeader>
            <HealthMetricForm
              initialData={editingMetric}
              onMetricSaved={refetch}
              onClose={() => setIsFormOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>
      <p className="text-lg text-muted-foreground">
        Registre e acompanhe seu peso e outras métricas de saúde.
      </p>

      {healthMetrics && healthMetrics.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
          {healthMetrics.map((metric) => (
            <Card key={metric.id} className="flex flex-col h-full bg-card border border-border rounded-lg shadow-sm hover:shadow-lg transition-shadow duration-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xl font-semibold text-foreground">
                  {metric.weight_kg ? `${metric.weight_kg} kg` : "Métrica de Saúde"}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={() => handleEditMetric(metric)} className="text-blue-500 hover:bg-blue-500/10">
                    <Edit className="h-4 w-4" />
                    <span className="sr-only">Editar Métrica</span>
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDeleteMetric(metric.id)} className="text-red-500 hover:bg-red-500/10">
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">Deletar Métrica</span>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="flex-grow">
                <p className="text-sm text-muted-foreground flex items-center gap-1 mb-1">
                  <CalendarIcon className="h-4 w-4 text-primary" /> Data: {format(parseISO(metric.date as string), "PPP", { locale: ptBR })}
                </p>
                {metric.notes && (
                  <p className="text-sm text-muted-foreground flex items-start gap-1">
                    <NotebookText className="h-4 w-4 text-primary flex-shrink-0 mt-1" /> Notas: {metric.notes}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground">Nenhuma métrica de saúde encontrada. Adicione uma nova para começar a acompanhar seu progresso!</p>
      )}
    </div>
  );
};

export default Health;