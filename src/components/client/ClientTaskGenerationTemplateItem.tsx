"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Edit, Trash2, CalendarDays, Clock, Star } from "lucide-react";
import { ClientTaskGenerationTemplate, ClientTaskGenerationPattern } from "@/types/client";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";

interface ClientTaskGenerationTemplateItemProps {
  template: ClientTaskGenerationTemplate;
  onEdit: (template: ClientTaskGenerationTemplate) => void;
  onDelete: (templateId: string) => void;
}

const ClientTaskGenerationTemplateItem: React.FC<ClientTaskGenerationTemplateItemProps> = ({ template, onEdit, onDelete }) => {
  return (
    <Card className="flex flex-col h-full bg-card border border-border rounded-xl shadow-sm hover:shadow-lg transition-shadow duration-200 frosted-glass card-hover-effect">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <CardTitle className="text-xl md:text-2xl font-semibold text-foreground break-words">{template.template_name}</CardTitle>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button variant="ghost" size="icon" onClick={() => onEdit(template)} className="text-blue-500 hover:bg-blue-500/10">
            <Edit className="h-4 w-4" />
            <span className="sr-only">Editar Template</span>
          </Button>
          <Button variant="ghost" size="icon" onClick={() => onDelete(template.id)} className="text-red-500 hover:bg-red-500/10">
            <Trash2 className="h-4 w-4" />
            <span className="sr-only">Deletar Template</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-grow space-y-2">
        {template.description && (
          <CardDescription className="text-muted-foreground break-words text-sm md:text-base">
            {template.description}
          </CardDescription>
        )}
        {template.default_due_days !== null && (
          <p className="text-sm md:text-base text-muted-foreground flex items-center gap-1">
            <CalendarDays className="h-4 w-4 text-primary flex-shrink-0" /> Vencimento: {template.default_due_days === 0 ? "No dia da geração" : `Após ${template.default_due_days} dias`}
          </p>
        )}
        {/* Removed template.time as it does not exist in schema */}
        {/* Removed template.is_priority as it does not exist in schema */}
      </CardContent>
    </Card>
  );
};

export default ClientTaskGenerationTemplateItem;