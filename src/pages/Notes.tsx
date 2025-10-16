"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Edit, Trash2, Search, NotebookText } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useSession } from "@/integrations/supabase/auth";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Note {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

const fetchNotes = async (userId: string): Promise<Note[]> => {
  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) {
    throw error;
  }
  return data || [];
};

interface NoteFormProps {
  initialData?: Note;
  onNoteSaved: () => void;
  onClose: () => void;
}

const NoteForm: React.FC<NoteFormProps> = ({ initialData, onNoteSaved, onClose }) => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const [title, setTitle] = useState(initialData?.title || "");
  const [content, setContent] = useState(initialData?.content || "");
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) {
      showError("Usuário não autenticado.");
      return;
    }
    if (title.trim() === "" && content.trim() === "") {
      showError("A nota não pode estar vazia.");
      return;
    }

    setIsSaving(true);
    try {
      const dataToSave = {
        title: title.trim() === "" ? "Nota sem título" : title,
        content: content,
        updated_at: new Date().toISOString(),
      };

      if (initialData) {
        const { error } = await supabase
          .from("notes")
          .update(dataToSave)
          .eq("id", initialData.id)
          .eq("user_id", userId);
        if (error) throw error;
        showSuccess("Nota atualizada com sucesso!");
      } else {
        const { error } = await supabase
          .from("notes")
          .insert({ ...dataToSave, user_id: userId });
        if (error) throw error;
        showSuccess("Nota adicionada com sucesso!");
      }
      onNoteSaved();
      onClose();
    } catch (err: any) {
      showError("Erro ao salvar nota: " + err.message);
      console.error("Erro ao salvar nota:", err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 bg-card">
      <div>
        <Label htmlFor="note-title" className="text-foreground">Título (Opcional)</Label>
        <Input
          id="note-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Título da sua nota"
          className="w-full bg-input border-border text-foreground focus-visible:ring-ring"
          disabled={isSaving}
        />
      </div>
      <div>
        <Label htmlFor="note-content" className="text-foreground">Conteúdo da Nota</Label>
        <Textarea
          id="note-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Comece a escrever sua nota aqui..."
          className="w-full bg-input border-border text-foreground focus-visible:ring-ring min-h-[150px]"
          disabled={isSaving}
        />
      </div>
      <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={isSaving}>
        {isSaving ? "Salvando..." : (initialData ? "Atualizar Nota" : "Adicionar Nota")}
      </Button>
    </form>
  );
};

const Notes: React.FC = () => {
  const { session } = useSession();
  const userId = session?.user?.id;

  const { data: notes, isLoading, error, refetch } = useQuery<Note[], Error>({
    queryKey: ["notes", userId],
    queryFn: () => fetchNotes(userId!),
    enabled: !!userId,
  });

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | undefined>(undefined);
  const [searchTerm, setSearchTerm] = useState("");

  const handleEditNote = (note: Note) => {
    setEditingNote(note);
    setIsFormOpen(true);
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!userId) {
      showError("Usuário não autenticado.");
      return;
    }
    if (window.confirm("Tem certeza que deseja deletar esta nota?")) {
      try {
        const { error } = await supabase
          .from("notes")
          .delete()
          .eq("id", noteId)
          .eq("user_id", userId);

        if (error) throw error;
        showSuccess("Nota deletada com sucesso!");
        refetch();
      } catch (err: any) {
        showError("Erro ao deletar nota: " + err.message);
        console.error("Erro ao deletar nota:", err);
      }
    }
  };

  const filteredNotes = notes?.filter(note =>
    note.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    note.content.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <h1 className="text-3xl font-bold text-foreground">Segundo Cérebro (Notas)</h1>
        <p className="text-lg text-muted-foreground">Carregando suas notas...</p>
      </div>
    );
  }

  if (error) {
    showError("Erro ao carregar notas: " + error.message);
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <h1 className="text-3xl font-bold text-foreground">Segundo Cérebro (Notas)</h1>
        <p className="text-lg text-red-500">Erro ao carregar notas: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between flex-wrap gap-2">
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
          <NotebookText className="h-7 w-7 text-primary" /> Segundo Cérebro (Notas)
        </h1>
        <Dialog
          open={isFormOpen}
          onOpenChange={(open) => {
            setIsFormOpen(open);
            if (!open) setEditingNote(undefined);
          }}
        >
          <DialogTrigger asChild>
            <Button onClick={() => setEditingNote(undefined)} className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90">
              <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Nota
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] w-[90vw] bg-card border border-border rounded-lg shadow-lg">
            <DialogHeader>
              <DialogTitle className="text-foreground">{editingNote ? "Editar Nota" : "Criar Nova Nota"}</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                {editingNote ? "Atualize o conteúdo da sua nota." : "Escreva uma nova nota para o seu segundo cérebro."}
              </DialogDescription>
            </DialogHeader>
            <NoteForm
              initialData={editingNote}
              onNoteSaved={refetch}
              onClose={() => setIsFormOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>
      <p className="text-lg text-muted-foreground">
        Seu caderno digital para todas as suas ideias, pensamentos e informações importantes.
      </p>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Buscar notas por título ou conteúdo..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-9 bg-input border-border text-foreground focus-visible:ring-ring"
        />
      </div>

      {filteredNotes.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
          {filteredNotes.map((note) => (
            <Card key={note.id} className="flex flex-col h-full bg-card border border-border rounded-lg shadow-sm hover:shadow-lg transition-shadow duration-200">
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <CardTitle className="text-xl font-semibold text-foreground break-words flex-grow pr-2">
                  {note.title}
                </CardTitle>
                <div className="flex items-center gap-2 flex-shrink-0 mt-1 sm:mt-0">
                  <Button variant="ghost" size="icon" onClick={() => handleEditNote(note)} className="text-blue-500 hover:bg-blue-500/10">
                    <Edit className="h-4 w-4" />
                    <span className="sr-only">Editar Nota</span>
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDeleteNote(note.id)} className="text-red-500 hover:bg-red-500/10">
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">Deletar Nota</span>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="flex-grow">
                <CardDescription className="mb-2 text-muted-foreground line-clamp-4 break-words">
                  {note.content}
                </CardDescription>
                <p className="text-xs text-muted-foreground mt-2">
                  Última atualização: {format(parseISO(note.updated_at), "PPP 'às' HH:mm", { locale: ptBR })}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground">Nenhuma nota encontrada. Comece a adicionar suas ideias!</p>
      )}
    </div>
  );
};

export default Notes;