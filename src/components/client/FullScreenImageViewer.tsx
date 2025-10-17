"use client";

import React from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface FullScreenImageViewerProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  description?: string | null;
}

const FullScreenImageViewer: React.FC<FullScreenImageViewerProps> = ({ isOpen, onClose, imageUrl, description }) => {
  if (!isOpen || !imageUrl) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="fixed inset-0 flex flex-col items-center justify-center bg-black bg-opacity-90 z-50 p-4 border-none rounded-none max-w-full max-h-full h-full w-full">
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="absolute top-4 right-4 z-50 text-white hover:bg-white/20"
        >
          <X className="h-6 w-6" />
          <span className="sr-only">Fechar</span>
        </Button>
        <div className="relative flex flex-col items-center justify-center h-full w-full">
          <img
            src={imageUrl}
            alt={description || "Imagem da tarefa"}
            className="max-w-full max-h-[80vh] object-contain"
          />
          {description && (
            <div className="mt-4 p-3 bg-gray-800 bg-opacity-70 rounded-md text-white text-center max-w-full overflow-auto">
              <p className="text-sm">{description}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FullScreenImageViewer;