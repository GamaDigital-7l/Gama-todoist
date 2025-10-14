"use client";

import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showError } from "@/utils/toast";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { MadeWithDyad } from "@/components/made-with-dyad";

interface Book {
  id: string;
  title: string;
  author?: string;
  content?: string;
}

const fetchBookById = async (bookId: string): Promise<Book | null> => {
  const { data, error } = await supabase
    .from("books")
    .select("id, title, author, content")
    .eq("id", bookId)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 means no rows found
    throw error;
  }
  return data || null;
};

const BookReader: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: book, isLoading, error } = useQuery<Book | null, Error>({
    queryKey: ["book", id],
    queryFn: () => fetchBookById(id!),
    enabled: !!id, // Só executa a query se o ID estiver disponível
  });

  if (!id) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <h1 className="text-3xl font-bold">Livro Não Encontrado</h1>
        <p className="text-lg text-muted-foreground">O ID do livro não foi fornecido.</p>
        <Button onClick={() => navigate("/books")} className="w-fit">
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para a Biblioteca
        </Button>
        <div className="flex-1 flex items-end justify-center">
          <MadeWithDyad />
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <h1 className="text-3xl font-bold">Carregando Livro...</h1>
        <p className="text-lg text-muted-foreground">Preparando sua leitura.</p>
        <div className="flex-1 flex items-end justify-center">
          <MadeWithDyad />
        </div>
      </div>
    );
  }

  if (error) {
    showError("Erro ao carregar livro: " + error.message);
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <h1 className="text-3xl font-bold">Erro ao Carregar Livro</h1>
        <p className="text-lg text-red-500">Ocorreu um erro: {error.message}</p>
        <Button onClick={() => navigate("/books")} className="w-fit">
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para a Biblioteca
        </Button>
        <div className="flex-1 flex items-end justify-center">
          <MadeWithDyad />
        </div>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <h1 className="text-3xl font-bold">Livro Não Encontrado</h1>
        <p className="text-lg text-muted-foreground">O livro que você está procurando não existe ou foi removido.</p>
        <Button onClick={() => navigate("/books")} className="w-fit">
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para a Biblioteca
        </Button>
        <div className="flex-1 flex items-end justify-center">
          <MadeWithDyad />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
      <div className="flex items-center gap-4 mb-4">
        <Button variant="outline" size="icon" onClick={() => navigate("/books")}>
          <ArrowLeft className="h-4 w-4" />
          <span className="sr-only">Voltar</span>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">{book.title}</h1>
          {book.author && <p className="text-lg text-muted-foreground">Por {book.author}</p>}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 border rounded-lg bg-card text-card-foreground leading-relaxed text-justify">
        {book.content ? (
          // Usar dangerouslySetInnerHTML para renderizar o conteúdo, se houver HTML
          // Caso contrário, apenas exibir o texto
          <div dangerouslySetInnerHTML={{ __html: book.content.replace(/\n/g, '<br />') }} />
        ) : (
          <p className="text-muted-foreground">Nenhum conteúdo de livro disponível para leitura.</p>
        )}
      </div>

      <div className="flex-1 flex items-end justify-center mt-8">
        <MadeWithDyad />
      </div>
    </div>
  );
};

export default BookReader;