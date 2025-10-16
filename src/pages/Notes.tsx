"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Search, NotebookText, Archive, Trash2, Tag as TagIcon } from "lucide-react";
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
import { Tag } from "@/types/task";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import TagForm from "@/components/TagForm";
import { Badge } from "@/components/ui/badge"; // Importação explícita do Badge

// Definir o tipo para um item de checklist
interface ChecklistItem {
  text: string;
  completed: boolean;
}

export interface Note {
  id: string;
  title?: string | null;
  content: string | ChecklistItem[];
  type: "text" | "checklist";
  color: string;
  pinned: boolean;
  archived: boolean;
  trashed: boolean;
  created_at: string;
  updated_at: string;
  tags?: Tag[];
  reminder_date?: string | null; // Novo campo para data do lembrete
  reminder_time?: string | null; // Novo campo para hora do lembrete
  image_url?: string | null; // Novo campo para URL da imagem
}

const fetchNotes = async (userId: string): Promise<Note[]> => {
  const { data, error } = await supabase
    .from("notes")
    .select(`
      *,
      note_tags(
        tags(id, name, color)
      )
    `)
    .eq("user_id", userId)
    .order("pinned", { ascending: false })
    .order("updated_at", { ascending: false });
  if (error) {
    throw error;
  }
  const mappedData = data?.map((note: any) => ({
    ...note,
    content: note.type === "checklist" ? note.content : String(note.content),
    tags: note.note_tags.map((nt: any) => nt.tags),
  })) || [];
  return mappedData;
};

const fetchTags = async (userId: string): Promise<Tag[]> => {
  const { data, error } = await supabase
    .from("tags")
    .select("id, name, color")
    .eq("user_id", userId)
    .order("name", { ascending: true });
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

  const { data: availableTags, isLoading: isLoadingTags, error: tagsError, refetch: refetchTags } = useQuery<Tag[], Error>({
    queryKey: ["tags", userId],
    queryFn: () => fetchTags(userId!),
    enabled: !!userId,
  });

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | undefined>(undefined);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFilterTagIds, setSelectedFilterTagIds] = useState<string[]>([]);
  const [isTagFilterOpen, setIsTagFilterOpen] = useState(false);
  const [isTagFormOpen, setIsTagFormOpen] = useState(false);

  const handleEditNote = (note: Note) => {
    setEditingNote(note);
    setIsFormOpen(true);
  };

  const handleTagFilterToggle = (tagId: string) => {
    setSelectedFilterTagIds(prev =>
      prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
    );
  };

  const handleCloseTagForm = () => {
    setIsTagFormOpen(false);
    refetchTags();
  };

  const filteredNotes = allNotes?.filter(note => {
    let contentText = "";
    if (note.type === "text" && typeof note.content === 'string') {
      contentText = note.content;
    } else if (note.type === "checklist" && Array.isArray(note.content)) {
      contentText = note.content.map(item => item.text).join(" ");
    }

    const matchesSearch = (note.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           contentText.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesTags = selectedFilterTagIds.length === 0 || 
                        (note.tags && note.tags.some(tag => selectedFilterTagIds.includes(tag.id)));

    return matchesSearch && matchesTags;
  }) || [];

  const activeNotes = filteredNotes.filter(note => !note.archived && !note.trashed);
  const archivedNotes = filteredNotes.filter(note => note.archived && !note.trashed);
  const trashedNotes = filteredNotes.filter(note => note.trashed);

  const pinnedActiveNotes = activeNotes.filter(note => note.pinned);
  const unpinnedActiveNotes = activeNotes.filter(note => !note.pinned);

  if (isLoading || isLoadingTags) {
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

  if (tagsError) {
    showError("Erro ao carregar rótulos: " + tagsError.message);
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <h1 className="text-3xl font-bold text-foreground">Segundo Cérebro (Notas)</h1>
        <p className="text-lg text-red-500">Erro ao carregar rótulos: {tagsError.message}</p>
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

      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-grow">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Buscar notas por título ou conteúdo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 bg-input border-border text-foreground focus-visible:ring-ring"
          />
        </div>
        <Popover open={isTagFilterOpen} onOpenChange={setIsTagFilterOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="w-full sm:w-auto justify-start text-left font-normal bg-input border-border text-foreground hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
            >
              <TagIcon className="h-4 w-4" />
              {selectedFilterTagIds.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {selectedFilterTagIds.map(tagId => {
                    const tag = availableTags?.find(t => t.id === tagId);
                    return tag ? (
                      <Badge key={tag.id} style={{ backgroundColor: tag.color, color: '#FFFFFF' }} className="text-xs">
                        {tag.name}
                      </Badge>
                    ) : null;
                  })}
                </div>
              ) : (
                <span>Filtrar por Rótulo</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[calc(100vw-2rem)] sm:w-[200px] p-0 bg-popover border-border rounded-md shadow-lg">
            <Command className="bg-popover text-popover-foreground">
              <CommandInput placeholder="Buscar rótulo..." className="h-9" />
              <CommandList>
                <CommandEmpty>Nenhum rótulo encontrado.</CommandEmpty>
                <CommandGroup>
                  {availableTags?.map((tag) => (
                    <CommandItem
                      key={tag.id}
                      value={tag.name}
                      onSelect={() => handleTagFilterToggle(tag.id)}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <Badge style={{ backgroundColor: tag.color, color: '#FFFFFF' }} className="text-xs">
                          {tag.name}
                        </Badge>
                      </div>
                      <Check
                        className={cn(
                          "h-4 w-4",
                          selectedFilterTagIds.includes(tag.id) ? "opacity-100" : "opacity-0"
                        )}
                      />
                    </CommandItem>
                  ))}
                </CommandGroup>
                <CommandGroup className="border-t border-border">
                  <Dialog open={isTagFormOpen} onOpenChange={handleCloseTagForm}>
                    <DialogTrigger asChild>
                      <CommandItem onSelect={() => {
                        setIsTagFormOpen(true);
                        setIsTagFilterOpen(false);
                      }} className="text-primary hover:bg-accent hover:text-accent-foreground">
                        <PlusCircle className="mr-2 h-4 w-4" /> Criar Novo Rótulo
                      </CommandItem>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px] w-[90vw] bg-card border border-border rounded-lg shadow-lg">
                      <DialogHeader>
                        <DialogTitle className="text-foreground">Criar Novo Rótulo</DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                          Adicione um novo rótulo para organizar suas notas.
                        </DialogDescription>
                      </DialogHeader>
                      <TagForm onTagSaved={refetchTags} onClose={handleCloseTagForm} />
                    </DialogContent>
                  </Dialog>
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
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