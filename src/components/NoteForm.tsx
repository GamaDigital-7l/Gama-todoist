"use client";

import React, { useState, useEffect, useRef } from "react";
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
import { Palette, PlusCircle, XCircle, CalendarIcon, Image as ImageIcon, Trash2, Pin, PinOff, Bell, Tag as TagIcon, ListTodo, TextCursorInput } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import TagSelector from "./TagSelector";
import TimePicker from "./TimePicker";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";

import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css'; // Importar os estilos do Quill

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
  content: z.string().min(1, "O conteúdo da nota é obrigatório."), // Conteúdo agora é sempre string (HTML ou JSON string)
  color: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Cor inválida. Use formato hexadecimal (ex: #RRGGBB).").default("#FEEFC3"),
  type: z.enum(["text", "checklist"]).default("text"),
  selected_tag_ids: z.array(z.string()).optional(),
  reminder_date: z.date().optional().nullable(),
  reminder_time: z.string().optional().nullable(),
  image_file: z
    .instanceof(File)
    .optional()
    .refine((file) => !file || (file.type.startsWith("image/") && file.size <= 5 * 1024 * 1024), "Apenas imagens (até 5MB) são permitidas."),
  existing_image_url: z.string().optional().nullable(),
  pinned: z.boolean().default(false), // Adicionado pinned ao schema
});

export type NoteFormValues = z.infer<typeof noteSchema>;

interface NoteFormProps {
  initialData?: Note;
  onNoteSaved: () => void;
  onClose: () => void;
}

// Função para sanitizar o nome do arquivo
const sanitizeFilename = (filename: string) => {
  return filename
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9.]/g, "-")
    .replace(/--+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
};

