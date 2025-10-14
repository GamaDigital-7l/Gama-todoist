"use client";

import React, { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showError } from "@/utils/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input"; // Importar Input
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2, ZoomIn, ZoomOut, RotateCcw } from "lucide-react"; // Importar ícones de zoom
import { Document, Page, pdfjs, PDFDocumentProxy } from "react-pdf"; // Importar PDFDocumentProxy
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
  const readerRef = useRef<HTMLDivElement>(null); // Referência para o contêiner do leitor

  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [isHovering, setIsHovering] = useState(false);
  const [touchStartX, setTouchStartX] = useState(0);
  const [containerWidth, setContainerWidth] = useState<number | null>(null); // Estado para a largura do contêiner
  const [scale, setScale] = useState<number>(1.0); // Estado para o zoom
  const [initialScale, setInitialScale] = useState<number | null>(null); // Escala inicial para resetar o zoom
  const [pageInput, setPageInput] = useState<string>(""); // Estado para o input de página
  const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxy | null>(null); // Estado para o objeto PDFDocumentProxy

  const { data: book, isLoading, error } = useQuery<Book | null, Error>({
    queryKey: ["book-fullscreen", id],
    queryFn: () => fetchBookById(id!),
    enabled: !!id,
  });

  // Load initial page from book data if available
  useEffect(() => {
    if (book?.current_page) {
      setPageNumber(book.current_page);
      setPageInput(String(book.current_page));
    }
  }, [book?.current_page]);

  // Observar o redimensionamento do contêiner para ajustar a largura do PDF
  useEffect(() => {
    const updateContainerWidth = () => {
      if (readerRef.current) {
        setContainerWidth(readerRef.current.clientWidth);
      }
    };

    updateContainerWidth(); // Define a largura inicial

    const resizeObserver = new ResizeObserver(updateContainerWidth);
    if (readerRef.current) {
      resizeObserver.observe(readerRef.current);
    }

    return () => {
      if (readerRef.current) {
        resizeObserver.unobserve(readerRef.current);
      }
    };
  }, [readerRef]);

  // Efeito para calcular a escala inicial uma vez que o documento e a largura do contêiner estejam prontos
  useEffect(() => {
    const calculateScale = async () => {
      if (pdfDocument && readerRef.current && initialScale === null) { // Só calcula uma vez
        try {
          const page = await pdfDocument.getPage(1);
          const viewport = page.getViewport({ scale: 1 });
          const calculatedScale = readerRef.current.clientWidth / viewport.width;
          setScale(calculatedScale);
          setInitialScale(calculatedScale);
        } catch (err) {
          console.error("Erro ao calcular escala inicial:", err);
          showError("Erro ao calcular escala inicial do PDF.");
        }
      }
    };
    calculateScale();
  }, [pdfDocument, containerWidth, initialScale]); // Depende de pdfDocument e containerWidth

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

  const onDocumentLoadSuccess = (pdf: PDFDocumentProxy) => {
    setNumPages(pdf.numPages);
    setPdfDocument(pdf); // Armazena o objeto PDFDocumentProxy
    const initialPage = Math.max(1, Math.min(book?.current_page || 1, pdf.numPages));
    setPageNumber(initialPage);
    setPageInput(String(initialPage));
  };

  const changePage = (offset: number) => {
    setPageNumber(prevPageNumber => {
      const newPage = Math.max(1, Math.min(prevPageNumber + offset, numPages || 1));
      if (newPage !== prevPageNumber) {
        updateCurrentPageInDb(newPage);
        setPageInput(String(newPage));
      }
      return newPage;
    });
  };

  const previousPage = () => changePage(-1);
  const nextPage = () => changePage(1);

  const zoomIn = () => setScale(prev => Math.min(prev + 0.2, 3.0)); // Zoom máximo 3.0
  const zoomOut = () => setScale(prev => Math.max(prev - 0.2, initialScale || 0.5)); // Zoom mínimo, não menor que o ajuste inicial
  const resetZoom = () => setScale(initialScale || 1.0);

  const handlePageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPageInput(e.target.value);
  };

  const goToPage = () => {
    const newPage = parseInt(pageInput, 10);
    if (!isNaN(newPage) && newPage >= 1 && newPage <= (numPages || 1)) {
      setPageNumber(newPage);
      updateCurrentPageInDb(newPage);
    } else {
      showError(`Por favor, insira um número de página válido entre 1 e ${numPages || 1}.`);
      setPageInput(String(pageNumber)); // Reseta o input para a página atual
    }
  };

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
      <div className="flex items-center justify-between p-4 bg-card border-b border-border shadow-sm flex-wrap gap-2">
        <Button variant="outline" size="icon" onClick={() => navigate(`/books/${id}`)} className="border-border text-foreground hover:bg-accent hover:text-accent-foreground">
          <ArrowLeft className="h-4 w-4" />
          <span className="sr-only">Voltar para Detalhes</span>
        </Button>
        <h1 className="text-xl font-bold text-foreground truncate flex-1 text-center sm:text-left">{book.title}</h1>
        <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-end">
          <Button variant="outline" size="icon" onClick={zoomOut} disabled={scale <= (initialScale || 0.5)} className="border-border text-foreground hover:bg-accent hover:text-accent-foreground">
            <ZoomOut className="h-4 w-4" />
            <span className="sr-only">Diminuir Zoom</span>
          </Button>
          <Button variant="outline" size="icon" onClick={zoomIn} disabled={scale >= 3.0} className="border-border text-foreground hover:bg-accent hover:text-accent-foreground">
            <ZoomIn className="h-4 w-4" />
            <span className="sr-only">Aumentar Zoom</span>
          </Button>
          <Button variant="outline" size="icon" onClick={resetZoom} disabled={scale === initialScale} className="border-border text-foreground hover:bg-accent hover:text-accent-foreground">
            <RotateCcw className="h-4 w-4" />
            <span className="sr-only">Resetar Zoom</span>
          </Button>
          <div className="flex items-center gap-1">
            <Input
              type="number"
              value={pageInput}
              onChange={handlePageInputChange}
              onKeyPress={(e) => e.key === "Enter" && goToPage()}
              min="1"
              max={numPages || 1}
              className="w-16 text-center bg-input border-border text-foreground focus-visible:ring-ring"
            />
            {numPages && (
              <span className="text-sm text-muted-foreground">
                / {numPages}
              </span>
            )}
            <Button onClick={goToPage} size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">Ir</Button>
          </div>
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
        {containerWidth && ( // Renderiza o Document apenas quando a largura do contêiner é conhecida
          <Document
            file={book.pdf_url}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={(error) => showError("Erro ao carregar PDF: " + error.message)}
            className="flex justify-center items-center h-full w-full"
            options={{
              cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
              cMapPacked: true,
            }}
            loading={<Loader2 className="h-12 w-12 animate-spin text-primary" />}
          >
            <Page
              pageNumber={pageNumber}
              renderTextLayer={true}
              renderAnnotationLayer={true}
              className="shadow-lg border border-border"
              scale={scale} // Usa a escala para o zoom
              loading={<Loader2 className="h-8 w-8 animate-spin text-primary" />}
            />
          </Document>
        )}

        {/* Navigation buttons for desktop on hover */}
        {!isMobile && (
          <>
            <Button
              variant="ghost"
              size="icon"
              onClick={previousPage}
              disabled={pageNumber <= 1}
              className={`absolute left-4 top-1/2 -translate-y-1/2 bg-background/50 hover:bg-background/70 text-foreground disabled:opacity-30 transition-opacity duration-200 ${
                isHovering ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
            >
              <ChevronLeft className="h-6 w-6" />
              <span className="sr-only">Página Anterior</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={nextPage}
              disabled={pageNumber >= (numPages || 1)}
              className={`absolute right-4 top-1/2 -translate-y-1/2 bg-background/50 hover:bg-background/70 text-foreground disabled:opacity-30 transition-opacity duration-200 ${
                isHovering ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
            >
              <ChevronRight className="h-6 w-6" />
              <span className="sr-only">Próxima Página</span>
            </Button>
          </>
        )}

        {/* Tap areas for mobile navigation */}
        {isMobile && (
          <>
            <div
              className="absolute left-0 top-0 h-full w-1/2 cursor-pointer z-10"
              onClick={previousPage}
            />
            <div
              className="absolute right-0 top-0 h-full w-1/2 cursor-pointer z-10"
              onClick={nextPage}
            />
          </>
        )}
      </div>
    </div>
  );
};

export default BookReaderFullScreen;