"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Sparkles } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { useSession } from "@/integrations/supabase/auth";

interface MotivationMessage {
  id: string;
  message: string;
  author?: string;
  created_at: string;
  verse?: string;
  prayer_suggestion?: string;
  motivational_message?: string;
  gratitude_suggestion?: string;
}

const fetchLatestMotivation = async (userId: string | undefined): Promise<MotivationMessage | null> => {
  const { data, error } = await supabase
    .from("daily_motivations", { schema: 'public' }) // Especificando o esquema
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error("Erro ao buscar a mensagem motivacional mais recente:", error);
  }
  return data || null;
};

const Motivation: React.FC = () => {
  const { session } = useSession();
  const userId = session?.user?.id;

  const { data: motivation, isLoading, error } = useQuery<MotivationMessage | null, Error>({
    queryKey: ["latestMotivation", userId],
    queryFn: () => fetchLatestMotivation(userId),
    staleTime: 1000 * 60 * 60 * 24, // Cache por 24 horas
  });

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6 bg-background text-foreground">
        <h1 className="text-3xl font-bold">Sua Dose Diária de Motivação</h1>
        <p className="text-lg text-muted-foreground">
          Carregando sua inspiração...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6 bg-background text-foreground">
        <h1 className="text-3xl font-bold">Sua Dose Diária de Motivação</h1>
        <p className="text-lg text-red-500">Erro ao carregar motivação: {error.message}</p>
      </div>
    );
  }

  if (!motivation) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6 bg-background text-foreground">
        <h1 className="text-3xl font-bold">Sua Dose Diária de Motivação</h1>
        <p className="text-lg text-muted-foreground">
          Nenhuma mensagem motivacional encontrada.
        </p>
      </div>
    );
  }

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
          {motivation.verse && (
            <p className="text-foreground leading-relaxed break-words mb-2">
              📖 "{motivation.verse}"
            </p>
          )}
          {motivation.prayer_suggestion && (
            <p className="text-foreground leading-relaxed break-words mb-2">
              🙏 {motivation.prayer_suggestion}
            </p>
          )}
          {motivation.motivational_message && (
            <p className="text-foreground leading-relaxed break-words mb-2">
              ✨ {motivation.motivational_message}
            </p>
          )}
          {motivation.gratitude_suggestion && (
            <p className="text-foreground leading-relaxed break-words mb-2">
              💖 {motivation.gratitude_suggestion}
            </p>
          )}
          {motivation.author && (
            <p className="text-sm text-muted-foreground mt-2 text-right">
              — {motivation.author}
            </p>
          )}
          {!motivation.verse && !motivation.prayer_suggestion && !motivation.motivational_message && !motivation.gratitude_suggestion && (
            <p className="text-foreground leading-relaxed break-words">
              "O único lugar onde o sucesso vem antes do trabalho é no dicionário." - Vidal Sassoon
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Motivation;