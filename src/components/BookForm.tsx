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

const bookSchema = z.object({
  title: z.string().min(1, "O título do livro é obrigatório."),
  author: z.string().optional(),
  cover_image_url: z.string().url("URL da capa inválida.").optional().or(z.literal("")),
  description: z.string().optional(),
  content: z.string().optional(), // Novo campo para o conteúdo do livro
  read_status: z.enum(["unread", "reading", "finished"]).default("unread"),
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
      content: "", // Valor padrão para o conteúdo
      read_status: "unread",
    },
  });

  const onSubmit = async (values: BookFormValues) => {
    try {
      // TODO: Adicionar user_id quando a autenticação estiver ativa
      const { error } = await supabase.from("books").insert({
        title: values.title,
        author: values.author || null,
        cover_image_url: values.cover_image_url || null,
        description: values.description || null,
        content: values.content || null, // Salvar o conteúdo do livro
        read_status: values.read_status,
        // user_id: auth.uid() // Descomentar quando a autenticação for reativada
      });

      if (error) throw error;
      showSuccess("Livro adicionado com sucesso!");
      form.reset();
      onBookAdded(); // Notifica o componente pai que um livro foi adicionado
      onClose(); // Fecha o formulário
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
        <Label htmlFor="content">Conteúdo do Livro (Opcional)</Label>
        <Textarea
          id="content"
          {...form.register("content")}
          placeholder="Cole o texto completo do livro aqui..."
          rows={10}
          className="min-h-[150px]"
        />
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