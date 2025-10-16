"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, BookOpen, HeartHandshake, MessageSquareText } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useSession } from "@/integrations/supabase/auth";

interface MotivationMessage {
  id: string;
  message: string; // Mensagem original, pode ser usada como fallback
  author?: string;
  created_at: string;
  verse?: string;
  prayer_suggestion?: string;
  motivational_message?: string;
  gratitude_suggestion?: string;
}

const fetchDailyMotivation = async (userId: string | undefined): Promise<MotivationMessage | null> => {
  const today = format(new Date(), "yyyy-MM-dd");

  // Tenta buscar uma mensagem criada hoje
  const { data: todayMessage, error: todayError } = await supabase
    .from("daily_motivations", { schema: 'public' }) // Especificando o esquema
    .select("*")
    .gte("created_at", `${today}T00:00:00.000Z`)
    .lte("created_at", `${today}T23:59:59.999Z`)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (todayError && todayError.code !== 'PGRST116') {
    console.error("Erro ao buscar mensagem motivacional do dia:", todayError);
  }

  if (todayMessage) {
    return todayMessage;
  }

  // Se não houver mensagem para hoje, busca a mais recente
  const { data: latestMessage, error: latestError } = await supabase
    .from("daily_motivations", { schema: 'public' }) // Especificando o esquema
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
  const { session } = useSession();
  const userId = session?.user?.id;

  const { data: motivation, isLoading, error } = useQuery<MotivationMessage | null, Error>({
    queryKey: ["dailyMotivation", userId],
    queryFn: () => fetchDailyMotivation(userId),
    staleTime: 1000 * 60 * 60 * 24, // Cache por 24 horas
  });

  if (isLoading) {
    return (
      <Card className="w-full bg-card border border-border rounded-lg shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-lg font-semibold text-foreground">Motivação do Dia</CardTitle>
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
      <Card className="w-full bg-card border border-border rounded-lg shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-lg font-semibold text-foreground">Motivação do Dia</CardTitle>
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
      <Card className="w-full bg-card border border-border rounded-lg shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-lg font-semibold text-foreground">Motivação do Dia</CardTitle>
          <Sparkles className="h-5 w-5 text-yellow-500" />
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Nenhuma mensagem motivacional encontrada. Adicione uma!</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-lg shadow-md">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-semibold text-primary">Motivação do Dia</CardTitle>
        <Sparkles className="h-5 w-5 text-primary" />
      </CardHeader>
      <CardContent className="space-y-3 text-sm sm:text-base"> {/* Ajuste de tamanho de fonte para mobile */}
        {motivation.verse && (
          <div className="flex items-start gap-2">
            <BookOpen className="h-5 w-5 text-primary flex-shrink-0 mt-1" />
            <blockquote className="italic leading-relaxed text-foreground break-words"> {/* break-words */}
              "{motivation.verse}"
            </blockquote>
          </div>
        )}
        {motivation.prayer_suggestion && (
          <div className="flex items-start gap-2">
            <HeartHandshake className="h-5 w-5 text-primary flex-shrink-0 mt-1" />
            <p className="leading-relaxed text-foreground break-words"> {/* break-words */}
              *Sugestão de Oração:* {motivation.prayer_suggestion}
            </p>
          </div>
        )}
        {motivation.motivational_message && (
          <div className="flex items-start gap-2">
            <MessageSquareText className="h-5 w-5 text-primary flex-shrink-0 mt-1" />
            <p className="leading-relaxed text-foreground break-words"> {/* break-words */}
              *Mensagem Motivacional:* {motivation.motivational_message}
            </p>
          </div>
        )}
        {motivation.gratitude_suggestion && (
          <div className="flex items-start gap-2">
            <Sparkles className="h-5 w-5 text-primary flex-shrink-0 mt-1" />
            <p className="leading-relaxed text-foreground break-words"> {/* break-words */}
              *Sugestão de Agradecimento:* {motivation.gratitude_suggestion}
            </p>
          </div>
        )}
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