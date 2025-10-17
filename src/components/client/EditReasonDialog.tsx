"use client";

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { showError } from '@/utils/toast';

const editReasonSchema = z.object({
  reason: z.string().min(10, "O motivo da edição deve ter pelo menos 10 caracteres."),
});

type EditReasonFormValues = z.infer<typeof editReasonSchema>;

interface EditReasonDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
  initialReason?: string | null;
}

const EditReasonDialog: React.FC<EditReasonDialogProps> = ({ isOpen, onClose, onSubmit, initialReason }) => {
  const form = useForm<EditReasonFormValues>({
    resolver: zodResolver(editReasonSchema),
    defaultValues: {
      reason: initialReason || "",
    },
  });

  const handleSubmit = (values: EditReasonFormValues) => {
    onSubmit(values.reason);
    form.reset();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] w-[90vw] bg-card border border-border rounded-lg shadow-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground">Solicitar Edição</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Descreva o motivo da edição solicitada para esta tarefa.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="reason" className="text-foreground">Motivo da Edição</Label>
            <Textarea
              id="reason"
              {...form.register("reason")}
              placeholder="Ex: A cor da logo está errada, ajustar texto da legenda..."
              className="w-full bg-input border-border text-foreground focus-visible:ring-ring min-h-[100px]"
            />
            {form.formState.errors.reason && (
              <p className="text-red-500 text-sm mt-1">
                {form.formState.errors.reason.message}
              </p>
            )}
          </div>
          <DialogFooter className="flex flex-col sm:flex-row gap-2 mt-4">
            <Button type="button" variant="outline" onClick={onClose} className="border-border text-foreground hover:bg-accent hover:text-accent-foreground w-full sm:w-auto">
              Cancelar
            </Button>
            <Button type="submit" className="bg-primary text-primary-foreground hover:bg-primary/90 w-full sm:w-auto">
              Confirmar Edição
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditReasonDialog;