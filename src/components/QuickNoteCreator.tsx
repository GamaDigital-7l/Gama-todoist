"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { PlusCircle, Image as ImageIcon, ListTodo, Palette, Bell } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import NoteForm from "./NoteForm";
import { Note } from "@/pages/Notes"; // Importar a interface Note
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const COLORS = [
  { name: "Amarelo", hex: "#FEEFC3" },
  { name: "Azul", hex: "#D7E3FC" },
  { name: "Verde", hex: "#D4EFD5" },
  { name: "Rosa", hex: "#FADCE4" },
  { name: "Roxo", hex: "#E8D7F7" },
  { name: "Branco", hex: "#FFFFFF" },
];

interface QuickNoteCreatorProps {
  onNoteCreated: () => void;
}

const QuickNoteCreator: React.FC<QuickNoteCreatorProps> = ({ onNoteCreated }) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [initialNoteData, setInitialNoteData] = useState<Partial<Note> | undefined>(undefined);

  const handleOpenFormWithDefaults = (type: "text" | "checklist", color?: string) => {
    setInitialNoteData({
      type,
      color: color || "#FEEFC3",
      content: type === "text" ? "" : [],
      pinned: false,
      archived: false,
      trashed: false,
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
            <Button variant="ghost" size="icon" onClick={() => handleOpenFormWithDefaults("text", "#FFFFFF")} className="text-muted-foreground hover:bg-accent hover:text-accent-foreground">
              <ImageIcon className="h-5 w-5" />
              <span className="sr-only">Adicionar Imagem</span>
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:bg-accent hover:text-accent-foreground">
                  <Palette className="h-5 w-5" />
                  <span className="sr-only">Mudar Cor</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-2 bg-popover border-border rounded-md shadow-lg flex flex-wrap gap-1">
                {COLORS.map((color) => (
                  <Button
                    key={color.hex}
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full border border-gray-300 dark:border-gray-600"
                    style={{ backgroundColor: color.hex }}
                    onClick={() => handleOpenFormWithDefaults("text", color.hex)}
                    title={color.name}
                  />
                ))}
              </PopoverContent>
            </Popover>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[600px] w-[90vw] bg-card border border-border rounded-lg shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-foreground">Criar Nova Nota</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Escreva uma nova nota para o seu segundo cérebro.
            </DialogDescription>
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