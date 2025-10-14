"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { Document, Page, pdfjs } from "react-pdf";
import { PDFDocumentProxy } from "pdfjs-dist/types/src/display/api"; // Importação corrigida para PDFDocumentProxy
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

interface BookReaderFullScreenProps {
  bookUrl: string;
  onClose: () => void;
}

const BookReaderFullScreen: React.FC<BookReaderFullScreenProps> = ({ bookUrl, onClose }) => {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [rotation, setRotation] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);

  const onDocumentLoadSuccess = ({ numPages }: PDFDocumentProxy) => {
    setNumPages(numPages);
    setLoading(false);
    setError(null);
  };

  const onDocumentLoadError = (err: Error) => {
    console.error("Failed to load PDF:", err);
    setError("Não foi possível carregar o PDF. Verifique a URL ou tente novamente.");
    setLoading(false);
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

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background text-foreground">
      {/* Top Bar */}
      <div className="flex items-center justify-between p-2 border-b border-border bg-card shadow-sm">
        <Button variant="ghost" size="icon" onClick={onClose}>
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
        {loading && (
          <div className="flex flex-col items-center text-muted-foreground">
            <Loader2 className="h-10 w-10 animate-spin mb-4" />
            <p>Carregando livro...</p>
          </div>
        )}
        {error && (
          <div className="text-center text-red-500">
            <p>{error}</p>
            <Button onClick={onClose} className="mt-4">Voltar</Button>
          </div>
        )}
        {!loading && !error && (
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