"use client";

import React from "react";
import { useForm } from "react-hook-form"; // Corrigido: importado de react-hook-form
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/integrations/supabase/auth";

const bookSchema = z.object({
  title: z.string().min(1, "O título do livro é obrigatório."),
  author: z.string().optional(),
  cover_image_url: z.string().url("URL da capa inválida.").optional().or(z.literal("")),
  description: z.string().optional(),
  read_status: z.enum(["unread", "reading", "finished"]).default("unread"),
  pdf_file: z
    .instanceof(File)
    .optional()
    .refine((file) => !file || file.type === "application/pdf", "Apenas arquivos PDF são permitidos."),
  total_pages: z.preprocess(
    (val) => (val === "" ? null : Number(val)),
    z.number().int().min(1, "O total de páginas deve ser um número positivo.").nullable().optional(),
  ),
  daily_reading_target_pages: z.preprocess(
    (val) => (val === "" ? null : Number(val)),
    z.number().int().min(1, "A meta diária deve ser um número positivo.").nullable().optional(),
  ),
});

type BookFormValues = z.infer<typeof bookSchema>;

interface BookFormProps {
  onBookAdded: () => void;
  onClose: () => void;
  initialData?: BookFormValues & { id: string };
}

// Função para sanitizar o nome do arquivo
const sanitizeFilename = (filename: string) => {
  return filename
    .normalize("NFD") // Normaliza caracteres acentuados
    .replace(/[\u0300-\u036f]/g, "") // Remove diacríticos
    .replace(/[^a-zA-Z0-9.]/g, "-") // Substitui caracteres não alfanuméricos (exceto ponto) por hífen
    .replace(/--+/g, "-") // Substitui múltiplos hífens por um único
    .replace(/^-+|-+$/g, "") // Remove hífens do início e fim
    .toLowerCase(); // Converte para minúsculas
};