const NoteForm: React.FC<NoteFormProps> = ({ initialData, onNoteSaved, onClose }) => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const quillRef = useRef<ReactQuill>(null);
  const fileInputRef = useRef<HTMLInputElement>(null); // Ref para o input de arquivo

  const form = useForm<NoteFormValues>({
    resolver: zodResolver(noteSchema),
    defaultValues: initialData ? {
      ...initialData,
      content: initialData.content, // Já é string
      selected_tag_ids: initialData.tags?.map(tag => tag.id) || [],
      reminder_date: initialData.reminder_date ? parseISO(initialData.reminder_date) : undefined,
      reminder_time: initialData.reminder_time || undefined,
      existing_image_url: initialData.image_url || undefined,
      image_file: undefined,
      pinned: initialData.pinned, // Carregar estado de pinned
    } : {
      title: "",
      content: "",
      color: "#FEEFC3",
      type: "text",
      selected_tag_ids: [],
      reminder_date: undefined,
      reminder_time: undefined,
      image_file: undefined,
      existing_image_url: undefined,
      pinned: false,
    },
  });

  const selectedColor = form.watch("color");
  const noteType = form.watch("type");
  const [checklistItems, setChecklistItems] = useState<{ text: string; completed: boolean }[]>([]);
  const selectedTagIds = form.watch("selected_tag_ids") || [];
  const imageFile = form.watch("image_file");
  const existingImageUrl = form.watch("existing_image_url");
  const [imagePreview, setImagePreview] = useState<string | null>(existingImageUrl || null);
  const isPinned = form.watch("pinned");

  useEffect(() => {
    if (noteType === "checklist" && initialData?.type === "checklist") {
      try {
        setChecklistItems(JSON.parse(initialData.content) as { text: string; completed: boolean }[]);
      } catch (e) {
        console.error("Erro ao parsear conteúdo da checklist inicial:", e);
        setChecklistItems([]);
      }
    } else if (noteType === "text") {
      setChecklistItems([]);
    }
  }, [noteType, initialData]);

  useEffect(() => {
    if (imageFile) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(imageFile);
    } else if (!existingImageUrl) {
      setImagePreview(null);
    }
  }, [imageFile, existingImageUrl]);

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

  const handleRemoveImage = () => {
    form.setValue("image_file", undefined);
    form.setValue("existing_image_url", null);
    setImagePreview(null);
  };

  const handleImageUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      form.setValue("image_file", file, { shouldDirty: true });
      form.setValue("existing_image_url", null); // Limpa a URL existente se um novo arquivo for selecionado
    }
  };

  const handlePinToggle = () => {
    form.setValue("pinned", !isPinned, { shouldDirty: true });
  };

  const modules = {
    toolbar: [
      [{ 'header': [1, 2, false] }],
      ['bold', 'italic', 'underline', 'strike', 'blockquote'],
      [{ 'list': 'ordered' }, { 'list': 'bullet' }, { 'indent': '-1' }, { 'indent': '+1' }],
      ['link'], // Removido 'image' do toolbar do Quill para evitar confusão com a imagem principal
      ['clean']
    ],
  };

  const formats = [
    'header',
    'bold', 'italic', 'underline', 'strike', 'blockquote',
    'list', 'bullet', 'indent',
    'link'
  ];

  const onSubmit = async (values: NoteFormValues) => {
    if (!userId) {
      showError("Usuário não autenticado.");
      return;
    }

    let finalContent: string;

    if (noteType === "checklist") {
      const filteredItems = checklistItems.filter(item => item.text.trim() !== "");
      if (filteredItems.length === 0) {
        showError("A checklist deve ter pelo menos um item.");
        return;
      }
      finalContent = JSON.stringify(filteredItems);
    } else {
      if (values.content.trim() === "" || values.content === "<p><br></p>") { // Verifica se o editor está vazio
        showError("O conteúdo da nota não pode estar vazio.");
        return;
      }
      finalContent = values.content;
    }

    let imageUrlToSave: string | null = values.existing_image_url || null;

    // Se um novo arquivo de imagem foi selecionado, faça o upload
    if (values.image_file) {
      const file = values.image_file;
      const sanitizedFilename = sanitizeFilename(file.name);
      const filePath = `note_images/${userId}/${Date.now()}-${sanitizedFilename}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("note-assets")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        throw new Error("Erro ao fazer upload da imagem: " + uploadError.message);
      }

      const { data: publicUrlData } = supabase.storage
        .from("note-assets")
        .getPublicUrl(filePath);
      
      imageUrlToSave = publicUrlData.publicUrl;
    } else if (values.existing_image_url === null) {
      // Se a imagem existente foi removida
      imageUrlToSave = null;
    }


    try {
      let noteId: string;

      const dataToSave = {
        title: values.title?.trim() === "" ? null : values.title,
        content: finalContent,
        color: values.color,
        type: values.type,
        reminder_date: values.reminder_date ? format(values.reminder_date, "yyyy-MM-dd") : null,
        reminder_time: values.reminder_time || null,
        image_url: imageUrlToSave,
        pinned: values.pinned, // Salvar estado de pinned
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
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-0 p-0 bg-card rounded-lg shadow-lg">
      <div className="relative p-4" style={{ backgroundColor: selectedColor }}>
        {/* Imagem Principal */}
        {imagePreview && (
          <div className="relative w-full h-48 mb-4 rounded-md overflow-hidden">
            <img src={imagePreview} alt="Pré-visualização da imagem" className="w-full h-full object-cover" />
            <Button
              type="button"
              variant="destructive"
              size="icon"
              onClick={handleRemoveImage}
              className="absolute top-2 right-2 rounded-full"
            >
              <Trash2 className="h-4 w-4" />
              <span className="sr-only">Remover Imagem</span>
            </Button>
          </div>
        )}

        {/* Título */}
        <Input
          id="note-title"
          {...form.register("title")}
          placeholder="Título"
          className="w-full bg-transparent border-none text-foreground text-lg font-semibold focus-visible:ring-0 px-0 mb-2"
        />

        {/* Conteúdo da Nota / Checklist */}
        {noteType === "text" ? (
          <ReactQuill
            ref={quillRef}
            theme="bubble" // Tema bubble para um visual mais limpo, sem toolbar visível por padrão
            value={form.watch("content")}
            onChange={(value) => form.setValue("content", value, { shouldDirty: true })}
            modules={modules}
            formats={formats}
            placeholder="Criar uma nota..."
            className="bg-transparent text-foreground min-h-[80px] quill-no-toolbar" // Classe para esconder o toolbar
          />
        ) : (
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
                  className="flex-grow bg-transparent border-none text-foreground focus-visible:ring-0 px-0"
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
            <Button type="button" variant="ghost" onClick={addChecklistItem} className="w-full justify-start text-muted-foreground hover:bg-accent hover:text-accent-foreground">
              <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Item
            </Button>
          </div>
        )}

        {/* Botão de Pin */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handlePinToggle}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
        >
          {isPinned ? <PinOff className="h-5 w-5" /> : <Pin className="h-5 w-5" />}
          <span className="sr-only">{isPinned ? "Desafixar" : "Fixar"}</span>
        </Button>
      </div>

      {/* Barra de Ações Inferior */}
      <div className="flex items-center justify-between p-2 border-t border-border bg-card">
        <div className="flex items-center gap-1">
          {/* Ícone de Cor */}
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
                  onClick={() => form.setValue("color", color.hex)}
                  title={color.name}
                />
              ))}
            </PopoverContent>
          </Popover>

          {/* Ícone de Lembrete */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:bg-accent hover:text-accent-foreground">
                <Bell className="h-5 w-5" />
                <span className="sr-only">Adicionar Lembrete</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-4 bg-popover border-border rounded-md shadow-lg space-y-3">
              <div>
                <Label htmlFor="reminder_date" className="text-foreground">Data do Lembrete</Label>
                <Calendar
                  mode="single"
                  selected={form.watch("reminder_date") || undefined}
                  onSelect={(date) => form.setValue("reminder_date", date || null)}
                  initialFocus
                />
              </div>
              <div>
                <Label htmlFor="reminder_time" className="text-foreground">Hora do Lembrete</Label>
                <TimePicker
                  value={form.watch("reminder_time") || null}
                  onChange={(time) => form.setValue("reminder_time", time || null)}
                />
              </div>
            </PopoverContent>
          </Popover>

          {/* Ícone de Imagem Principal */}
          <Button variant="ghost" size="icon" onClick={handleImageUploadClick} className="text-muted-foreground hover:bg-accent hover:text-accent-foreground">
            <ImageIcon className="h-5 w-5" />
            <span className="sr-only">Adicionar Imagem</span>
          </Button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            className="hidden"
          />

          {/* Ícone de Tags */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:bg-accent hover:text-accent-foreground">
                <TagIcon className="h-5 w-5" />
                <span className="sr-only">Adicionar Rótulo</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-0 bg-popover border-border rounded-md shadow-lg">
              <TagSelector
                selectedTagIds={selectedTagIds}
                onTagSelectionChange={handleTagSelectionChange}
              />
            </PopoverContent>
          </Popover>

          {/* Ícone para alternar tipo de nota (Texto/Checklist) */}
          <Button variant="ghost" size="icon" onClick={() => form.setValue("type", noteType === "text" ? "checklist" : "text")} className="text-muted-foreground hover:bg-accent hover:text-accent-foreground">
            {noteType === "text" ? <ListTodo className="h-5 w-5" /> : <TextCursorInput className="h-5 w-5" />}
            <span className="sr-only">{noteType === "text" ? "Mudar para Checklist" : "Mudar para Texto"}</span>
          </Button>
        </div>

        <Button type="submit" onClick={onClose} className="bg-primary text-primary-foreground hover:bg-primary/90">
          Fechar
        </Button>
      </div>
    </form>
  );
};

export default NoteForm;