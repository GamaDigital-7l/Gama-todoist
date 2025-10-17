"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Edit, Trash2, Repeat } from "lucide-react";
import { ClientTaskGenerationTemplate, ClientTaskGenerationPattern } from "@/types/client";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ClientTaskGenerationTemplateItemProps {
  template: ClientTaskGenerationTemplate;
  onEdit: (template: ClientTaskGenerationTemplate) => void;
  onDelete: (templateId: string) => void;
}

const DAYS_OF_WEEK_LABELS: { [key: string]: string } = {
  "Sunday": "Dom", "Monday": "Seg", "Tuesday": "Ter", "Wednesday": "Qua",
  "Thursday": "Qui", "Friday": "Sex", "Saturday": "Sáb"
};

const ClientTaskGenerationTemplateItem: React.FC<ClientTaskGenerationTemplateItemProps> = ({ template, onEdit, onDelete }) => {
  const renderPattern = (pattern: ClientTaskGenerationPattern[]) => {
    if (!pattern || pattern.length === 0) return "Nenhum padrão definido.";
    return pattern.map((p, index) => (
      <span key={index} className="block text-xs text-muted-foreground">
        Semana {p.week}, {DAYS_OF_WEEK_LABELS[p.day_of_week]}: {p.count} tarefas
      </span>
    ));
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 border border-border rounded-md bg-background shadow-sm">
      <div className="flex items-center gap-3 flex-grow min-w-0">
        <div className="grid gap-1.5 flex-grow min-w-0">
          <label className="text-sm font-medium leading-none text-foreground">
            {template.template_name}
          </label>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Repeat className="h-3 w-3" /> Meta Mensal: {template.delivery_count} entregas
          </p>
          {renderPattern(template.generation_pattern)}
        </div>
      </div>
      <div className="flex items-center gap-2 mt-2 sm:mt-0 flex-shrink-0">
        <Button variant="ghost" size="icon" onClick={() => onEdit(template)} className="text-blue-500 hover:bg-blue-500/10">
          <Edit className="h-4 w-4" />
          <span className="sr-only">Editar Template</span>
        </Button>
        <Button variant="ghost" size="icon" onClick={() => onDelete(template.id)} className="text-red-500 hover:bg-red-500/10">
          <Trash2 className="h-4 w-4" />
          <span className="sr-only">Deletar Template</span>
        </Button>
      </div>
    </div>
  );
};

export default ClientTaskGenerationTemplateItem;