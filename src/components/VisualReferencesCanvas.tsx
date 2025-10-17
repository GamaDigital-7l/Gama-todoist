"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { useSession } from "@/integrations/supabase/auth";
import { VisualReferenceElement } from "@/types/client";
import VisualReferenceImage from "./VisualReferenceImage";
import VisualReferenceText from "./VisualReferenceText";
import { PlusCircle, Type, Link, Upload, Save, ZoomIn, ZoomOut, RefreshCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { v4 as uuidv4 } from 'uuid'; // Para gerar IDs únicos

// Importar react-easy-panzoom
import PanZoom from 'react-easy-panzoom';

interface VisualReferencesCanvasProps {
  moodboardId: string; // Alterado de clientId
}

const BUCKET_NAME = "client-visual-references"; // Define o nome do bucket como uma constante

const fetchVisualReferences = async (moodboardId: string, userId: string): Promise<VisualReferenceElement[]> => {
  const { data, error } = await supabase
    .from("client_visual_references")
    .select("*")
    .eq("moodboard_id", moodboardId) // Alterado de client_id
    .eq("user_id", userId)
    .order("z_index", { ascending: true });
  if (error) {
    throw error;
  }
  return data || [];
};

const sanitizeFilename = (filename: string) => {
  return filename
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9.]/g, "-")
    .replace(/--+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
};

const VisualReferencesCanvas: React.FC<VisualReferencesCanvasProps> = ({ moodboardId }) => { // Alterado de clientId
  const { session } = useSession();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();

  const { data: elements, isLoading, error, refetch } = useQuery<VisualReferenceElement[], Error>({
    queryKey: ["clientVisualReferences", moodboardId, userId], // Alterado queryKey
    queryFn: () => fetchVisualReferences(moodboardId, userId!), // Alterado queryFn
    enabled: !!moodboardId && !!userId, // Alterado enabled condition
  });

  const [isToolbarVisible, setIsToolbarVisible] = useState(true);
  const [isAddImageUrlModalOpen, setIsAddImageUrlModalOpen] = useState(false);
  const [imageUrlInput, setImageUrlInput] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);

  const panZoomRef = useRef<any>(null); // Ref para o componente PanZoom

  const updateElementMutation = useMutation({
    mutationFn: async (updatedElement: Partial<VisualReferenceElement> & { id: string }) => {
      if (!userId) throw new Error("Usuário não autenticado.");
      const { error } = await supabase
        .from("client_visual_references")
        .update({ ...updatedElement, updated_at: new Date().toISOString() })
        .eq("id", updatedElement.id)
        .eq("moodboard_id", moodboardId) // Alterado de client_id
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientVisualReferences", moodboardId, userId] }); // Alterado queryKey
    },
    onError: (err: any) => {
      showError("Erro ao atualizar elemento: " + err.message);
      console.error("Erro ao atualizar elemento:", err);
    },
  });

  const addElementMutation = useMutation({
    mutationFn: async (newElement: Omit<VisualReferenceElement, "id" | "created_at" | "updated_at">) => {
      if (!userId) throw new Error("Usuário não autenticado.");
      const { data, error } = await supabase
        .from("client_visual_references")
        .insert({ ...newElement, user_id: userId, moodboard_id: moodboardId }) // Alterado client_id para moodboard_id
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      refetch();
      showSuccess("Elemento adicionado com sucesso!");
    },
    onError: (err: any) => {
      showError("Erro ao adicionar elemento: " + err.message);
      console.error("Erro ao adicionar elemento:", err);
    },
  });

  const deleteElementMutation = useMutation({
    mutationFn: async (elementId: string) => {
      if (!userId) throw new Error("Usuário não autenticado.");
      const { error } = await supabase
        .from("client_visual_references")
        .delete()
        .eq("id", elementId)
        .eq("moodboard_id", moodboardId) // Alterado de client_id
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      refetch();
      showSuccess("Elemento deletado com sucesso!");
    },
    onError: (err: any) => {
      showError("Erro ao deletar elemento: " + err.message);
      console.error("Erro ao deletar elemento:", err);
    },
  });

  const handleUpdateElement = (id: string, data: Partial<VisualReferenceElement>) => {
    updateElementMutation.mutate({ id, ...data });
  };

  const handleDeleteElement = (id: string) => {
    if (window.confirm("Tem certeza que deseja remover este elemento?")) {
      deleteElementMutation.mutate(id);
    }
  };

  const handleAddText = () => {
    const newTextElement: Omit<VisualReferenceElement, "id" | "created_at" | "updated_at"> = {
      moodboard_id: moodboardId, // Alterado de client_id
      user_id: userId!,
      element_type: "text",
      content: "Nova Nota",
      x: window.innerWidth / 2 - 100, // Posição inicial centralizada
      y: window.innerHeight / 2 - 50,
      width: 200,
      height: 100,
      z_index: (elements?.length || 0) + 1,
      metadata: {
        backgroundColor: "hsl(var(--secondary))",
        fontColor: "hsl(var(--foreground))",
        fontSize: "1rem",
      },
    };
    addElementMutation.mutate(newTextElement);
  };

  const handleAddImageFromUrl = async () => {
    if (!imageUrlInput.trim()) {
      showError("Por favor, insira uma URL de imagem válida.");
      return;
    }
    if (!userId) {
      showError("Usuário não autenticado.");
      return;
    }

    setIsUploading(true);
    try {
      const response = await fetch(imageUrlInput);
      if (!response.ok) throw new Error("Não foi possível baixar a imagem da URL fornecida.");

      const blob = await response.blob();
      const filename = imageUrlInput.substring(imageUrlInput.lastIndexOf('/') + 1).split('?')[0];
      const sanitizedFilename = sanitizeFilename(filename || `image-${Date.now()}.png`);
      // Caminho de armazenamento atualizado para incluir moodboardId
      const filePath = `client_visual_references/${moodboardId}/${userId}/${Date.now()}-${sanitizedFilename}`;

      console.log("Uploading to bucket:", BUCKET_NAME, "with path:", filePath); // Log de depuração
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, blob, {
          cacheControl: "3600",
          upsert: false,
          contentType: blob.type,
        });

      if (uploadError) throw new Error("Erro ao fazer upload da imagem: " + uploadError.message);

      const { data: publicUrlData } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(filePath);

      const newImageElement: Omit<VisualReferenceElement, "id" | "created_at" | "updated_at"> = {
        moodboard_id: moodboardId, // Alterado de client_id
        user_id: userId,
        element_type: "image",
        content: publicUrlData.publicUrl,
        x: window.innerWidth / 2 - 100,
        y: window.innerHeight / 2 - 100,
        width: 200,
        height: 200,
        z_index: (elements?.length || 0) + 1,
      };
      await addElementMutation.mutateAsync(newImageElement);
      setImageUrlInput("");
      setIsAddImageUrlModalOpen(false);
      showSuccess("Imagem adicionada com sucesso!");
    } catch (err: any) {
      showError("Erro ao adicionar imagem da URL: " + err.message);
      console.error("Erro ao adicionar imagem da URL:", err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!userId) {
      showError("Usuário não autenticado.");
      return;
    }
    setIsUploading(true);
    try {
      const sanitizedFilename = sanitizeFilename(file.name);
      // Caminho de armazenamento atualizado para incluir moodboardId
      const filePath = `client_visual_references/${moodboardId}/${userId}/${Date.now()}-${sanitizedFilename}`;

      console.log("Uploading to bucket:", BUCKET_NAME, "with path:", filePath); // Log de depuração
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type,
        });

      if (uploadError) throw new Error("Erro ao fazer upload da imagem: " + uploadError.message);

      const { data: publicUrlData } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(filePath);

      const newImageElement: Omit<VisualReferenceElement, "id" | "created_at" | "updated_at"> = {
        moodboard_id: moodboardId, // Alterado de client_id
        user_id: userId,
        element_type: "image",
        content: publicUrlData.publicUrl,
        x: window.innerWidth / 2 - 100,
        y: window.innerHeight / 2 - 100,
        width: 200,
        height: 200,
        z_index: (elements?.length || 0) + 1,
      };
      await addElementMutation.mutateAsync(newImageElement);
      showSuccess("Imagem adicionada com sucesso!");
    } catch (err: any) {
      showError("Erro ao fazer upload da imagem: " + err.message);
      console.error("Erro ao fazer upload da imagem:", err);
    } finally {
      setIsUploading(false);
    }
  };

  const handlePaste = useCallback(async (event: ClipboardEvent) => {
    if (!userId) return;

    const items = event.clipboardData?.items;
    if (items) {
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const blob = item.getAsFile();
          if (blob) {
            await handleFileUpload(blob);
            event.preventDefault(); // Prevenir comportamento padrão de colar
            return;
          }
        } else if (item.type === 'text/plain') {
          const text = event.clipboardData?.getData('text/plain');
          if (text && (text.startsWith('http://') || text.startsWith('https://')) && (text.includes('.jpg') || text.includes('.png') || text.includes('.gif'))) {
            setImageUrlInput(text);
            setIsAddImageUrlModalOpen(true);
            event.preventDefault();
            return;
          }
        }
      }
    }
  }, [userId, moodboardId, addElementMutation, handleFileUpload]); // Alterado clientId para moodboardId

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDrop = useCallback(async (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!userId) {
      showError("Usuário não autenticado.");
      return;
    }

    const files = event.dataTransfer.files;
    if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        if (files[i].type.startsWith('image/')) {
          await handleFileUpload(files[i]);
        }
      }
    } else {
      const text = event.dataTransfer.getData('text/plain');
      if (text && (text.startsWith('http://') || text.startsWith('https://')) && (text.includes('.jpg') || text.includes('.png') || text.includes('.gif'))) {
        setImageUrlInput(text);
        setIsAddImageUrlModalOpen(true);
      }
    }
  }, [userId, moodboardId, addElementMutation, handleFileUpload]); // Alterado clientId para moodboardId

  useEffect(() => {
    document.addEventListener('paste', handlePaste);
    return () => {
      document.removeEventListener('paste', handlePaste);
    };
  }, [handlePaste]);

  const handleSelectElement = (id: string) => {
    setSelectedElementId(id);
  };

  const handleDeselectAll = (event: React.MouseEvent) => {
    // Desselecionar se o clique for no próprio canvas, não em um elemento
    if ((event.target as HTMLElement).id === "visual-references-canvas-container") {
      setSelectedElementId(null);
    }
  };

  const handleResetView = () => {
    if (panZoomRef.current) {
      panZoomRef.current.reset();
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-full text-muted-foreground">Carregando referências visuais...</div>;
  }

  if (error) {
    return <div className="flex items-center justify-center h-full text-red-500">Erro ao carregar referências visuais: {error.message}</div>;
  }

  return (
    <div
      className="relative flex-grow w-full h-full overflow-hidden rounded-lg bg-[#2b2b2b] dark:bg-gray-900"
      onMouseEnter={() => setIsToolbarVisible(true)}
      onMouseLeave={() => setIsToolbarVisible(false)}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={handleDeselectAll}
      id="visual-references-canvas-container"
    >
      {/* Toolbar */}
      <div
        className={`absolute top-4 left-1/2 -translate-x-1/2 flex gap-2 p-2 bg-card border border-border rounded-md shadow-lg z-50 transition-opacity duration-300 ${
          isToolbarVisible ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <Button size="sm" onClick={handleAddText} className="bg-primary text-primary-foreground hover:bg-primary/90">
          <Type className="h-4 w-4 mr-1" /> Texto
        </Button>
        <Dialog open={isAddImageUrlModalOpen} onOpenChange={setIsAddImageUrlModalOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Link className="h-4 w-4 mr-1" /> URL Imagem
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px] bg-card border border-border rounded-lg shadow-lg">
            <DialogHeader>
              <DialogTitle className="text-foreground">Adicionar Imagem por URL</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Cole a URL da imagem que deseja adicionar ao canvas.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="imageUrl" className="text-foreground">URL da Imagem</Label>
                <Input
                  id="imageUrl"
                  value={imageUrlInput}
                  onChange={(e) => setImageUrlInput(e.target.value)}
                  placeholder="https://exemplo.com/imagem.jpg"
                  className="w-full bg-input border-border text-foreground focus-visible:ring-ring"
                />
              </div>
              <Button onClick={handleAddImageFromUrl} disabled={isUploading} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                {isUploading ? "Adicionando..." : "Adicionar Imagem"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        <Button size="sm" onClick={() => document.getElementById('file-upload-input')?.click()} className="bg-primary text-primary-foreground hover:bg-primary/90">
          <Upload className="h-4 w-4 mr-1" /> Upload
        </Button>
        <input
          id="file-upload-input"
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) {
              Array.from(e.target.files).forEach(file => handleFileUpload(file));
              e.target.value = ''; // Reset input
            }
          }}
        />
        <Button size="sm" onClick={() => showSuccess("Funcionalidade de salvar manual em desenvolvimento!")} className="bg-secondary text-secondary-foreground hover:bg-secondary/90">
          <Save className="h-4 w-4 mr-1" /> Salvar Cena
        </Button>
        <Button size="sm" onClick={handleResetView} className="bg-secondary text-secondary-foreground hover:bg-secondary/90">
          <RefreshCcw className="h-4 w-4 mr-1" /> Reset View
        </Button>
      </div>

      {/* PanZoom Container */}
      <PanZoom
        ref={panZoomRef}
        boundaryRatio={0.9} // Permite um pouco de scroll para fora do conteúdo
        minZoom={0.1}
        maxZoom={4}
        autoCenter={true}
        autoCenterZoomLevel={0.5}
        disableDoubleClickZoom={true}
        realPinch={true}
        inertia={true} // Adicionar inércia para movimento suave
        keyMapping={{
          '8': false, // Desabilitar backspace
          '32': true, // Habilitar barra de espaço para pan
        }}
        className="w-full h-full"
      >
        <div className="relative w-full h-full min-w-[2000px] min-h-[2000px]"> {/* Canvas virtual maior */}
          {elements?.map((element) => (
            element.element_type === "image" ? (
              <VisualReferenceImage
                key={element.id}
                element={element}
                onUpdate={handleUpdateElement}
                onDelete={handleDeleteElement}
                onSelect={handleSelectElement}
                isSelected={selectedElementId === element.id}
              />
            ) : (
              <VisualReferenceText
                key={element.id}
                element={element}
                onUpdate={handleUpdateElement}
                onDelete={handleDeleteElement}
                onSelect={handleSelectElement}
                isSelected={selectedElementId === element.id}
              />
            )
          ))}
        </div>
      </PanZoom>
    </div>
  );
};

export default VisualReferencesCanvas;