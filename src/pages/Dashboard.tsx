"use client";

import React from "react";
import { MadeWithDyad } from "@/components/made-with-dyad";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const Dashboard: React.FC = () => {
  return (
    <div className="flex flex-1 flex-col gap-4">
      <h1 className="text-3xl font-bold">Bem-vindo à sua Netflix da Vida Pessoal!</h1>
      <p className="text-lg text-muted-foreground">
        Aqui você vai acompanhar suas tarefas, metas e progresso.
      </p>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tarefas Diárias</CardTitle>
            {/* Icon for daily tasks */}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">3/5 Concluídas</div>
            <p className="text-xs text-muted-foreground">
              Você está no caminho certo!
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pontuação Total</CardTitle>
            {/* Icon for points */}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+1,250 Pontos</div>
            <p className="text-xs text-muted-foreground">
              Continue assim para subir de nível!
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Próxima Meta</CardTitle>
            {/* Icon for goals */}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Ler 10 páginas</div>
            <p className="text-xs text-muted-foreground">
              Faltam 5 páginas para hoje.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex-1 flex items-end justify-center">
        <MadeWithDyad />
      </div>
    </div>
  );
};

export default Dashboard;