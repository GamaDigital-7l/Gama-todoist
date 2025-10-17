"use client";

import React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { Button } from "@/components/ui/button";
import { Pin, PinOff, Archive, ArchiveRestore, Trash2, Edit, Undo2, MoreVertical, Bell } from "lucide-react"; // Removido ImageIcon
import { useSession } from "@/integrations/supabase/auth";
import { Note } from "@/pages/Notes";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import NoteForm from "./NoteForm";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface NoteItemProps {
  note: Note;
  refetchNotes: () => void;
}

const NoteItem: React.FC<NoteItemProps> = ({ note, refetchNotes }) => {
  const { session } = useSession();
  const queryClient = useQueryClient();

  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [editingNote, setEditingNote] = React.useState<Note | undefined>(undefined);

  const updateNoteMutation = useMutation({
    mutationFn: async (updatedFields: Partial<Note>) => {
      if (!session?.user?.id) {
        showError("Usuário não autenticado.");
        return;
      }
      const { error } = await supabase
        .from("notes")
        .update({ ...updatedFields, updated_at: new Date().toISOString() })
        .eq("id", note.id)
        .eq("user_id", session.user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      refetchNotes();
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      showSuccess("Nota atualizada com sucesso!");
    },
    onError: (err: any) => {
      showError("Erro ao atualizar nota: " + err.message);
      console.error("Erro ao atualizar nota:", err);
    },
  });

  const handleDeletePermanently = useMutation({
    mutationFn: async (noteId: string) => {
      if (!session?.user?.id) {
        showError("Usuário não autenticado.");
        return;
      }
      const { error } = await supabase
        .from("notes")
        .delete()
        .eq("id", noteId)
        .eq("user_id", session.user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      refetchNotes();
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      showSuccess("Nota excluída permanentemente!");
    },
    onError: (err: any) => {
      showError("Erro ao excluir nota permanentemente: " + err.message);
      console.error("Erro ao excluir nota permanentemente:", err);
    },
  });

  const handleEditNote = (noteToEdit: Note) => {
    setEditingNote(noteToEdit);
    setIsFormOpen(true);
  };

  const handlePinToggle = () => {
    updateNoteMutation.mutate({ pinned: !note.pinned });
  };

  const handleArchiveToggle = () => {
    updateNoteMutation.mutate({ archived: !note.archived, pinned: false });
  };

  const handleTrashToggle = () => {
    updateNoteMutation.mutate({ trashed: !note.trashed, pinned: false, archived: false });
  };

  const handleRestoreFromTrash = () => {
    updateNoteMutation.mutate({ trashed: false, archived: false, pinned: false });
  };

  const handleChecklistItemToggle = async (index: number, checked: boolean) => {
    if (note.type !== "checklist") return;

    try {
      const currentContent = JSON.parse(note.content);
      if (Array.isArray(currentContent) && currentContent[index]) {
        currentContent[index].completed = checked;
        await updateNoteMutation.mutateAsync({ content: JSON.stringify(currentContent) });
      }
    } catch (err) {
      console.error("Erro ao atualizar item da checklist:", err);
      showError("Erro ao atualizar item da checklist.");
    }
  };

  const renderNoteContent = () => {
    if (note.type === "checklist") {
      try {
        const checklistItems = JSON.parse(note.content);
        if (!Array.isArray(checklistItems)) return <p className="text-sm text-red-500">Conteúdo da checklist inválido.</p>;
        return (
          <ul className="space-y-1 text-sm text-gray-800 dark:text-gray-100">
            {checklistItems.map((item: { text: string; completed: boolean }, index: number) => (
              <li key={index} className="flex items-center gap-2">
                <Checkbox
                  checked={item.completed}
                  onCheckedChange={(checked) => handleChecklistItemToggle(index, checked as boolean)}
                  className="border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                />
                <span className={cn(item.completed ? "line-through text-muted-foreground" : "")}>
                  {item.text}
                </span>
              </li>
            ))}
          </ul>
        );
      } catch (e) {
        console.error("Erro ao parsear conteúdo da checklist:", e);
        return <p className="text-sm text-red-500">Erro ao carregar checklist.</p>;
      }
    }
    return <div className="prose dark:prose-invert max-w-none text-sm text-gray-800 dark:text-gray-100" dangerouslySetInnerHTML={{ __html: note.content }} />;
  };

  return (
    <Card className="relative flex flex-col h-full rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 group bg-card">
      {/* note.image_url removido */}
      <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-200">
        {note.trashed ? (
          <>
            <Button variant="ghost" size="icon" onClick={handleRestoreFromTrash} className="h-7 w-7 text-gray-700 hover:bg-gray-200 dark:text-gray-200 dark:hover:bg-gray-700">
              <Undo2 className="h-4 w-4" />
              <span className="sr-only">Restaurar</span>
            </Button>
            <Button variant="ghost" size="icon" onClick={() => handleDeletePermanently.mutate(note.id)} className="h-7 w-7 text-red-600 hover:bg-red-200 dark:text-red-400 dark:hover:bg-red-800">
              <Trash2 className="h-4 w-4" />
              <span className="sr-only">Excluir Permanentemente</span>
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" size="icon" onClick={handlePinToggle} className="h-7 w-7 text-muted-foreground hover:bg-accent hover:text-accent-foreground">
              {note.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
              <span className="sr-only">{note.pinned ? "Desafixar" : "Fixar"}</span>
            </Button>
            <Button variant="ghost" size="icon" onClick={handleArchiveToggle} className="h-7 w-7 text-muted-foreground hover:bg-accent hover:text-accent-foreground">
              {note.archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
              <span className="sr-only">{note.archived ? "Desarquivar" : "Arquivar"}</span>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:bg-accent hover:text-accent-foreground">
                  <MoreVertical className="h-4 w-4" />
                  <span className="sr-only">Mais Ações</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-popover border-border rounded-md shadow-lg">
                <DropdownMenuItem onClick={() => handleEditNote(note)} className="cursor-pointer">
                  <Edit className="mr-2 h-4 w-4" /> Editar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleTrashToggle} className="text-red-600 cursor-pointer">
                  <Trash2 className="mr-2 h-4 w-4" /> Mover para Lixeira
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>
      <CardHeader className="pb-2" onClick={() => handleEditNote(note)}>
        {note.title && <CardTitle className="text-lg font-semibold break-words">{note.title}</CardTitle>}
      </CardHeader>
      <CardContent className="flex-grow" onClick={() => handleEditNote(note)}>
        {renderNoteContent()}
        {note.tags && note.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {note.tags.map((tag) => (
              <Badge key={tag.id} style={{ backgroundColor: tag.color, color: '#FFFFFF' }} className="text-xs">
                {tag.name}
              </Badge>
            ))}
          </div>
        )}
        {note.reminder_date && note.reminder_time && (
          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-2">
            <Bell className="h-3 w-3 text-blue-500" /> Lembrete: {format(parseISO(note.reminder_date), "PPP", { locale: ptBR })} às {note.reminder_time}
          </p>
        )}
      </CardContent>

      {isFormOpen && (
        <Dialog
          open={isFormOpen}
          onOpenChange={(open) => {
            setIsFormOpen(open);
            if (!open) setEditingNote(undefined);
          }}
        >
          <DialogContent className="sm:max-w-[600px] w-[90vw] bg-card border border-border rounded-lg shadow-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-foreground">
                {editingNote?.title ? "Editar Nota" : "Criar Nova Nota"}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                {editingNote?.title ? "Atualize o conteúdo da sua nota." : "Escreva uma nova nota para o seu segundo cérebro."}
              </DialogDescription>
            </DialogHeader>
            <NoteForm
              initialData={editingNote}
              onNoteSaved={refetchNotes}
              onClose={() => setIsFormOpen(false)}
            />
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
};

export default NoteItem;