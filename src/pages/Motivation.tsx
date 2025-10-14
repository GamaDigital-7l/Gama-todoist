"use client";

import React from "react";
import { MadeWithDyad } from "@/components/made-with-dyad";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"; // Importar CardDescription
import { Sparkles } from "lucide-react";

const Motivation: React.FC = () => {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6 bg-background text-foreground">
      <h1 className="text-3xl font-bold">Sua Dose Diária de Motivação</h1>
      <p className="text-lg text-muted-foreground">
        Encontre inspiração e mantenha o foco nos seus objetivos.
      </p>

      <Card className="p-4 border border-border rounded-lg bg-card shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-foreground flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> Citações Inspiradoras
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Pequenas doses de sabedoria para impulsionar o seu dia.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-foreground leading-relaxed">
            "O único lugar onde o sucesso vem antes do trabalho é no dicionário." - Vidal Sassoon
          </p>
          {/* Futuro: Adicionar mais conteúdo motivacional, vídeos, artigos */}
        </CardContent>
      </Card>

      <div className="flex-1 flex items-end justify-center">
        <MadeWithDyad />
      </div>
    </div>
  );
};

export default Motivation;