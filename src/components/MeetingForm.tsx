"use client";

import React from "react";
import { useForm, UseFormReturn } from "react-hook-form"; // Importar UseFormReturn
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Loader2 } from "lucide-react"; 
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { useSession } from "@/integrations/supabase/auth";
import TimePicker from "./TimePicker";
import { Meeting } from "@/types/meeting";
import { ptBR } from "date-fns/locale";
import { Checkbox } from "@/components/ui/checkbox"; 
import { DIALOG_CONTENT_CLASSNAMES } from "@/lib/constants"; // Importar a constante

export const meetingSchema = z.object({ // Exportar o schema
  id: z.string().optional(), // Adicionar id
  title: z.string().min(1, "O título da reunião é obrigatório."),
  description: z.string().optional(),
  date: z.date().default(new Date()),
  start_time: z.string().min(1, "O horário de início é obrigatório."),
  end_time: z.string().optional().nullable(),
  location: z.string().optional(),
  sendToGoogleCalendar: z.boolean().default(false), 
  google_event_id: z.string().nullable().optional(), // Adicionar google_event_id
  google_html_link: z.string().nullable().optional(), // Adicionar google_html_link
});

export type MeetingFormValues = z.infer<typeof meetingSchema>;

interface MeetingFormProps {
  form: UseFormReturn<MeetingFormValues>; // Receber a instância do formulário
  onSubmit: (values: MeetingFormValues) => Promise<void>; // Receber o handler de submissão
  isSubmitting: boolean;
  onClose: () => void;
}

const MeetingForm: React.FC<MeetingFormProps> = ({ form, onSubmit, isSubmitting, onClose }) => {
  // Removido useSession, userId, useForm, zodResolver, initialData, setIsSubmitting
  // A lógica de submissão e estado de carregamento agora é gerenciada pelo componente pai

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-4 bg-card rounded-xl frosted-glass card-hover-effect">
      <div>
        <Label htmlFor="title" className="text-foreground">Título da Reunião</Label>
        <Input
          id="title"
          {...form.register("title")}
          placeholder="Ex: Reunião de equipe"
          className="w-full bg-input border-border text-foreground focus-visible:ring-ring"
        />
        {form.formState.errors.title && (
          <p className="text-red-500 text-sm mt-1">
            {form.formState.errors.title.message}
          </p>
        )}
      </div>
      <div>
        <Label htmlFor="description" className="text-foreground">Descrição (Opcional)</Label>
        <Textarea
          id="description"
          {...form.register("description")}
          placeholder="Detalhes da reunião..."
          className="w-full bg-input border-border text-foreground focus-visible:ring-ring"
        />
      </div>
      <div>
        <Label htmlFor="date" className="text-foreground">Data da Reunião</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={"outline"}
              className={cn(
                "w-full justify-start text-left font-normal bg-input border-border text-foreground hover:bg-accent hover:text-accent-foreground",
                !form.watch("date") && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
              {form.watch("date") ? (
                format(form.watch("date")!, "PPP", { locale: ptBR })
              ) : (
                <span>Escolha uma data</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 bg-popover border-border rounded-md shadow-lg">
            <Calendar
              mode="single"
              selected={form.watch("date") || undefined}
              onSelect={(date) => form.setValue("date", date || new Date())}
              initialFocus
              locale={ptBR}
            />
          </PopoverContent>
        </Popover>
        {form.formState.errors.date && (
          <p className="text-red-500 text-sm mt-1">
            {form.formState.errors.date.message}
          </p>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"> 
        <div>
          <Label htmlFor="start_time" className="text-foreground">Início</Label>
          <TimePicker
            value={form.watch("start_time") || null}
            onChange={(time) => form.setValue("start_time", time || "")}
          />
          {form.formState.errors.start_time && (
            <p className="text-red-500 text-sm mt-1">
              {form.formState.errors.start_time.message}
            </p>
          )}
        </div>
        <div>
          <Label htmlFor="end_time" className="text-foreground">Fim (Opcional)</Label>
          <TimePicker
            value={form.watch("end_time") || null}
            onChange={(time) => form.setValue("end_time", time || null)}
          />
        </div>
      </div>
      <div>
        <Label htmlFor="location" className="text-foreground">Local (Opcional)</Label>
        <Input
          id="location"
          {...form.register("location")}
          placeholder="Ex: Sala de conferência A"
          className="w-full bg-input border-border text-foreground focus-visible:ring-ring"
        />
      </div>
      <div className="flex items-center space-x-2">
        <Checkbox
          id="sendToGoogleCalendar"
          checked={form.watch("sendToGoogleCalendar")}
          onCheckedChange={(checked) => form.setValue("sendToGoogleCalendar", checked as boolean)}
          className="border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground flex-shrink-0"
        />
        <Label htmlFor="sendToGoogleCalendar" className="text-foreground">
          Enviar para Google Calendar
        </Label>
      </div>
      <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={isSubmitting}>
        {isSubmitting ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          form.watch("id") ? "Atualizar Reunião" : "Adicionar Reunião"
        )}
      </Button>
    </form>
  );
};

export default MeetingForm;