"use client";

import React from "react";
import { Rnd } from "react-rnd";
import { VisualReferenceElement } from "@/types/client";
import { XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface VisualReferenceImageProps {
  element: VisualReferenceElement;
  onUpdate: (id: string, data: Partial<VisualReferenceElement>) => void;
  onDelete: (id: string) => void;
  onSelect: (id: string) => void;
  isSelected: boolean;
}

const VisualReferenceImage: React.FC<VisualReferenceImageProps> = ({
  element,
  onUpdate,
  onDelete,
  onSelect,
  isSelected,
}) => {
  const { id, content, x, y, width, height, z_index } = element;

  const handleDragStop = (e: any, d: { x: number; y: number }) => {
    onUpdate(id, { x: d.x, y: d.y });
  };

  const handleResizeStop = (
    e: any,
    direction: any,
    ref: HTMLElement,
    delta: any,
    position: { x: number; y: number }
  ) => {
    onUpdate(id, {
      x: position.x,
      y: position.y,
      width: parseInt(ref.style.width),
      height: parseInt(ref.style.height),
    });
  };

  return (
    <Rnd
      size={{ width: width || 200, height: height || "auto" }}
      position={{ x, y }}
      onDragStop={handleDragStop}
      onResizeStop={handleResizeStop}
      bounds="parent"
      style={{ zIndex: z_index || 1, border: isSelected ? "2px solid hsl(var(--primary))" : "none" }}
      minWidth={50}
      minHeight={50}
      lockAspectRatio={true} // Manter proporção para imagens
      onClick={() => onSelect(id)}
    >
      <div className="relative w-full h-full group">
        <img
          src={content}
          alt="Visual Reference"
          className="w-full h-full object-contain bg-background rounded-md shadow-md"
        />
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation(); // Prevent selecting the element when deleting
            onDelete(id);
          }}
          className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-red-500 text-white hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <XCircle className="h-4 w-4" />
          <span className="sr-only">Remover Imagem</span>
        </Button>
      </div>
    </Rnd>
  );
};

export default VisualReferenceImage;