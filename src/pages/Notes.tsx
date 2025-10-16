"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Search, NotebookText, Archive, Trash2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showError } from "@/utils/toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useSession } from "@/integrations/supabase/auth";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import NoteForm from "@/components/NoteForm";
import NoteItem from "@/components/NoteItem";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export interface Note {
  id: string;
  title?: string | null;
  content: string;
  type: "text" | "checklist" | "image" | "drawing" | "link" | "audio";
  color: string;
  pinned: boolean;
  archived: boolean;
  trashed: boolean;
  created_at: string;
  updated_at: string;
}

const fetchNotes = async (userId: string): Promise<Note[]> => {
  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .eq("user_id", userId)
    .order("pinned", { ascending: false }) // Pinned notes first
    .order("updated_at", { ascending: false });
  if (error) {
    throw error;
  }
  return data || [];
};

const Notes: React.FC = () => {
  const { session } = useSession();
  const userId = session?.user?.id;

  const { data: allNotes, isLoading, error, refetch } = useQuery<Note[], Error>({
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

  const filteredNotes = allNotes?.filter(note =>
    (note.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    note.content.toLowerCase().includes(searchTerm.toLowerCase()))
  ) || [];

  const activeNotes = filteredNotes.filter(note => !note.archived && !note.trashed);
  const archivedNotes = filteredNotes.filter(note => note.archived && !note.trashed);
  const trashedNotes = filteredNotes.filter(note => note.trashed);

  const pinnedActiveNotes = activeNotes.filter(note => note.pinned);
  const unpinnedActiveNotes = activeNotes.filter(note => !note.pinned);

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

      <Tabs defaultValue="active" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-secondary/50 border border-border rounded-md">
          <TabsTrigger value="active" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm data-[state=active]:border-primary/50 rounded-md">Notas Ativas</TabsTrigger>
          <TabsTrigger value="archived" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm data-[state=active]:border-primary/50 rounded-md">Arquivo</TabsTrigger>
          <TabsTrigger value="trash" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm data-[state=active]:border-primary/50 rounded-md">Lixeira</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-4">
          {pinnedActiveNotes.length > 0 && (
            <>
              <h2 className="text-xl font-bold text-foreground mb-3">Fixadas</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
                {pinnedActiveNotes.map((note) => (
                  <NoteItem key={note.id} note={note} refetchNotes={refetch} />
                ))}
              </div>
            </>
          )}

          <h2 className="text-xl font-bold text-foreground mb-3">Outras Notas</h2>
          {unpinnedActiveNotes.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {unpinnedActiveNotes.map((note) => (
                <NoteItem key={note.id} note={note} refetchNotes={refetch} />
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">Nenhuma nota ativa encontrada. Adicione uma nova nota!</p>
          )}
        </TabsContent>

        <TabsContent value="archived" className="mt-4">
          <h2 className="text-xl font-bold text-foreground mb-3">Notas Arquivadas</h2>
          {archivedNotes.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {archivedNotes.map((note) => (
                <NoteItem key={note.id} note={note} refetchNotes={refetch} />
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">Nenhuma nota arquivada encontrada.</p>
          )}
        </TabsContent>

        <TabsContent value="trash" className="mt-4">
          <h2 className="text-xl font-bold text-foreground mb-3">Notas na Lixeira</h2>
          {trashedNotes.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {trashedNotes.map((note) => (
                <NoteItem key={note.id} note={note} refetchNotes={refetch} />
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">A lixeira está vazia.</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Notes;