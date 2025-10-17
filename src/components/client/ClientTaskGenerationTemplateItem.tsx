"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Edit, Trash2, Repeat, CheckCircle2, PauseCircle, LayoutDashboard } from "lucide-react";
import { ClientTaskGenerationTemplate, ClientTaskGenerationPattern } from "@/types/client";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";

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
      <span key={index} className="block text-xs text-muted-foreground break-words">
        Semana {p.week}, {DAYS_OF_WEEK_LABELS[p.day_of_week]}: {p.count} tarefas
      </span>
    ));
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 border border-border rounded-md bg-background shadow-sm">
      <div className="flex items-center gap-3 flex-grow min-w-0">
        <div className="grid gap-1.5 flex-grow min-w-0">
          <label className="text-sm font-medium leading-none text-foreground break-words">
            {template.template_name}
          </label>
          <p className="text-xs text-muted-foreground flex items-center gap-1 break-words">
            <Repeat className="h-3 w-3 flex-shrink-0" /> Meta Mensal: {template.delivery_count} entregas
          </p>
          {template.default_due_days !== null && template.default_due_days !== undefined && (
            <p className="text-xs text-muted-foreground flex items-center gap-1 break-words">
              Prazo Padrão: {template.default_due_days} dias
            </p>
          )}
          {renderPattern(template.generation_pattern)}
          <div className="mt-1 flex flex-wrap gap-1">
            {template.is_active ? (
              <Badge variant="secondary" className="bg-green-500/20 text-green-500 border-green-500/50 w-fit">
                <CheckCircle2 className="h-3 w-3 mr-1" /> Ativo
              </Badge>
            ) : (
              <Badge variant="secondary" className="bg-red-500/20 text-red-500 border-red-500/50 w-fit">
                <PauseCircle className="h-3 w-3 mr-1" /> Pausado
              </Badge>
            )}
            {template.is_standard_task && (
              <Badge variant="secondary" className="bg-blue-500/20 text-blue-500 border-blue-500/50 w-fit">
                <LayoutDashboard className="h-3 w-3 mr-1" /> Tarefa Padrão
              </Badge>
            )}
          </div>
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