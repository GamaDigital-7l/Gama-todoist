"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showError } from "@/utils/toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ListTodo, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useSession } from "@/integrations/supabase/auth";
import { Task, OriginBoard } from "@/types/task"; // Importar Task e OriginBoard
import TaskListBoard from "./dashboard/TaskListBoard"; // Importar o componente reutilizável

const fetchAllTasks = async (userId: string): Promise<Task[]> => {
  const { data, error } = await supabase
    .from("tasks")
    .select(`
      *,
      tags (id, name, color)
    `)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) {
    throw error;
  }
  return data || [];
};

const DashboardTaskList: React.FC = () => {
  const { session } = useSession();
  const userId = session?.user?.id;

  const { data: allTasks, isLoading, error, refetch } = useQuery<Task[], Error>({
    queryKey: ["allTasks", userId],
    queryFn: () => fetchAllTasks(userId!),
    enabled: !!userId,
  });

  return (
    <TaskListBoard
      title="Todas as Tarefas (Geral)"
      tasks={allTasks || []}
      isLoading={isLoading}
      error={error}
      refetchTasks={refetch}
      showAddButton={true}
      originBoard="general"
    />
  );
};

export default DashboardTaskList;