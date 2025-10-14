"use client";

import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showError } from "@/utils/toast";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Definir o workerSrc para uma versão específica do pdfjs-dist que seja compatível com react-pdf v10.x
// A versão 4.4.168 é uma versão estável da série 4.x que geralmente funciona bem.
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@4.4.168/build/pdf.worker.min.js`;

interface Book {
  id: string;
  title: string;
  author?: string;
  content?: string;
  pdf_url?: string;
}

const fetchBookById = async (bookId: string): Promise<Book | null> => {
  const { data, error } = await supabase
    .from("books")
    .select("id, title, author, content, pdf_url")
    .eq("id", bookId)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }
  return data || null;
};

const BookReader: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState<number>(1);

  const { data: book, isLoading, error } = useQuery<Book | null, Error>({
    queryKey: ["book", id],
    queryFn: () => fetchBookById(id!),
    enabled: !!id,
  });

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setPageNumber(1);
  };

  const changePage = (offset: number) => {
    setPageNumber(prevPageNumber => Math.max(1, Math.min(prevPageNumber + offset, numPages || 1)));
  };

  const previousPage = () => changePage(-1);
  const nextPage = () => changePage(1);

  if (!id) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6 bg-background text-foreground">
        <h1 className="text-3xl font-bold">Livro Não Encontrado</h1>
        <p className="text-lg text-muted-foreground">O ID do livro não foi fornecido.</p>
        <Button onClick={() => navigate("/books")} className="w-fit bg-primary text-primary-foreground hover:bg-primary/90">
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para a Biblioteca
        </Button>
        {/* MadeWithDyad removido */}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-4 lg:p-6 bg-background text-foreground">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <h1 className="text-3xl font-bold">Carregando Livro...</h1>
        <p className="text-lg text-muted-foreground">Preparando sua leitura.</p>
        {/* MadeWithDyad removido */}
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
        {/* MadeWithDyad removido */}
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
        {/* MadeWithDyad removido */}
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6 bg-background text-foreground">
      <div className="flex items-center gap-4 mb-4">
        <Button variant="outline" size="icon" onClick={() => navigate("/books")} className="border-border text-foreground hover:bg-accent hover:text-accent-foreground">
          <ArrowLeft className="h-4 w-4" />
          <span className="sr-only">Voltar</span>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">{book.title}</h1>
          {book.author && <p className="text-lg text-muted-foreground">Por {book.author}</p>}
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-4 border border-border rounded-lg bg-card text-card-foreground overflow-hidden shadow-sm">
        {book.pdf_url ? (
          <>
            <div className="flex-1 overflow-auto w-full flex justify-center">
              <Document
                file={book.pdf_url}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={(error) => showError("Erro ao carregar PDF: " + error.message)}
                className="max-w-full h-full"
                options={{
                  cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
                  cMapPacked: true,
                }}
              >
                <Page pageNumber={pageNumber} renderTextLayer={true} renderAnnotationLayer={true} />
              </Document>
            </div>
            {numPages && (
              <div className="flex items-center gap-4 mt-4">
                <Button onClick={previousPage} disabled={pageNumber <= 1} className="bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed">
                  Página Anterior
                </Button>
                <p className="text-sm text-muted-foreground">
                  Página {pageNumber} de {numPages}
                </p>
                <Button onClick={nextPage} disabled={pageNumber >= numPages} className="bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed">
                  Próxima Página
                </Button>
              </div>
            )}
          </>
        ) : book.content ? (
          <div className="flex-1 overflow-y-auto p-4 w-full leading-relaxed text-justify text-foreground">
            <div dangerouslySetInnerHTML={{ __html: book.content.replace(/\n/g, '<br />') }} />
          </div>
        ) : (
          <p className="text-muted-foreground">Nenhum conteúdo de livro ou PDF disponível para leitura.</p>
        )}
      </div>

      {/* MadeWithDyad removido */}
    </div>
  );
};

export default BookReader;