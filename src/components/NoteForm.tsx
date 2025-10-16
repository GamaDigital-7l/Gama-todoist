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
import { Palette, PlusCircle, XCircle, CalendarIcon, Image as ImageIcon, Trash2 } from "lucide-react";
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
    },
  });

  const selectedColor = form.watch("color");
  const noteType = form.watch("type");
  const [checklistItems, setChecklistItems] = useState<{ text: string; completed: boolean }[]>([]);
  const selectedTagIds = form.watch("selected_tag_ids") || [];
  const imageFile = form.watch("image_file");
  const existingImageUrl = form.watch("existing_image_url");
  const [imagePreview, setImagePreview] = useState<string | null>(existingImageUrl || null);

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

  const imageHandler = () => {
    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', 'image/*');
    input.click();

    input.onchange = async () => {
      const file = input.files?.[0];
      if (file && userId) {
        const quill = quillRef.current?.getEditor();
        const range = quill?.getSelection(true);

        if (quill && range) {
          const sanitizedFilename = sanitizeFilename(file.name);
          const filePath = `note_images/${userId}/${Date.now()}-${sanitizedFilename}`;

          try {
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
            
            quill.insertEmbed(range.index, 'image', publicUrlData.publicUrl);
            quill.setSelection(range.index + 1, 0); // Move cursor after image
            showSuccess("Imagem inserida com sucesso!");
          } catch (err: any) {
            showError("Erro ao inserir imagem: " + err.message);
            console.error("Erro ao inserir imagem:", err);
          }
        }
      } else if (!userId) {
        showError("Usuário não autenticado para upload de imagem.");
      }
    };
  };

  const modules = {
    toolbar: {
      container: [
        [{ 'header': [1, 2, false] }],
        ['bold', 'italic', 'underline', 'strike', 'blockquote'],
        [{ 'list': 'ordered' }, { 'list': 'bullet' }, { 'indent': '-1' }, { 'indent': '+1' }],
        ['link', 'image'],
        ['clean']
      ],
      handlers: {
        image: imageHandler,
      },
    },
  };

  const formats = [
    'header',
    'bold', 'italic', 'underline', 'strike', 'blockquote',
    'list', 'bullet', 'indent',
    'link', 'image'
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

      {/* Image Upload Section (for main/cover image) */}
      <div>
        <Label htmlFor="image_file" className="text-foreground flex items-center gap-2">
          <ImageIcon className="h-4 w-4" /> Imagem Principal (Opcional)
        </Label>
        {imagePreview && (
          <div className="relative w-full h-48 mb-2 rounded-md overflow-hidden">
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
        <Input
          id="image_file"
          type="file"
          accept="image/*"
          onChange={(e) => form.setValue("image_file", e.target.files?.[0])}
          className="w-full bg-input border-border text-foreground focus-visible:ring-ring"
        />
        {form.formState.errors.image_file && (
          <p className="text-red-500 text-sm mt-1">
            {form.formState.errors.image_file.message as string}
          </p>
        )}
      </div>

      <div>
        <Label htmlFor="note-type" className="text-foreground">Tipo de Nota</Label>
        <Select
          onValueChange={(value: "text" | "checklist") => {
            form.setValue("type", value);
            form.setValue("content", value === "text" ? "" : "[]"); // Conteúdo inicial para checklist
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
          <ReactQuill
            ref={quillRef}
            theme="snow"
            value={form.watch("content")}
            onChange={(value) => form.setValue("content", value, { shouldDirty: true })}
            modules={modules}
            formats={formats}
            placeholder="Comece a escrever sua nota aqui..."
            className="bg-input text-foreground rounded-md"
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
                    form.setValue("content", JSON.stringify(checklistItems), { shouldDirty: true }); // Atualiza o form content
                  }}
                  className="border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                />
                <Input
                  value={item.text}
                  onChange={(e) => {
                    updateChecklistItem(index, e.target.value);
                    form.setValue("content", JSON.stringify(checklistItems), { shouldDirty: true }); // Atualiza o form content
                  }}
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

      {/* Campos de Lembrete */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="reminder_date" className="text-foreground">Data do Lembrete (Opcional)</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className={cn(
                  "w-full justify-start text-left font-normal bg-input border-border text-foreground hover:bg-accent hover:text-accent-foreground",
                  !form.watch("reminder_date") && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {form.watch("reminder_date") ? (
                  format(form.watch("reminder_date")!, "PPP")
                ) : (
                  <span>Escolha uma data</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 bg-popover border-border rounded-md shadow-lg">
              <Calendar
                mode="single"
                selected={form.watch("reminder_date") || undefined}
                onSelect={(date) => form.setValue("reminder_date", date || null)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
        <div>
          <Label htmlFor="reminder_time" className="text-foreground">Hora do Lembrete (Opcional)</Label>
          <TimePicker
            value={form.watch("reminder_time") || null}
            onChange={(time) => form.setValue("reminder_time", time || null)}
          />
        </div>
      </div>

      <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
        {initialData ? "Atualizar Nota" : "Adicionar Nota"}
      </Button>
    </form>
  );
};

export default NoteForm;