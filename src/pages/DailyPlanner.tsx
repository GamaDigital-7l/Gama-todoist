"use client";

import React from "react";
import { CalendarDays } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const DailyPlanner: React.FC = () => {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6 bg-background text-foreground">
      <h1 className="text-3xl font-bold flex items-center gap-2">
        <CalendarDays className="h-7 w-7 text-primary" /> Planejador Diário
      </h1>
      <p className="text-lg text-muted-foreground">
        Organize seu dia, visualize tarefas e eventos do calendário.
      </p>

      <Card className="flex flex-col flex-grow bg-card border border-border rounded-lg shadow-sm">
        <CardHeader className="border-b border-border">
          <CardTitle className="text-foreground">Seu Dia</CardTitle>
        </CardHeader>
        <CardContent className="flex-grow p-4 overflow-y-auto space-y-4">
          <p className="text-center text-muted-foreground">
            Conteúdo do planejador diário virá aqui.
          </p>
          {/* Futuramente, aqui serão listados eventos do Google Calendar e tarefas */}
        </CardContent>
      </Card>
    </div>
  );
};

export default DailyPlanner;