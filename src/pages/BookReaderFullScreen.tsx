"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { Document, Page, pdfjs } from "react-pdf";
// Importação corrigida para PDFDocumentProxy - usando uma interface local para robustez
// import { PDFDocumentProxy } from "react-pdf/dist/esm/shared/types"; // Removido
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showError } from "@/utils/toast";

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

interface Book {
  id: string;
  title: string;
  pdf_url?: string;
}

// Interface local para o objeto retornado por onLoadSuccess
interface LocalPDFDocumentProxy {
  numPages: number;
}

const BookReaderFullScreen: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [rotation, setRotation] = useState<number>(0);
  const [loadingPdf, setLoadingPdf] = useState<boolean>(true);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const { toast } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);

  const fetchBookById = async (bookId: string): Promise<Book | null> => {
    const { data, error } = await supabase
      .from("books")
      .select("id, title, pdf_url")
      .eq("id", bookId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }
    return data || null;
  };

  const { data: book, isLoading: isLoadingBook, error: bookFetchError } = useQuery<Book | null, Error>({
    queryKey: ["bookPdf", id],
    queryFn: () => fetchBookById(id!),
    enabled: !!id,
  });

  const bookUrl = book?.pdf_url;

  const onDocumentLoadSuccess = ({ numPages }: LocalPDFDocumentProxy) => {
    setNumPages(numPages);
    setLoadingPdf(false);
    setPdfError(null);
  };

  const onDocumentLoadError = (err: Error) => {
    console.error("Failed to load PDF:", err);
    setPdfError("Não foi possível carregar o PDF. Verifique a URL ou tente novamente.");
    setLoadingPdf(false);
    toast({
      title: "Erro ao carregar livro",
      description: "Não foi possível carregar o PDF. Verifique a URL ou tente novamente.",
      variant: "destructive",
    });
  };

  const changePage = (offset: number) => {
    setPageNumber((prevPageNumber) => {
      const newPage = prevPageNumber + offset;
      if (numPages && newPage >= 1 && newPage <= numPages) {
        return newPage;
      }
      return prevPageNumber;
    });
  };

  const goToPage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const page = Number(e.target.value);
    if (numPages && page >= 1 && page <= numPages) {
      setPageNumber(page);
    } else if (page < 1) {
      setPageNumber(1);
    } else if (numPages && page > numPages) {
      setPageNumber(numPages);
    }
  };

  const zoomIn = () => setScale((prevScale) => Math.min(prevScale + 0.2, 3.0));
  const zoomOut = () => setScale((prevScale) => Math.max(prevScale - 0.2, 0.5));
  const rotate = () => setRotation((prevRotation) => (prevRotation + 90) % 360);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === "ArrowRight") {
      changePage(1);
    } else if (event.key === "ArrowLeft") {
      changePage(-1);
    }
  }, [changePage]);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };

    handleResize(); // Set initial width
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleClose = () => {
    navigate(`/books/${id}`); // Navegar de volta para a página de detalhes do livro
  };

  if (!id) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6 bg-background text-foreground">
        <h1 className="text-3xl font-bold">Erro</h1>
        <p className="text-lg text-muted-foreground">ID do livro não fornecido.</p>
        <Button onClick={() => navigate("/books")} className="w-fit bg-primary text-primary-foreground hover:bg-primary/90">
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para a Biblioteca
        </Button>
      </div>
    );
  }

  if (isLoadingBook) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background text-foreground">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <h1 className="text-3xl font-bold mt-4">Carregando detalhes do livro...</h1>
      </div>
    );
  }

  if (bookFetchError) {
    showError("Erro ao carregar detalhes do livro: " + bookFetchError.message);
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background text-foreground">
        <h1 className="text-3xl font-bold text-red-500">Erro ao Carregar Livro</h1>
        <p className="text-lg text-muted-foreground">Ocorreu um erro: {bookFetchError.message}</p>
        <Button onClick={() => navigate("/books")} className="mt-4 w-fit bg-primary text-primary-foreground hover:bg-primary/90">
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para a Biblioteca
        </Button>
      </div>
    );
  }

  if (!book || !bookUrl) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background text-foreground">
        <h1 className="text-3xl font-bold">PDF Não Encontrado</h1>
        <p className="text-lg text-muted-foreground">O PDF para este livro não está disponível.</p>
        <Button onClick={handleClose} className="mt-4 w-fit bg-primary text-primary-foreground hover:bg-primary/90">
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para Detalhes do Livro
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background text-foreground">
      {/* Top Bar */}
      <div className="flex items-center justify-between p-2 border-b border-border bg-card shadow-sm">
        <Button variant="ghost" size="icon" onClick={handleClose}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={zoomOut}>
            <ZoomOut className="h-5 w-5" />
          </Button>
          <Slider
            value={[scale]}
            onValueChange={(val) => setScale(val[0])}
            min={0.5}
            max={3.0}
            step={0.1}
            className="w-24"
          />
          <Button variant="ghost" size="icon" onClick={zoomIn}>
            <ZoomIn className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={rotate}>
            <RotateCcw className="h-5 w-5" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => changePage(-1)} disabled={pageNumber <= 1}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Input
            type="number"
            value={pageNumber}
            onChange={goToPage}
            className="w-16 text-center bg-input border-border text-foreground"
            min={1}
            max={numPages || 1}
          />
          <span className="text-muted-foreground">/ {numPages || "..."}</span>
          <Button variant="ghost" size="icon" onClick={() => changePage(1)} disabled={numPages === null || pageNumber >= numPages}>
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* PDF Viewer Area */}
      <div ref={containerRef} className="flex-1 overflow-auto flex justify-center items-center p-4">
        {(isLoadingBook || loadingPdf) && (
          <div className="flex flex-col items-center text-muted-foreground">
            <Loader2 className="h-10 w-10 animate-spin mb-4" />
            <p>Carregando livro...</p>
          </div>
        )}
        {pdfError && (
          <div className="text-center text-red-500">
            <p>{pdfError}</p>
            <Button onClick={handleClose} className="mt-4">Voltar</Button>
          </div>
        )}
        {!isLoadingBook && !loadingPdf && !pdfError && bookUrl && (
          <Document
            file={bookUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            className="flex justify-center items-center"
          >
            <Page
              pageNumber={pageNumber}
              scale={scale}
              rotate={rotation}
              width={containerWidth ? Math.min(containerWidth * 0.9, 1000) : undefined} // Adjust max width for better viewing
              renderAnnotationLayer={true}
              renderTextLayer={true}
              className="shadow-lg border border-border"
            />
          </Document>
        )}
      </div>
    </div>
  );
};

export default BookReaderFullScreen;