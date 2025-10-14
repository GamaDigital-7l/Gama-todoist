"use client";

import React from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showError } from "@/utils/toast";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, BookOpen } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface Book {
  id: string;
  title: string;
  author?: string;
  description?: string;
  content?: string;
  cover_image_url?: string;
  pdf_url?: string;
}

const fetchBookById = async (bookId: string): Promise<Book | null> => {
  const { data, error } = await supabase
    .from("books")
    .select("id, title, author, description, content, cover_image_url, pdf_url")
    .eq("id", bookId)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }
  return data || null;
};

const BookDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: book, isLoading, error } = useQuery<Book | null, Error>({
    queryKey: ["book", id],
    queryFn: () => fetchBookById(id!),
    enabled: !!id,
  });

  if (!id) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6 bg-background text-foreground">
        <h1 className="text-3xl font-bold">Livro Não Encontrado</h1>
        <p className="text-lg text-muted-foreground">O ID do livro não foi fornecido.</p>
        <Button onClick={() => navigate("/books")} className="w-fit bg-primary text-primary-foreground hover:bg-primary/90">
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para a Biblioteca
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-4 lg:p-6 bg-background text-foreground">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <h1 className="text-3xl font-bold">Carregando Livro...</h1>
        <p className="text-lg text-muted-foreground">Preparando os detalhes do livro.</p>
      </div>
    );
  }

  if (error) {
    showError("Erro ao carregar livro: " + error.message);
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6 bg-background text-foreground">
        <h1 className="text-3xl font-bold">Erro ao Carregar Livro</h1>
        <p className="text-lg text-red-500">Ocorreu um erro: {error.message}</p>
        <Button onClick={() => navigate("/books")} className="w-fit bg-primary text-primary-foreground hover:bg-primary/90">
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para a Biblioteca
        </Button>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6 bg-background text-foreground">
        <h1 className="text-3xl font-bold">Livro Não Encontrado</h1>
        <p className="text-lg text-muted-foreground">O livro que você está procurando não existe ou foi removido.</p>
        <Button onClick={() => navigate("/books")} className="w-fit bg-primary text-primary-foreground hover:bg-primary/90">
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para a Biblioteca
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6 bg-background text-foreground">
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        <Button variant="outline" size="icon" onClick={() => navigate("/books")} className="border-border text-foreground hover:bg-accent hover:text-accent-foreground">
          <ArrowLeft className="h-4 w-4" />
          <span className="sr-only">Voltar</span>
        </Button>
        <div>
          <h1 className="text-3xl font-bold break-words">{book.title}</h1>
          {book.author && <p className="text-lg text-muted-foreground break-words">Por {book.author}</p>}
        </div>
      </div>

      <Card className="bg-card border border-border rounded-lg shadow-sm">
        <CardHeader>
          <CardTitle className="text-foreground">Detalhes do Livro</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {book.cover_image_url && (
            <img src={book.cover_image_url} alt={book.title} className="w-48 h-auto rounded-md object-cover mx-auto" />
          )}
          {book.description && (
            <div>
              <h3 className="text-lg font-semibold text-foreground">Descrição:</h3>
              <p className="text-muted-foreground break-words">{book.description}</p>
            </div>
          )}

          {book.pdf_url && (
            <Link to={`/books/${book.id}/read`}>
              <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                <BookOpen className="mr-2 h-4 w-4" /> Ler PDF em Tela Cheia
              </Button>
            </Link>
          )}

          {book.content && !book.pdf_url && (
            <div>
              <h3 className="text-lg font-semibold text-foreground">Conteúdo:</h3>
              <div className="prose dark:prose-invert max-w-none text-foreground">
                <div dangerouslySetInnerHTML={{ __html: book.content.replace(/\n/g, '<br />') }} />
              </div>
            </div>
          )}

          {!book.pdf_url && !book.content && (
            <p className="text-muted-foreground">Nenhum conteúdo de livro ou PDF disponível para leitura.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default BookDetails;