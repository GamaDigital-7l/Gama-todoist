"use client";

import React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { Button } from "@/components/ui/button";
import { Edit, Trash2, MapPin, Clock, Link as LinkIcon } from "lucide-react"; // Adicionado LinkIcon
import { useSession } from "@/integrations/supabase/auth";
import { Meeting } from "@/types/meeting";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import MeetingForm, { MeetingFormValues } from "./MeetingForm";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface MeetingItemProps {
  meeting: Meeting;
  refetchMeetings: () => void;
}

const MeetingItem: React.FC<MeetingItemProps> = ({ meeting, refetchMeetings }) => {
  const { session } = useSession();
  const queryClient = useQueryClient();

  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [editingMeeting, setEditingMeeting] = React.useState<(MeetingFormValues & { id: string; google_event_id?: string | null; google_html_link?: string | null }) | undefined>(undefined); // Tipo ajustado

  const handleDeleteMeeting = useMutation({
    mutationFn: async (meetingId: string) => {
      if (!session?.user?.id) {
        showError("Usuário não autenticado.");
        return;
      }
      // TODO: Adicionar lógica para deletar do Google Calendar se google_event_id existir
      const { error } = await supabase
        .from("meetings")
        .delete()
        .eq("id", meetingId)
        .eq("user_id", session.user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Reunião deletada com sucesso!");
      refetchMeetings();
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
      queryClient.invalidateQueries({ queryKey: ["futureMeetings"] });
    },
    onError: (err: any) => {
      showError("Erro ao deletar reunião: " + err.message);
      console.error("Erro ao deletar reunião:", err);
    },
  });

  const handleEditMeeting = (meeting: Meeting) => {
    const editableMeeting: MeetingFormValues & { id: string; google_event_id?: string | null; google_html_link?: string | null } = {
      id: meeting.id,
      title: meeting.title,
      description: meeting.description || undefined,
      date: parseISO(meeting.date),
      start_time: meeting.start_time,
      end_time: meeting.end_time || undefined,
      location: meeting.location || undefined,
      sendToGoogleCalendar: !!meeting.google_event_id, // Preencher o checkbox
      google_event_id: meeting.google_event_id,
      google_html_link: meeting.google_html_link,
    };
    setEditingMeeting(editableMeeting);
    setIsFormOpen(true);
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 border border-border rounded-xl bg-background shadow-sm frosted-glass card-hover-effect">
      <div className="flex items-center gap-3 flex-grow min-w-0">
        <div className="grid gap-1.5 flex-grow min-w-0">
          <label className="text-sm font-medium leading-none text-foreground break-words">
            {meeting.title}
          </label>
          {meeting.description && (
            <p className="text-sm text-muted-foreground break-words">{meeting.description}</p>
          )}
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3 flex-shrink-0" /> {meeting.start_time} {meeting.end_time ? `- ${meeting.end_time}` : ''}
          </p>
          {meeting.location && (
            <p className="text-xs text-muted-foreground flex items-center gap-1 break-words">
              <MapPin className="h-3 w-3 flex-shrink-0" /> {meeting.location}
            </p>
          )}
          {meeting.google_html_link && (
            <a href={meeting.google_html_link} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline flex items-center gap-1 mt-1">
              Ver no Google Calendar <LinkIcon className="h-3 w-3 flex-shrink-0" />
            </a>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 mt-2 sm:mt-0 flex-shrink-0">
        <Button variant="ghost" size="icon" onClick={() => handleEditMeeting(meeting)} className="text-blue-500 hover:bg-blue-500/10">
          <Edit className="h-4 w-4" />
          <span className="sr-only">Editar Reunião</span>
        </Button>
        <Button variant="ghost" size="icon" onClick={() => handleDeleteMeeting.mutate(meeting.id)} className="text-red-500 hover:bg-red-500/10">
          <Trash2 className="h-4 w-4" />
          <span className="sr-only">Deletar Reunião</span>
        </Button>
      </div>

      {isFormOpen && (
        <Dialog
          open={isFormOpen}
          onOpenChange={(open) => {
            setIsFormOpen(open);
            if (!open) setEditingMeeting(undefined);
          }}
        >
          <DialogContent className="sm:max-w-[425px] w-[90vw] bg-card border border-border rounded-lg shadow-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-foreground">{editingMeeting ? "Editar Reunião" : "Adicionar Nova Reunião"}</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                {editingMeeting ? "Atualize os detalhes da sua reunião." : "Crie uma nova reunião para o seu dia."}
              </DialogDescription>
            </DialogHeader>
            <MeetingForm
              initialData={editingMeeting}
              onMeetingSaved={refetchMeetings}
              onClose={() => setIsFormOpen(false)}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default MeetingItem;