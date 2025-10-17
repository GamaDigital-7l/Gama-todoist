"use client";

import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { useSession } from "@/integrations/supabase/auth";
import TimePicker from "./TimePicker";
import { Meeting } from "@/types/meeting"; // Mantido para referência, mas o tipo de prop foi alterado

const meetingSchema = z.object({
  title: z.string().min(1, "O título da reunião é obrigatório."),
  description: z.string().optional(),
  date: z.date().default(new Date()),
  start_time: z.string().min(1, "O horário de início é obrigatório."),
  end_time: z.string().optional().nullable(),
  location: z.string().optional(),
});

export type MeetingFormValues = z.infer<typeof meetingSchema>;

interface MeetingFormProps {
  initialData?: (MeetingFormValues & { id?: string }); // Para edição, o ID é necessário, mas opcional para criação
  onMeetingSaved: () => void;
  onClose: () => void;
}

const MeetingForm: React.FC<MeetingFormProps> = ({ initialData, onMeetingSaved, onClose }) => {
  const { session } = useSession();
  const userId = session?.user?.id;

  const form = useForm<MeetingFormValues>({
    resolver: zodResolver(meetingSchema),
    defaultValues: initialData ? {
      ...initialData,
      date: new Date(initialData.date),
      start_time: initialData.start_time,
      end_time: initialData.end_time || null,
    } : {
      title: "",
      description: "",
      date: new Date(),
      start_time: "",
      end_time: null,
      location: "",
    },
  });

  const onSubmit = async (values: MeetingFormValues) => {
    if (!userId) {
      showError("Usuário não autenticado.");
      return;
    }

    try {
      const dataToSave = {
        title: values.title,
        description: values.description || null,
        date: format(values.date, "yyyy-MM-dd"),
        start_time: values.start_time,
        end_time: values.end_time || null,
        location: values.location || null,
        updated_at: new Date().toISOString(),
      };

      if (initialData && initialData.id) { // Verifica se é uma edição e se o ID existe
        const { error } = await supabase
          .from("meetings")
          .update(dataToSave)
          .eq("id", initialData.id)
          .eq("user_id", userId);

        if (error) throw error;
        showSuccess("Reunião atualizada com sucesso!");
      } else {
        const { error } = await supabase.from("meetings").insert({
          ...dataToSave,
          user_id: userId,
        });

        if (error) throw error;
        showSuccess("Reunião adicionada com sucesso!");
      }
      form.reset();
      onMeetingSaved();
      onClose();
    } catch (error: any) {
      showError("Erro ao salvar reunião: " + error.message);
      console.error("Erro ao salvar reunião:", error);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-4 bg-card">
      <div>
        <Label htmlFor="title" className="text-foreground">Título da Reunião</Label>
        <Input
          id="title"
          {...form.register("title")}
          placeholder="Ex: Reunião de equipe"
          className="w-full bg-input border-border text-foreground focus-visible:ring-ring rounded-xl"
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
          className="w-full bg-input border-border text-foreground focus-visible:ring-ring rounded-xl"
        />
      </div>
      <div>
        <Label htmlFor="date" className="text-foreground">Data da Reunião</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={"outline"}
              className={cn(
                "w-full justify-start text-left font-normal bg-input border-border text-foreground hover:bg-accent hover:text-accent-foreground rounded-xl",
                !form.watch("date") && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {form.watch("date") ? (
                format(form.watch("date")!, "PPP")
              ) : (
                <span>Escolha uma data</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 bg-popover border-border rounded-2xl shadow-xl frosted-glass">
            <Calendar
              mode="single"
              selected={form.watch("date") || undefined}
              onSelect={(date) => form.setValue("date", date || new Date())}
              initialFocus
            />
          </PopoverContent>
        </Popover>
        {form.formState.errors.date && (
          <p className="text-red-500 text-sm mt-1">
            {form.formState.errors.date.message}
          </p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4">
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
          className="w-full bg-input border-border text-foreground focus-visible:ring-ring rounded-xl"
        />
      </div>
      <Button type="submit" className="w-full bg-gradient-primary text-primary-foreground hover:opacity-90 btn-glow">
        {initialData ? "Atualizar Reunião" : "Adicionar Reunião"}
      </Button>
    </form>
  );
};

export default MeetingForm;