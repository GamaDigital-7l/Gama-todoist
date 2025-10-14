"use client";

import React from "react";
import { MadeWithDyad } from "@/components/made-with-dyad";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ListTodo, Award, Target } from "lucide-react"; // Importando ícones para os cards
import DailyMotivation from "@/components/DailyMotivation"; // Importar o novo componente

const Dashboard: React.FC = () => {
  return (
    <div className="flex flex-1 flex-col gap-8 p-4 lg:p-6">
      <div className="text-center">
        <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl mb-2">
          Bem-vindo à sua Netflix da Vida Pessoal!
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Aqui você vai acompanhar suas tarefas, metas e progresso de forma inspiradora e organizada.
        </p>
      </div>

      <DailyMotivation /> {/* Adicionando o componente de motivação aqui */}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="hover:shadow-lg transition-shadow duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg font-semibold">Tarefas Diárias</CardTitle>
            <ListTodo className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">3/5 Concluídas</div>
            <p className="text-sm text-muted-foreground mt-1">
              Você está no caminho certo!
            </p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-lg transition-shadow duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg font-semibold">Pontuação Total</CardTitle>
            <Award className="h-5 w-5 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">+1.250 Pontos</div>
            <p className="text-sm text-muted-foreground mt-1">
              Continue assim para subir de nível!
            </p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-lg transition-shadow duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg font-semibold">Próxima Meta</CardTitle>
            <Target className="h-5 w-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">Ler 10 páginas</div>
            <p className="text-sm text-muted-foreground mt-1">
              Faltam 5 páginas para hoje.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex-1 flex items-end justify-center mt-8">
        <MadeWithDyad />
      </div>
    </div>
  );
};

export default Dashboard;