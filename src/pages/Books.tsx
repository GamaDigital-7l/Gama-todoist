"use client";

import React from "react";
import { MadeWithDyad } from "@/components/made-with-dyad";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showError } from "@/utils/toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import BookForm from "@/components/BookForm";
import { Link } from "react-router-dom"; // Importar Link

interface Book {
  id: string;
  title: string;
  author?: string;
  cover_image_url?: string;
  description?: string;
  read_status: "unread" | "reading" | "finished";
  created_at: string;
  updated_at: string;
}

const fetchBooks = async (): Promise<Book[]> => {
  const { data, error } = await supabase.from("books").select("*").order("created_at", { ascending: false });
  if (error) {
    throw error;
  }
  return data || [];
};

const Books: React.FC = () => {
  const { data: books, isLoading, error, refetch } = useQuery<Book[], Error>({
    queryKey: ["books"],
    queryFn: fetchBooks,
  });

  const [isFormOpen, setIsFormOpen] = React.useState(false);

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col gap-4">
        <h1 className="text-3xl font-bold">Sua Biblioteca de Livros</h1>
        <p className="text-lg text-muted-foreground">Carregando seus livros...</p>
        <div className="flex-1 flex items-end justify-center">
          <MadeWithDyad />
        </div>
      </div>
    );
  }

  if (error) {
    showError("Erro ao carregar livros: " + error.message);
    return (
      <div className="flex flex-1 flex-col gap-4">
        <h1 className="text-3xl font-bold">Sua Biblioteca de Livros</h1>
        <p className="text-lg text-red-500">Erro ao carregar livros: {error.message}</p>
        <div className="flex-1 flex items-end justify-center">
          <MadeWithDyad />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Sua Biblioteca de Livros</h1>
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Livro
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Adicionar Novo Livro</DialogTitle>
            </DialogHeader>
            <BookForm onBookAdded={refetch} onClose={() => setIsFormOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>
      <p className="text-lg text-muted-foreground">
        Explore e gerencie seus livros favoritos.
      </p>

      {books && books.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {books.map((book) => (
            <Link to={`/books/${book.id}`} key={book.id} className="block"> {/* Envolve o Card com Link */}
              <Card className="flex flex-col overflow-hidden h-full hover:shadow-lg transition-shadow duration-200">
                <img
                  src={book.cover_image_url || "/placeholder.svg"}
                  alt={book.title}
                  className="w-full h-48 object-cover"
                />
                <CardHeader>
                  <CardTitle className="text-lg line-clamp-2">{book.title}</CardTitle>
                  <CardDescription className="line-clamp-1">{book.author}</CardDescription>
                </CardHeader>
                <CardContent className="flex-grow">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2
                      ${book.read_status === "reading" ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" : ""}
                      ${book.read_status === "unread" ? "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200" : ""}
                      ${book.read_status === "finished" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" : ""}
                    `}
                  >
                    {book.read_status === "reading" && "Lendo"}
                    {book.read_status === "unread" && "Não Lido"}
                    {book.read_status === "finished" && "Concluído"}
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground">Nenhum livro encontrado. Adicione um novo livro para começar!</p>
      )}

      <div className="flex-1 flex items-end justify-center">
        <MadeWithDyad />
      </div>
    </div>
  );
};

export default Books;