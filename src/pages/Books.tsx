"use client";

import React from "react";
import { MadeWithDyad } from "@/components/made-with-dyad";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";

const Books: React.FC = () => {
  // Futuramente, aqui será onde buscaremos e exibiremos os livros do Supabase
  const books = [
    { id: "1", title: "O Senhor dos Anéis", author: "J.R.R. Tolkien", cover_image_url: "https://m.media-amazon.com/images/I/71j+N+e4-HL._AC_UF1000,1000_QL80_.jpg", read_status: "reading" },
    { id: "2", title: "1984", author: "George Orwell", cover_image_url: "https://m.media-amazon.com/images/I/71+k43vQyNL._AC_UF1000,1000_QL80_.jpg", read_status: "unread" },
    { id: "3", title: "Pequeno Príncipe", author: "Antoine de Saint-Exupéry", cover_image_url: "https://m.media-amazon.com/images/I/71yJg2b-XBL._AC_UF1000,1000_QL80_.jpg", read_status: "finished" },
  ];

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Sua Biblioteca de Livros</h1>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Livro
        </Button>
      </div>
      <p className="text-lg text-muted-foreground">
        Explore e gerencie seus livros favoritos.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {books.map((book) => (
          <Card key={book.id} className="flex flex-col overflow-hidden">
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
        ))}
      </div>

      <div className="flex-1 flex items-end justify-center">
        <MadeWithDyad />
      </div>
    </div>
  );
};

export default Books;