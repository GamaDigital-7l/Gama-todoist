"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"; // Importar Card
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, PlusCircle, CalendarIcon } from "lucide-react";
import { format, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Client } from "@/types/client";

interface ClientKanbanHeaderProps {
  client: Client;
  currentMonth: Date;
  setCurrentMonth: (date: Date) => void;
  remainingTasks: number;
  onGenerateTasks: () => void;
}

const ClientKanbanHeader: React.FC<ClientKanbanHeaderProps> = ({
  client,
  currentMonth,
  setCurrentMonth,
  remainingTasks,
  onGenerateTasks,
}) => {
  const generateMonthOptions = () => {
    const options = [];
    const today = new Date();
    for (let i = -6; i <= 6; i++) { // 6 meses para trás e 6 meses para frente
      const date = new Date(today.getFullYear(), today.getMonth() + i, 1);
      options.push(date);
    }
    return options;
  };

  return (
    <Card className="bg-card border border-border rounded-xl shadow-sm frosted-glass card-hover-effect p-4 mb-4">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4 w-full sm:w-auto min-w-0">
          {client.logo_url && (
            <img src={client.logo_url} alt={`${client.name} Logo`} className="h-12 w-12 object-contain rounded-md flex-shrink-0" />
          )}
          <h1 className="text-2xl font-bold text-foreground truncate">{client.name}</h1>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          <Select
            value={format(currentMonth, "yyyy-MM")}
            onValueChange={(value) => {
              const [year, month] = value.split('-').map(Number);
              setCurrentMonth(new Date(year, month - 1, 1));
            }}
          >
            <SelectTrigger className="w-full sm:w-[180px] bg-input border-border text-foreground focus-visible:ring-ring">
              <CalendarIcon className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Selecionar Mês" />
            </SelectTrigger>
            <SelectContent className="bg-popover text-popover-foreground border-border rounded-md shadow-lg">
              {generateMonthOptions().map((date) => {
                const value = format(date, "yyyy-MM");
                const label = format(date, "MMMM yyyy", { locale: ptBR });
                return <SelectItem key={value} value={value}>{label}</SelectItem>;
              })}
            </SelectContent>
          </Select>

          <Button onClick={onGenerateTasks} className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90">
            <PlusCircle className="mr-2 h-4 w-4" /> Gerar Tarefas
          </Button>
        </div>
      </div>

      {client.monthly_delivery_goal !== null && client.monthly_delivery_goal > 0 && (
        <div className="mt-4 pt-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground text-center sm:text-left">
            Meta de Entregas Mensais: <span className="font-semibold text-foreground">{client.monthly_delivery_goal}</span>
          </p>
          {remainingTasks > 0 ? (
            <span className="flex items-center gap-1 text-sm text-orange-500 text-center sm:text-right">
                <AlertCircle className="h-4 w-4 flex-shrink-0" /> Faltam {remainingTasks}/{client.monthly_delivery_goal} até {format(endOfMonth(currentMonth), "dd/MM", { locale: ptBR })}
              </span>
          ) : (
            <span className="flex items-center gap-1 text-sm text-green-500 text-center sm:text-right">
                <AlertCircle className="h-4 w-4 flex-shrink-0" /> Meta de entregas atingida!
              </span>
          )}
        </div>
      )}
    </Card>
  );
};

export default ClientKanbanHeader;