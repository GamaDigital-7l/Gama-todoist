"use client";

import React from "react";
import { MadeWithDyad } from "@/components/made-with-dyad";

const Tasks: React.FC = () => {
  return (
    <div className="flex flex-1 flex-col gap-4">
      <h1 className="text-3xl font-bold">Suas Tarefas</h1>
      <p className="text-lg text-muted-foreground">
        Organize suas tarefas diárias, semanais e mensais aqui.
      </p>

      <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-2">
        {/* Placeholder for Daily Tasks */}
        <div className="p-4 border rounded-lg">
          <h2 className="text-xl font-semibold mb-2">Tarefas Diárias</h2>
          <p className="text-muted-foreground">
            Lista de tarefas para hoje.
          </p>
          {/* Future: Add task list and input */}
        </div>

        {/* Placeholder for Weekly/Monthly Tasks */}
        <div className="p-4 border rounded-lg">
          <h2 className="text-xl font-semibold mb-2">Tarefas Semanais/Mensais</h2>
          <p className="text-muted-foreground">
            Tarefas de longo prazo.
          </p>
          {/* Future: Add task list and input */}
        </div>
      </div>

      <div className="flex-1 flex items-end justify-center">
        <MadeWithDyad />
      </div>
    </div>
  );
};

export default Tasks;