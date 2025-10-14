"use client";

import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";

// Definindo o esquema de validação para o formulário de livro
const bookSchema = z.object({
  title: z.string().min(1, "O título do livro é obrigatório."),
  author: z.string().optional(),
  cover_image_url: z.string().url("URL da capa inválida.").optional().or(z.literal("")),
  description: z.string().optional(),
  // O campo 'content' foi removido, pois agora usaremos PDF
  read_status: z.enum(["unread", "reading", "finished"]).default("unread"),
  pdf_file: z
    .instanceof(File)
    .optional()
    .refine((file) => !file || file.type === "application/pdf", "Apenas arquivos PDF são permitidos."),
});

type BookFormValues = z.infer<typeof bookSchema>;

interface BookFormProps {
  onBookAdded: () => void;
  onClose: () => void;
}

const BookForm: React.FC<BookFormProps> = ({ onBookAdded, onClose }) => {
  const form = useForm<BookFormValues>({
    resolver: zodResolver(bookSchema),
    defaultValues: {
      title: "",
      author: "",
      cover_image_url: "",
      description: "",
      read_status: "unread",
      pdf_file: undefined,
    },
  });

  const onSubmit = async (values: BookFormValues) => {
    try {
      let pdfUrl: string | null = null;

      if (values.pdf_file) {
        const file = values.pdf_file;
        const filePath = `public/${Date.now()}-${file.name}`; // Caminho único para o arquivo

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("book-pdfs") // Nome do bucket no Supabase Storage
          .upload(filePath, file, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) {
          throw new Error("Erro ao fazer upload do PDF: " + uploadError.message);
        }

        // Obter a URL pública do arquivo
        const { data: publicUrlData } = supabase.storage
          .from("book-pdfs")
          .getPublicUrl(filePath);
        
        pdfUrl = publicUrlData.publicUrl;
      }

      // Inserir os dados do livro no banco de dados
      const { error: insertError } = await supabase.from("books").insert({
        title: values.title,
        author: values.author || null,
        cover_image_url: values.cover_image_url || null,
        description: values.description || null,
        pdf_url: pdfUrl, // Salvar a URL do PDF
        read_status: values.read_status,
        // user_id: auth.uid() // Descomentar quando a autenticação for reativada
      });

      if (insertError) throw insertError;
      showSuccess("Livro adicionado com sucesso!");
      form.reset();
      onBookAdded();
      onClose();
    } catch (error: any) {
      showError("Erro ao adicionar livro: " + error.message);
      console.error("Erro ao adicionar livro:", error);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-4">
      <div>
        <Label htmlFor="title">Título</Label>
        <Input
          id="title"
          {...form.register("title")}
          placeholder="Ex: O Senhor dos Anéis"
        />
        {form.formState.errors.title && (
          <p className="text-red-500 text-sm mt-1">
            {form.formState.errors.title.message}
          </p>
        )}
      </div>
      <div>
        <Label htmlFor="author">Autor (Opcional)</Label>
        <Input
          id="author"
          {...form.register("author")}
          placeholder="Ex: J.R.R. Tolkien"
        />
      </div>
      <div>
        <Label htmlFor="cover_image_url">URL da Imagem de Capa (Opcional)</Label>
        <Input
          id="cover_image_url"
          {...form.register("cover_image_url")}
          placeholder="Ex: https://exemplo.com/capa.jpg"
        />
        {form.formState.errors.cover_image_url && (
          <p className="text-red-500 text-sm mt-1">
            {form.formState.errors.cover_image_url.message}
          </p>
        )}
      </div>
      <div>
        <Label htmlFor="description">Descrição (Opcional)</Label>
        <Textarea
          id="description"
          {...form.register("description")}
          placeholder="Uma breve descrição do livro..."
        />
      </div>
      <div>
        <Label htmlFor="pdf_file">Arquivo PDF (Opcional)</Label>
        <Input
          id="pdf_file"
          type="file"
          accept="application/pdf"
          onChange={(e) => form.setValue("pdf_file", e.target.files?.[0])}
        />
        {form.formState.errors.pdf_file && (
          <p className="text-red-500 text-sm mt-1">
            {form.formState.errors.pdf_file.message}
          </p>
        )}
      </div>
      <div>
        <Label htmlFor="read_status">Status de Leitura</Label>
        <Select
          onValueChange={(value: "unread" | "reading" | "finished") =>
            form.setValue("read_status", value)
          }
          value={form.watch("read_status")}
        >
          <SelectTrigger id="read_status">
            <SelectValue placeholder="Selecionar status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unread">Não Lido</SelectItem>
            <SelectItem value="reading">Lendo</SelectItem>
            <SelectItem value="finished">Concluído</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" className="w-full">Adicionar Livro</Button>
    </form>
  );
};

export default BookForm;