"use client";

import React, { useState, useRef, useEffect } from "react";
import { Rnd } from "react-rnd";
import { VisualReferenceElement } from "@/types/client";
import { XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface VisualReferenceTextProps {
  element: VisualReferenceElement;
  onUpdate: (id: string, data: Partial<VisualReferenceElement>) => void;
  onDelete: (id: string) => void;
  onSelect: (id: string) => void;
  isSelected: boolean;
}

const VisualReferenceText: React.FC<VisualReferenceTextProps> = ({
  element,
  onUpdate,
  onDelete,
  onSelect,
  isSelected,
}) => {
  const { id, content, x, y, width, height, z_index, metadata } = element;
  const [text, setText] = useState(content);
  const [isEditing, setIsEditing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setText(content);
  }, [content]);

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

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
  };

  const handleBlur = () => {
    setIsEditing(false);
    if (text !== content) {
      onUpdate(id, { content: text });
    }
  };

  const handleDoubleClick = () => {
    setIsEditing(true);
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 0);
  };

  const defaultWidth = 200;
  const defaultHeight = 100;

  return (
    <Rnd
      size={{ width: width || defaultWidth, height: height || defaultHeight }}
      position={{ x, y }}
      onDragStop={handleDragStop}
      onResizeStop={handleResizeStop}
      bounds="parent"
      style={{ zIndex: z_index || 1, border: isSelected ? "2px solid hsl(var(--primary))" : "none" }}
      minWidth={50}
      minHeight={50}
      onClick={() => onSelect(id)}
      onDoubleClick={handleDoubleClick}
    >
      <div
        className="relative w-full h-full p-2 rounded-md shadow-md flex items-center justify-center group"
        style={{
          backgroundColor: metadata?.backgroundColor || (isSelected ? "hsl(var(--accent))" : "hsl(var(--secondary))"),
          color: metadata?.fontColor || "hsl(var(--foreground))",
          fontSize: metadata?.fontSize || "1rem",
          border: isSelected ? "2px solid hsl(var(--primary))" : "1px solid hsl(var(--border))",
        }}
      >
        {isEditing ? (
          <Textarea
            ref={textareaRef}
            value={text}
            onChange={handleTextChange}
            onBlur={handleBlur}
            className="w-full h-full bg-transparent border-none resize-none focus-visible:ring-0 text-center p-0"
            style={{ color: metadata?.fontColor || "inherit", fontSize: metadata?.fontSize || "inherit" }}
          />
        ) : (
          <span className="break-words whitespace-pre-wrap text-center">{text}</span>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(id);
          }}
          className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-red-500 text-white hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <XCircle className="h-4 w-4" />
          <span className="sr-only">Remover Nota</span>
        </Button>
      </div>
    </Rnd>
  );
};

export default VisualReferenceText;