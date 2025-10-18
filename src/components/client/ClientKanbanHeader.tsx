"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, CalendarDays, Loader2, Share2, AlertCircle, CheckCircle2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format, subMonths, addMonths, endOfMonth, isSameMonth, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Client, ClientTask, PublicApprovalLink } from "@/types/client";
import { Session } from "@supabase/supabase-js";
import { showError, showSuccess } from "@/utils/toast";

interface ClientKanbanHeaderProps {
  client: Client;
  clientTasks: ClientTask[] | undefined;
  currentMonth: Date;
  setCurrentMonth: React.Dispatch<React.SetStateAction<Date>>;
  handleGenerateTasksForMonth: () => Promise<void>;
  handleGenerateApprovalLink: () => Promise<void>;
  generatedLink: string | null;
  copyLinkToClipboard: () => void;
  isGeneratingLink: boolean;
  publicApprovalLink: PublicApprovalLink | null | undefined;
  session: Session | null;
  userId: string | undefined;
}

const ClientKanbanHeader: React.FC<ClientKanbanHeaderProps> = ({
  client,
  clientTasks,
  currentMonth,
  setCurrentMonth,
  handleGenerateTasksForMonth,
  handleGenerateApprovalLink,
  generatedLink,
  copyLinkToClipboard,
  isGeneratingLink,
  publicApprovalLink,
  session,
  userId,
}) => {
  const monthYearRef = format(currentMonth, "yyyy-MM");

  const completedTasksCount = clientTasks?.filter(task => task.is_completed).length || 0;
  const totalTasksForMonth = clientTasks?.length || 0;
  const progressPercentage = totalTasksForMonth > 0 ? (completedTasksCount / totalTasksForMonth) * 100 : 0;

  const today = new Date();
  const isCurrentMonth = isSameMonth(currentMonth, today);
  const remainingTasks = (client.monthly_delivery_goal || 0) - completedTasksCount;
  const daysUntilEndOfMonth = differenceInDays(endOfMonth(currentMonth), today);
  const showAlert = isCurrentMonth && remainingTasks > 0 && daysUntilEndOfMonth <= 7;

  return (
    <Card className="bg-card border border-border rounded-xl shadow-sm frosted-glass card-hover-effect p-4 mb-4">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="border-border text-foreground hover:bg-accent hover:text-accent-foreground">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Select
            value={monthYearRef}
            onValueChange={(value) => {
              const [year, month] = value.split('-').map(Number);
              setCurrentMonth(new Date(year, month - 1, 1));
            }}
          >
            <SelectTrigger className="w-full sm:w-[180px] bg-input border-border text-foreground focus-visible:ring-ring">
              <SelectValue placeholder="Selecionar Mês" />
            </SelectTrigger>
            <SelectContent className="bg-popover text-popover-foreground border-border rounded-md shadow-lg">
              {Array.from({ length: 12 }).map((_, i) => {
                const date = addMonths(new Date(), i - 6);
                const value = format(date, "yyyy-MM");
                const label = format(date, "MMMM yyyy", { locale: ptBR });
                return <SelectItem key={value} value={value}>{label}</SelectItem>;
              })}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="border-border text-foreground hover:bg-accent hover:text-accent-foreground">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 w-full sm:w-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between mb-1 gap-2 sm:gap-0">
            <span className="text-sm font-medium text-foreground text-center sm:text-left">
              Meta do Mês: {client.monthly_delivery_goal} | Concluídas: {completedTasksCount}/{totalTasksForMonth} ({progressPercentage.toFixed(0)}%)
            </span>
            {isCurrentMonth && client.monthly_delivery_goal > 0 && completedTasksCount < client.monthly_delivery_goal && showAlert && (
              <span className="flex items-center gap-1 text-sm text-orange-500 text-center sm:text-right">
                <AlertCircle className="h-4 w-4 flex-shrink-0" /> Faltam {remainingTasks}/{client.monthly_delivery_goal} até {format(endOfMonth(currentMonth), "dd/MM", { locale: ptBR })}
              </span>
            )}
            {isCurrentMonth && client.monthly_delivery_goal > 0 && completedTasksCount >= client.monthly_delivery_goal && (
              <span className="flex items-center gap-1 text-sm text-green-500 text-center sm:text-right">
                <CheckCircle2 className="h-4 w-4 flex-shrink-0" /> Meta Batida!
              </span>
            )}
            <Button onClick={handleGenerateTasksForMonth} size="sm" className="bg-secondary text-secondary-foreground hover:bg-secondary/90 w-full sm:w-auto">
              <CalendarDays className="mr-2 h-4 w-4" /> Gerar Tarefas do Mês
            </Button>
          </div>
          <Progress value={progressPercentage} className="w-full" />
        </div>
      </div>
      <div className="mt-4 flex flex-col sm:flex-row items-center gap-2">
        {generatedLink ? (
          <div className="flex-1 w-full flex flex-col sm:flex-row items-center gap-2">
            <Label htmlFor="approval-link" className="sr-only">Link de Aprovação</Label>
            <Input
              id="approval-link"
              type="text"
              value={generatedLink}
              readOnly
              className="flex-grow bg-input border-border text-foreground focus-visible:ring-ring w-full"
            />
            <Button onClick={copyLinkToClipboard} className="bg-primary text-primary-foreground hover:bg-primary/90 w-full sm:w-auto">
              Copiar Link
            </Button>
          </div>
        ) : (
          <Button
            onClick={handleGenerateApprovalLink}
            disabled={isGeneratingLink || (clientTasks?.filter(task => task.status === 'in_approval').length || 0) === 0}
            className="w-full sm:w-auto bg-blue-600 text-white hover:bg-blue-700"
          >
            {isGeneratingLink ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Share2 className="mr-2 h-4 w-4" />
            )}
            Enviar para Aprovação
          </Button>
        )}
      </div>
    </Card>
  );
};

export default ClientKanbanHeader;