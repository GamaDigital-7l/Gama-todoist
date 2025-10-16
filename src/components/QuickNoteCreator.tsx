"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { PlusCircle, Image as ImageIcon, ListTodo } from "lucide-react"; // Removido Palette
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import NoteForm from "./NoteForm";
import { Note } from "@/pages/Notes"; // Importar a interface Note
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface QuickNoteCreatorProps {
  onNoteCreated: () => void;
}

const QuickNoteCreator: React.FC<QuickNoteCreatorProps> = ({ onNoteCreated }) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [initialNoteData, setInitialNoteData] = useState<Partial<Note> | undefined>(undefined);

  const handleOpenFormWithDefaults = (type: "text" | "checklist", withImagePicker?: boolean) => { // Removido 'color' do parâmetro
    setInitialNoteData({
      type,
      color: "#FFFFFF", // Cor padrão branca
      content: type === "text" ? "" : "[]", // Conteúdo inicial como string JSON para checklist
      pinned: false,
      archived: false,
      trashed: false,
      // Se withImagePicker for true, o NoteForm pode abrir o seletor de arquivos automaticamente
      // ou apenas mostrar o campo de upload de imagem.
    });
    setIsFormOpen(true);
  };

  const handleNoteSaved = () => {
    onNoteCreated();
    setIsFormOpen(false);
    setInitialNoteData(undefined);
  };

  return (
    <div className="w-full flex justify-center mb-6">
      <Card className="w-full max-w-2xl bg-card border border-border rounded-lg shadow-md">
        <CardContent className="p-3 flex items-center gap-2">
          <Input
            placeholder="Criar uma nota..."
            className="flex-grow bg-input border-none text-foreground focus-visible:ring-0"
            onClick={() => handleOpenFormWithDefaults("text")}
            readOnly // Impede a digitação direta aqui, forçando a abertura do formulário
          />
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => handleOpenFormWithDefaults("checklist")} className="text-muted-foreground hover:bg-accent hover:text-accent-foreground">
              <ListTodo className="h-5 w-5" />
              <span className="sr-only">Nova Checklist</span>
            </Button>
            <Button variant="ghost" size="icon" onClick={() => handleOpenFormWithDefaults("text", true)} className="text-muted-foreground hover:bg-accent hover:text-accent-foreground"> {/* Removido 'undefined' para color */}
              <ImageIcon className="h-5 w-5" />
              <span className="sr-only">Adicionar Imagem</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[600px] w-[90vw] bg-card border border-border rounded-lg shadow-lg">
          <DialogHeader>
            {/* Título e descrição do Dialog podem ser mais genéricos ou removidos, pois o NoteForm terá seu próprio título */}
            {/* <DialogTitle className="text-foreground">Criar Nova Nota</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Escreva uma nova nota para o seu segundo cérebro.
            </DialogDescription> */}
          </DialogHeader>
          <NoteForm
            initialData={initialNoteData as Note} // Passa os dados iniciais
            onNoteSaved={handleNoteSaved}
            onClose={() => setIsFormOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default QuickNoteCreator;