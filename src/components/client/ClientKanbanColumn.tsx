"use client";

import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { ClientTask, ClientTaskStatus } from "@/types/client";
import ClientTaskItem from "./ClientTaskItem";
import { useIsMobile } from "@/hooks/use-mobile";

interface KanbanColumnProps {
  column: { status: ClientTaskStatus; title: string; color: string };
  tasks: ClientTask[] | undefined;
  isLoadingTasks: boolean;
  tasksError: Error | null;
  handleAddTask: (status: ClientTaskStatus) => void;
  handleEditTask: (task: ClientTask) => void;
  handleDragStart: (e: React.DragEvent, taskId: string, currentStatus: ClientTaskStatus) => void;
  handleDragOver: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent, targetStatus: ClientTaskStatus) => Promise<void>;
  clientId: string;
  monthYearRef: string;
}

const KanbanColumn: React.FC<KanbanColumnProps> = ({
  column,
  tasks,
  isLoadingTasks,
  tasksError,
  handleAddTask,
  handleEditTask,
  handleDragStart,
  handleDragOver,
  handleDrop,
  clientId,
  monthYearRef,
}) => {
  const isMobile = useIsMobile();

  return (
    <Card
      className="flex flex-col min-w-[280px] max-w-[320px] flex-shrink-0 bg-card border border-border rounded-xl shadow-md frosted-glass h-full"
      onDragOver={handleDragOver}
      onDrop={(e) => handleDrop(e, column.status)}
    >
      <CardHeader className={`p-3 border-b border-border ${column.color} rounded-t-xl`}>
        <CardTitle className="text-lg font-semibold text-white">{column.title}</CardTitle>
        <CardDescription className="text-sm text-white/80">
          {tasks?.filter(task => task.status === column.status).length} tarefas
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 p-3 overflow-y-auto space-y-3">
        {isLoadingTasks ? (
          <p className="text-muted-foreground">Carregando tarefas...</p>
        ) : tasksError ? (
          <p className="text-red-500">Erro: {tasksError.message}</p>
        ) : (
          tasks?.filter(task => task.status === column.status).map(task => (
            <ClientTaskItem
              key={task.id}
              task={task}
              refetchTasks={() => { /* refetchTasks é passado pelo ClientKanbanPage */ }}
              onEdit={handleEditTask}
              onDragStart={handleDragStart}
              clientId={clientId}
              monthYearRef={monthYearRef}
            />
          ))
        )}
        <Button onClick={() => handleAddTask(column.status)} variant="outline" className="w-full border-dashed border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground">
          <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Tarefa
        </Button>
      </CardContent>
    </Card>
  );
};

export default KanbanColumn;