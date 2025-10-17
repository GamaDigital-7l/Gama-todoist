"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { PlusCircle, ListTodo } from "lucide-react"; // Removido ImageIcon
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import NoteForm from "./NoteForm";
import { Note } from "@/pages/Notes";
import { showError } from "@/utils/toast"; // Importar showError

interface QuickNoteCreatorProps {
  onNoteCreated: () => void;
  userId: string | undefined; // Adicionado userId
}

const QuickNoteCreator: React.FC<QuickNoteCreatorProps> = ({ onNoteCreated, userId }) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [initialNoteData, setInitialNoteData] = useState<Partial<Note> | undefined>(undefined);

  // console.log("QuickNoteCreator.tsx userId:", userId); // Log de depuração removido

  const handleOpenFormWithDefaults = (type: "text" | "checklist") => {
    if (!userId) {
      showError("Usuário não autenticado. Faça login para criar notas.");
      return;
    }
    setInitialNoteData({
      type,
      color: "#FFFFFF", // Cor padrão branca
      content: type === "text" ? "" : "[]",
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
            readOnly
            disabled={!userId} // Desabilitar se não houver userId
          />
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => handleOpenFormWithDefaults("checklist")} className="text-muted-foreground hover:bg-accent hover:text-accent-foreground" disabled={!userId}>
              <ListTodo className="h-5 w-5" />
              <span className="sr-only">Nova Checklist</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[600px] w-[90vw] bg-card border border-border rounded-lg shadow-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {initialNoteData?.title ? "Editar Nota" : "Criar Nova Nota"}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {initialNoteData?.title ? "Atualize o conteúdo da sua nota." : "Escreva uma nova nota para o seu segundo cérebro."}
            </DialogDescription>
          </DialogHeader>
          <NoteForm
            initialData={initialNoteData as Note}
            onNoteSaved={handleNoteSaved}
            onClose={() => setIsFormOpen(false)}
            userId={userId} // Passando userId
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default QuickNoteCreator;