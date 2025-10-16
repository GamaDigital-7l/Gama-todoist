"use client";

import React, { useState } from "react";
import { CalendarDays, PlusCircle, Briefcase } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { format, isSameDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/integrations/supabase/auth";
import { showError } from "@/utils/toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import MeetingForm from "@/components/MeetingForm";
import MeetingItem from "@/components/MeetingItem";
import { Meeting } from "@/types/meeting";

const fetchMeetingsByDate = async (userId: string, date: Date): Promise<Meeting[]> => {
  const formattedDate = format(date, "yyyy-MM-dd");
  const { data, error } = await supabase
    .from("meetings")
    .select("*")
    .eq("user_id", userId)
    .eq("date", formattedDate)
    .order("start_time", { ascending: true });
  if (error) {
    throw error;
  }
  return data || [];
};

const DailyPlanner: React.FC = () => {
  const { session } = useSession();
  const userId = session?.user?.id;

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [isMeetingFormOpen, setIsMeetingFormOpen] = useState(false);

  const { data: meetings, isLoading, error, refetch } = useQuery<Meeting[], Error>({
    queryKey: ["meetings", userId, selectedDate?.toISOString()],
    queryFn: () => fetchMeetingsByDate(userId!, selectedDate!),
    enabled: !!userId && !!selectedDate,
  });

  if (error) {
    showError("Erro ao carregar reuniões: " + error.message);
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6 bg-background text-foreground">
      <h1 className="text-3xl font-bold flex items-center gap-2">
        <CalendarDays className="h-7 w-7 text-primary" /> Planejador Diário
      </h1>
      <p className="text-lg text-muted-foreground">
        Organize seu dia, visualize tarefas e eventos do calendário.
      </p>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="bg-card border border-border rounded-lg shadow-sm col-span-1 md:col-span-1 lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-foreground">Selecionar Data</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              initialFocus
              locale={ptBR}
              className="rounded-md border bg-popover text-popover-foreground"
            />
          </CardContent>
        </Card>

        <Card className="flex flex-col bg-card border border-border rounded-lg shadow-sm col-span-1 md:col-span-1 lg:col-span-2">
          <CardHeader className="border-b border-border flex flex-row items-center justify-between">
            <CardTitle className="text-foreground flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-primary" /> Reuniões para {selectedDate ? format(selectedDate, "PPP", { locale: ptBR }) : "Nenhuma Data Selecionada"}
            </CardTitle>
            <Dialog open={isMeetingFormOpen} onOpenChange={setIsMeetingFormOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
                  <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Reunião
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px] w-[90vw] bg-card border border-border rounded-lg shadow-lg">
                <DialogHeader>
                  <DialogTitle className="text-foreground">Adicionar Nova Reunião</DialogTitle>
                  <DialogDescription className="text-muted-foreground">
                    Crie uma nova reunião para a data selecionada.
                  </DialogDescription>
                </DialogHeader>
                <MeetingForm
                  initialData={selectedDate ? { date: format(selectedDate, "yyyy-MM-dd"), title: "", start_time: "" } as Meeting : undefined}
                  onMeetingSaved={refetch}
                  onClose={() => setIsMeetingFormOpen(false)}
                />
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent className="flex-grow p-4 overflow-y-auto space-y-4">
            {isLoading ? (
              <p className="text-center text-muted-foreground">Carregando reuniões...</p>
            ) : meetings && meetings.length > 0 ? (
              <div className="space-y-3">
                {meetings.map((meeting) => (
                  <MeetingItem key={meeting.id} meeting={meeting} refetchMeetings={refetch} />
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground">Nenhuma reunião agendada para esta data.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Futuramente, aqui serão listados eventos do Google Calendar e tarefas */}
      <Card className="flex flex-col flex-grow bg-card border border-border rounded-lg shadow-sm">
        <CardHeader className="border-b border-border">
          <CardTitle className="text-foreground">Tarefas e Outros Eventos</CardTitle>
        </CardHeader>
        <CardContent className="flex-grow p-4 overflow-y-auto space-y-4">
          <p className="text-center text-muted-foreground">
            Tarefas e eventos do calendário virão aqui.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default DailyPlanner;