const BookForm: React.FC<BookFormProps> = ({ onBookAdded, onClose, initialData }) => {
  const { session } = useSession();
  const userId = session?.user?.id;

  const form = useForm<BookFormValues>({
    resolver: zodResolver(bookSchema),
    defaultValues: initialData ? {
      ...initialData,
      pdf_file: undefined,
    } : {
      title: "",
      author: "",
      cover_image_url: "",
      description: "",
      read_status: "unread",
      pdf_file: undefined,
      total_pages: undefined,
      daily_reading_target_pages: undefined,
    },
  });

  const onSubmit = async (values: BookFormValues) => {
    if (!userId) {
      showError("Usuário não autenticado.");
      return;
    }

    try {
      let pdfUrl: string | null = null;

      if (values.pdf_file) {
        const file = values.pdf_file;
        const sanitizedFilename = sanitizeFilename(file.name); // Sanitiza o nome do arquivo
        const filePath = `public/${Date.now()}-${sanitizedFilename}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("book-pdfs")
          .upload(filePath, file, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) {
          throw new Error("Erro ao fazer upload do PDF: " + uploadError.message);
        }

        const { data: publicUrlData } = supabase.storage
          .from("book-pdfs")
          .getPublicUrl(filePath);
        
        pdfUrl = publicUrlData.publicUrl;
      }

      const dataToSave = {
        title: values.title,
        author: values.author || null,
        cover_image_url: values.cover_image_url || null,
        description: values.description || null,
        pdf_url: pdfUrl,
        read_status: values.read_status,
        total_pages: values.total_pages || null,
        daily_reading_target_pages: values.daily_reading_target_pages || null,
        current_page: 0,
        user_id: userId,
      };

      if (initialData) {
        const { error: updateError } = await supabase.from("books", { schema: 'public' }).update(dataToSave).eq("id", initialData.id); // Especificando o esquema
        if (updateError) throw updateError;
        showSuccess("Livro atualizado com sucesso!");
      } else {
        const { error: insertError } = await supabase.from("books", { schema: 'public' }).insert(dataToSave); // Especificando o esquema
        if (insertError) throw insertError;
        showSuccess("Livro adicionado com sucesso!");
      }
      
      form.reset();
      onBookAdded();
      onClose();
    } catch (error: any) {
      showError("Erro ao adicionar livro: " + error.message);
      console.error("Erro ao adicionar livro:", error);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-4 bg-card">
      <div>
        <Label htmlFor="title" className="text-foreground">Título</Label>
        <Input
          id="title"
          {...form.register("title")}
          placeholder="Ex: O Senhor dos Anéis"
          className="w-full bg-input border-border text-foreground focus-visible:ring-ring"
        />
        {form.formState.errors.title && (
          <p className="text-red-500 text-sm mt-1">
            {form.formState.errors.title.message}
          </p>
        )}
      </div>
      <div>
        <Label htmlFor="author" className="text-foreground">Autor (Opcional)</Label>
        <Input
          id="author"
          {...form.register("author")}
          placeholder="Ex: J.R.R. Tolkien"
          className="w-full bg-input border-border text-foreground focus-visible:ring-ring"
        />
      </div>
      <div>
        <Label htmlFor="cover_image_url" className="text-foreground">URL da Imagem de Capa (Opcional)</Label>
        <Input
          id="cover_image_url"
          {...form.register("cover_image_url")}
          placeholder="Ex: https://exemplo.com/capa.jpg"
          className="w-full bg-input border-border text-foreground focus-visible:ring-ring"
        />
        {form.formState.errors.cover_image_url && (
          <p className="text-red-500 text-sm mt-1">
            {form.formState.errors.cover_image_url.message}
          </p>
        )}
      </div>
      <div>
        <Label htmlFor="description" className="text-foreground">Descrição (Opcional)</Label>
        <Textarea
          id="description"
          {...form.register("description")}
          placeholder="Uma breve descrição do livro..."
          className="w-full bg-input border-border text-foreground focus-visible:ring-ring"
        />
      </div>
      <div>
        <Label htmlFor="total_pages" className="text-foreground">Total de Páginas (Opcional)</Label>
        <Input
          id="total_pages"
          type="number"
          {...form.register("total_pages", { valueAsNumber: true })}
          placeholder="Ex: 500"
          className="w-full bg-input border-border text-foreground focus-visible:ring-ring"
        />
        {form.formState.errors.total_pages && (
          <p className="text-red-500 text-sm mt-1">
            {form.formState.errors.total_pages.message}
          </p>
        )}
      </div>
      <div>
        <Label htmlFor="daily_reading_target_pages" className="text-foreground">Meta Diária de Leitura (Páginas, Opcional)</Label>
        <Input
          id="daily_reading_target_pages"
          type="number"
          {...form.register("daily_reading_target_pages", { valueAsNumber: true })}
          placeholder="Ex: 10"
          className="w-full bg-input border-border text-foreground focus-visible:ring-ring"
        />
        {form.formState.errors.daily_reading_target_pages && (
          <p className="text-red-500 text-sm mt-1">
            {form.formState.errors.daily_reading_target_pages.message}
          </p>
        )}
      </div>
      <div>
        <Label htmlFor="pdf_file" className="text-foreground">Arquivo PDF (Opcional)</Label>
        <Input
          id="pdf_file"
          type="file"
          accept="application/pdf"
          onChange={(e) => form.setValue("pdf_file", e.target.files?.[0])}
          className="w-full bg-input border-border text-foreground focus-visible:ring-ring"
        />
        {form.formState.errors.pdf_file && (
          <p className="text-red-500 text-sm mt-1">
            {form.formState.errors.pdf_file.message}
          </p>
        )}
      </div>
      <div>
        <Label htmlFor="read_status" className="text-foreground">Status de Leitura</Label>
        <Select
          onValueChange={(value: "unread" | "reading" | "finished") =>
            form.setValue("read_status", value)
          }
          value={form.watch("read_status")}
        >
          <SelectTrigger id="read_status" className="w-full bg-input border-border text-foreground focus-visible:ring-ring">
            <SelectValue placeholder="Selecionar status" />
          </SelectTrigger>
          <SelectContent className="bg-popover text-popover-foreground border-border rounded-md shadow-lg">
            <SelectItem value="unread">Não Lido</SelectItem>
            <SelectItem value="reading">Lendo</SelectItem>
            <SelectItem value="finished">Concluído</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90">Adicionar Livro</Button>
    </form>
  );
};

export default BookForm;