"use client";

import React from "react";
import { MadeWithDyad } from "@/components/made-with-dyad";

const Goals: React.FC = () => {
  return (
    <div className="flex flex-1 flex-col gap-4">
      <h1 className="text-3xl font-bold">Suas Metas</h1>
      <p className="text-lg text-muted-foreground">
        Defina e acompanhe suas metas de vida aqui.
      </p>

      <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-2">
        {/* Placeholder for Current Goals */}
        <div className="p-4 border rounded-lg">
          <h2 className="text-xl font-semibold mb-2">Metas Atuais</h2>
          <p className="text-muted-foreground">
            Suas metas em andamento.
          </p>
          {/* Future: Add goal list and input */}
        </div>

        {/* Placeholder for Achieved Goals */}
        <div className="p-4 border rounded-lg">
          <h2 className="text-xl font-semibold mb-2">Metas Concluídas</h2>
          <p className="text-muted-foreground">
            Suas conquistas!
          </p>
          {/* Future: Add achieved goals list */}
        </div>
      </div>

      <div className="flex-1 flex items-end justify-center">
        <MadeWithDyad />
      </div>
    </div>
  );
};

export default Goals;