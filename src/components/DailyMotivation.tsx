"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface MotivationMessage {
  id: string;
  message: string;
  author?: string;
  created_at: string;
}

const fetchDailyMotivation = async (): Promise<MotivationMessage | null> => {
  const today = format(new Date(), "yyyy-MM-dd");

  // Tenta buscar uma mensagem criada hoje
  const { data: todayMessage, error: todayError } = await supabase
    .from("daily_motivations")
    .select("*")
    .gte("created_at", `${today}T00:00:00.000Z`)
    .lte("created_at", `${today}T23:59:59.999Z`)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (todayError && todayError.code !== 'PGRST116') { // PGRST116 means no rows found
    console.error("Erro ao buscar mensagem motivacional do dia:", todayError);
  }

  if (todayMessage) {
    return todayMessage;
  }

  // Se não houver mensagem para hoje, busca a mais recente
  const { data: latestMessage, error: latestError } = await supabase
    .from("daily_motivations")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (latestError && latestError.code !== 'PGRST116') {
    console.error("Erro ao buscar a mensagem motivacional mais recente:", latestError);
  }

  return latestMessage || null;
};

const DailyMotivation: React.FC = () => {
  const { data: motivation, isLoading, error } = useQuery<MotivationMessage | null, Error>({
    queryKey: ["dailyMotivation"],
    queryFn: fetchDailyMotivation,
    staleTime: 1000 * 60 * 60 * 24, // Cache por 24 horas
  });

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-lg font-semibold">Motivação do Dia</CardTitle>
          <Sparkles className="h-5 w-5 text-yellow-500" />
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Carregando sua dose diária de inspiração...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-lg font-semibold">Motivação do Dia</CardTitle>
          <Sparkles className="h-5 w-5 text-yellow-500" />
        </CardHeader>
        <CardContent>
          <p className="text-red-500">Erro ao carregar motivação: {error.message}</p>
        </CardContent>
      </Card>
    );
  }

  if (!motivation) {
    return (
      <Card className="w-full">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-lg font-semibold">Motivação do Dia</CardTitle>
          <Sparkles className="h-5 w-5 text-yellow-500" />
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Nenhuma mensagem motivacional encontrada. Adicione uma!</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-semibold">Motivação do Dia</CardTitle>
        <Sparkles className="h-5 w-5 text-yellow-500" />
      </CardHeader>
      <CardContent>
        <blockquote className="text-lg font-medium italic leading-relaxed">
          "{motivation.message}"
        </blockquote>
        {motivation.author && (
          <p className="text-sm text-muted-foreground mt-2 text-right">
            — {motivation.author}
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default DailyMotivation;