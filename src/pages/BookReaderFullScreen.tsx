"use client";

import React, { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showError } from "@/utils/toast";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Document, Page, pdfjs } from "react-pdf"; // Importar pdfjs aqui
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { useIsMobile } from "@/hooks/use-mobile";

interface Book {
  id: string;
  title: string;
  pdf_url?: string;
  current_page?: number;
}

const fetchBookById = async (bookId: string): Promise<Book | null> => {
  const { data, error } = await supabase
    .from("books")
    .select("id, title, pdf_url, current_page")
    .eq("id", bookId)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }
  return data || null;
};

const BookReaderFullScreen: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const readerRef = useRef<HTMLDivElement>(null);

  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [isHovering, setIsHovering] = useState(false);
  const [touchStartX, setTouchStartX] = useState(0);

  const { data: book, isLoading, error } = useQuery<Book | null, Error>({
    queryKey: ["book-fullscreen", id],
    queryFn: () => fetchBookById(id!),
    enabled: !!id,
  });

  // Load initial page from book data if available
  useEffect(() => {
    if (book?.current_page) {
      setPageNumber(book.current_page);
    }
  }, [book?.current_page]);

  const updateCurrentPageInDb = async (newPage: number) => {
    if (!id) return;
    try {
      await supabase
        .from("books")
        .update({ current_page: newPage, last_read_date: new Date().toISOString().split('T')[0] })
        .eq("id", id);
    } catch (err) {
      console.error("Erro ao atualizar página atual no DB:", err);
    }
  };

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    // Ensure pageNumber is within bounds after loading document
    setPageNumber(prev => Math.max(1, Math.min(prev, numPages)));
  };

  const changePage = (offset: number) => {
    setPageNumber(prevPageNumber => {
      const newPage = Math.max(1, Math.min(prevPageNumber + offset, numPages || 1));
      if (newPage !== prevPageNumber) {
        updateCurrentPageInDb(newPage);
      }
      return newPage;
    });
  };

  const previousPage = () => changePage(-1);
  const nextPage = () => changePage(1);

  // Touch/Swipe handling for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const touchEndX = e.changedTouches[0].clientX;
    const swipeDistance = touchEndX - touchStartX;
    const swipeThreshold = 50; // pixels

    if (swipeDistance > swipeThreshold) {
      previousPage();
    } else if (swipeDistance < -swipeThreshold) {
      nextPage();
    }
  };

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
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-background text-foreground z-50">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <h1 className="text-3xl font-bold mt-4">Carregando Livro...</h1>
        <p className="text-lg text-muted-foreground">Preparando sua leitura.</p>
      </div>
    );
  }

  if (error) {
    showError("Erro ao carregar livro: " + error.message);
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-background text-foreground z-50">
        <h1 className="text-3xl font-bold">Erro ao Carregar Livro</h1>
        <p className="text-lg text-red-500">Ocorreu um erro: {error.message}</p>
        <Button onClick={() => navigate(`/books/${id}`)} className="w-fit bg-primary text-primary-foreground hover:bg-primary/90 mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para Detalhes do Livro
        </Button>
      </div>
    );
  }

  if (!book || !book.pdf_url) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-background text-foreground z-50">
        <h1 className="text-3xl font-bold">PDF Não Encontrado</h1>
        <p className="text-lg text-muted-foreground">O livro não possui um PDF ou não foi encontrado.</p>
        <Button onClick={() => navigate(`/books/${id}`)} className="w-fit bg-primary text-primary-foreground hover:bg-primary/90 mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para Detalhes do Livro
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-background text-foreground z-50">
      <div className="flex items-center justify-between p-4 bg-card border-b border-border shadow-sm">
        <Button variant="outline" size="icon" onClick={() => navigate(`/books/${id}`)} className="border-border text-foreground hover:bg-accent hover:text-accent-foreground">
          <ArrowLeft className="h-4 w-4" />
          <span className="sr-only">Voltar para Detalhes</span>
        </Button>
        <h1 className="text-xl font-bold text-foreground truncate">{book.title}</h1>
        <div className="flex items-center gap-2">
          {numPages && (
            <span className="text-sm text-muted-foreground">
              Página {pageNumber} de {numPages}
            </span>
          )}
        </div>
      </div>

      <div
        ref={readerRef}
        className="flex-1 flex items-center justify-center overflow-hidden relative"
        onMouseEnter={() => !isMobile && setIsHovering(true)}
        onMouseLeave={() => !isMobile && setIsHovering(false)}
        onTouchStart={isMobile ? handleTouchStart : undefined}
        onTouchEnd={isMobile ? handleTouchEnd : undefined}
      >
        <Document
          file={book.pdf_url}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={(error) => showError("Erro ao carregar PDF: " + error.message)}
          className="flex justify-center items-center h-full w-full"
          options={{
            cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
            cMapPacked: true,
          }}
        >
          <Page
            pageNumber={pageNumber}
            renderTextLayer={true}
            renderAnnotationLayer={true}
            className="shadow-lg border border-border"
            width={isMobile ? window.innerWidth * 0.9 : undefined} // Ajusta largura para mobile
            height={isMobile ? window.innerHeight * 0.8 : undefined} // Ajusta altura para mobile
          />
        </Document>

        {/* Navigation buttons for desktop on hover */}
        {!isMobile && isHovering && (
          <>
            <Button
              variant="ghost"
              size="icon"
              onClick={previousPage}
              disabled={pageNumber <= 1}
              className="absolute left-4 top-1/2 -translate-y-1/2 bg-background/50 hover:bg-background/70 text-foreground disabled:opacity-30"
            >
              <ChevronLeft className="h-6 w-6" />
              <span className="sr-only">Página Anterior</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={nextPage}
              disabled={pageNumber >= (numPages || 1)}
              className="absolute right-4 top-1/2 -translate-y-1/2 bg-background/50 hover:bg-background/70 text-foreground disabled:opacity-30"
            >
              <ChevronRight className="h-6 w-6" />
              <span className="sr-only">Próxima Página</span>
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export default BookReaderFullScreen;