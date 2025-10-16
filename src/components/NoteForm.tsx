"use client";

import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { useSession } from "@/integrations/supabase/auth";
import { Note } from "@/pages/Notes";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Palette, PlusCircle, XCircle } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import TagSelector from "./TagSelector"; // Importar TagSelector

const COLORS = [
  { name: "Amarelo", hex: "#FEEFC3" },
  { name: "Azul", hex: "#D7E3FC" },
  { name: "Verde", hex: "#D4EFD5" },
  { name: "Rosa", hex: "#FADCE4" },
  { name: "Roxo", hex: "#E8D7F7" },
  { name: "Branco", hex: "#FFFFFF" },
];

// Definir o esquema para um item de checklist
const checklistItemSchema = z.object({
  text: z.string().min(1, "O item da checklist não pode ser vazio."),
  completed: z.boolean().default(false),
});

const noteSchema = z.object({
  title: z.string().optional(),
  content: z.union([z.string().min(1, "O conteúdo da nota é obrigatório."), z.array(checklistItemSchema).min(1, "A checklist deve ter pelo menos um item.")]),
  color: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Cor inválida. Use formato hexadecimal (ex: #RRGGBB).").default("#FEEFC3"),
  type: z.enum(["text", "checklist"]).default("text"), // Simplificado para text e checklist
  selected_tag_ids: z.array(z.string()).optional(), // Adicionado para tags
});

export type NoteFormValues = z.infer<typeof noteSchema>;

interface NoteFormProps {
  initialData?: Note;
  onNoteSaved: () => void;
  onClose: () => void;
}

const NoteForm: React.FC<NoteFormProps> = ({ initialData, onNoteSaved, onClose }) => {
  const { session } = useSession();
  const userId = session?.user?.id;

  const form = useForm<NoteFormValues>({
    resolver: zodResolver(noteSchema),
    defaultValues: initialData ? {
      ...initialData,
      // Se for checklist, parse o JSON para um array de objetos
      content: initialData.type === "checklist" && typeof initialData.content === 'string'
        ? JSON.parse(initialData.content)
        : initialData.content,
      selected_tag_ids: initialData.tags?.map(tag => tag.id) || [], // Preencher tags iniciais
    } : {
      title: "",
      content: "",
      color: "#FEEFC3",
      type: "text",
      selected_tag_ids: [],
    },
  });

  const selectedColor = form.watch("color");
  const noteType = form.watch("type");
  const [checklistItems, setChecklistItems] = useState<{ text: string; completed: boolean }[]>([]);
  const selectedTagIds = form.watch("selected_tag_ids") || [];

  useEffect(() => {
    if (noteType === "checklist" && Array.isArray(form.getValues("content"))) {
      setChecklistItems(form.getValues("content") as { text: string; completed: boolean }[]);
    } else if (noteType === "text") {
      setChecklistItems([]);
    }
  }, [noteType, form.getValues("content")]);

  const addChecklistItem = () => {
    setChecklistItems(prev => [...prev, { text: "", completed: false }]);
  };

  const updateChecklistItem = (index: number, newText: string) => {
    setChecklistItems(prev => prev.map((item, i) => i === index ? { ...item, text: newText } : item));
  };

  const removeChecklistItem = (index: number) => {
    setChecklistItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleTagSelectionChange = (newSelectedTagIds: string[]) => {
    form.setValue("selected_tag_ids", newSelectedTagIds, { shouldDirty: true });
  };

  const onSubmit = async (values: NoteFormValues) => {
    if (!userId) {
      showError("Usuário não autenticado.");
      return;
    }

    let finalContent: string | { text: string; completed: boolean }[];

    if (noteType === "checklist") {
      const filteredItems = checklistItems.filter(item => item.text.trim() !== "");
      if (filteredItems.length === 0) {
        showError("A checklist deve ter pelo menos um item.");
        return;
      }
      finalContent = JSON.stringify(filteredItems);
    } else {
      if (typeof values.content !== 'string' || values.content.trim() === "") {
        showError("O conteúdo da nota não pode estar vazio.");
        return;
      }
      finalContent = values.content;
    }

    try {
      let noteId: string;

      const dataToSave = {
        title: values.title?.trim() === "" ? null : values.title,
        content: finalContent,
        color: values.color,
        type: values.type,
        updated_at: new Date().toISOString(),
      };

      if (initialData) {
        const { data, error } = await supabase
          .from("notes")
          .update(dataToSave)
          .eq("id", initialData.id)
          .eq("user_id", userId)
          .select("id")
          .single();
        if (error) throw error;
        noteId = data.id;
        showSuccess("Nota atualizada com sucesso!");
      } else {
        const { data, error } = await supabase
          .from("notes")
          .insert({ ...dataToSave, user_id: userId })
          .select("id")
          .single();
        if (error) throw error;
        noteId = data.id;
        showSuccess("Nota adicionada com sucesso!");
      }

      // Atualizar note_tags
      await supabase.from("note_tags").delete().eq("note_id", noteId);

      if (values.selected_tag_ids && values.selected_tag_ids.length > 0) {
        const noteTagsToInsert = values.selected_tag_ids.map(tagId => ({
          note_id: noteId,
          tag_id: tagId,
        }));
        const { error: tagInsertError } = await supabase.from("note_tags").insert(noteTagsToInsert);
        if (tagInsertError) throw tagInsertError;
      }

      form.reset();
      onNoteSaved();
      onClose();
    } catch (err: any) {
      showError("Erro ao salvar nota: " + err.message);
      console.error("Erro ao salvar nota:", err);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-4 bg-card">
      <div>
        <Label htmlFor="note-title" className="text-foreground">Título (Opcional)</Label>
        <Input
          id="note-title"
          {...form.register("title")}
          placeholder="Título da sua nota"
          className="w-full bg-input border-border text-foreground focus-visible:ring-ring"
        />
      </div>

      <div>
        <Label htmlFor="note-type" className="text-foreground">Tipo de Nota</Label>
        <Select
          onValueChange={(value: "text" | "checklist") => {
            form.setValue("type", value);
            // Reset content when changing type
            form.setValue("content", value === "text" ? "" : []);
          }}
          value={noteType}
        >
          <SelectTrigger id="note-type" className="w-full bg-input border-border text-foreground focus-visible:ring-ring">
            <SelectValue placeholder="Selecionar tipo de nota" />
          </SelectTrigger>
          <SelectContent className="bg-popover text-popover-foreground border-border rounded-md shadow-lg">
            <SelectItem value="text">Texto</SelectItem>
            <SelectItem value="checklist">Checklist</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {noteType === "text" ? (
        <div>
          <Label htmlFor="note-content" className="text-foreground">Conteúdo da Nota</Label>
          <Textarea
            id="note-content"
            {...form.register("content")}
            placeholder="Comece a escrever sua nota aqui..."
            className="w-full bg-input border-border text-foreground focus-visible:ring-ring min-h-[150px]"
          />
          {form.formState.errors.content && (
            <p className="text-red-500 text-sm mt-1">
              {form.formState.errors.content.message as string}
            </p>
          )}
        </div>
      ) : (
        <div>
          <Label className="text-foreground">Itens da Checklist</Label>
          <div className="space-y-2">
            {checklistItems.map((item, index) => (
              <div key={index} className="flex items-center gap-2">
                <Checkbox
                  checked={item.completed}
                  onCheckedChange={(checked) => {
                    setChecklistItems(prev => prev.map((i, idx) => idx === index ? { ...i, completed: checked as boolean } : i));
                  }}
                  className="border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                />
                <Input
                  value={item.text}
                  onChange={(e) => updateChecklistItem(index, e.target.value)}
                  placeholder={`Item ${index + 1}`}
                  className="flex-grow bg-input border-border text-foreground focus-visible:ring-ring"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeChecklistItem(index)}
                  className="text-red-500 hover:bg-red-500/10"
                >
                  <XCircle className="h-4 w-4" />
                  <span className="sr-only">Remover Item</span>
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" onClick={addChecklistItem} className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/80">
              <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Item
            </Button>
          </div>
          {form.formState.errors.content && (
            <p className="text-red-500 text-sm mt-1">
              {form.formState.errors.content.message as string}
            </p>
          )}
        </div>
      )}

      <div>
        <Label htmlFor="note-color" className="text-foreground">Cor da Nota</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-start text-left font-normal bg-input border-border text-foreground hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
              style={{ backgroundColor: selectedColor }}
            >
              <Palette className="h-4 w-4" />
              <span>{COLORS.find(c => c.hex === selectedColor)?.name || "Selecionar Cor"}</span>
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
                onClick={() => form.setValue("color", color.hex)}
                title={color.name}
              />
            ))}
          </PopoverContent>
        </Popover>
      </div>
      <TagSelector
        selectedTagIds={selectedTagIds}
        onTagSelectionChange={handleTagSelectionChange}
      />
      <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
        {initialData ? "Atualizar Nota" : "Adicionar Nota"}
      </Button>
    </form>
  );
};

export default NoteForm;