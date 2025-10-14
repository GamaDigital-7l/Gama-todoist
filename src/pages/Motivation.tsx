"use client";

import React from "react";
import { MadeWithDyad } from "@/components/made-with-dyad";

const Motivation: React.FC = () => {
  return (
    <div className="flex flex-1 flex-col gap-4">
      <h1 className="text-3xl font-bold">Sua Dose Diária de Motivação</h1>
      <p className="text-lg text-muted-foreground">
        Encontre inspiração e mantenha o foco nos seus objetivos.
      </p>

      <div className="p-4 border rounded-lg">
        <h2 className="text-xl font-semibold mb-2">Citações Inspiradoras</h2>
        <p className="text-muted-foreground">
          "O único lugar onde o sucesso vem antes do trabalho é no dicionário." - Vidal Sassoon
        </p>
        {/* Futuro: Adicionar mais conteúdo motivacional, vídeos, artigos */}
      </div>

      <div className="flex-1 flex items-end justify-center">
        <MadeWithDyad />
      </div>
    </div>
  );
};

export default Motivation;