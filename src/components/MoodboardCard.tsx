"use client";

import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Edit, Trash2, Eye } from "lucide-react";
import { Moodboard } from "@/types/client";
import { Link } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface MoodboardCardProps {
  moodboard: Moodboard;
  onEdit: (moodboard: Moodboard) => void;
  onDelete: (moodboardId: string) => void;
}

const MoodboardCard: React.FC<MoodboardCardProps> = ({ moodboard, onEdit, onDelete }) => {
  return (
    <Card className="flex flex-col h-full bg-card border border-border rounded-lg shadow-sm hover:shadow-lg transition-shadow duration-200">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-3">
          {moodboard.thumbnail_url ? (
            <img src={moodboard.thumbnail_url} alt={moodboard.title} className="w-10 h-10 rounded-md object-cover" />
          ) : (
            <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center text-muted-foreground text-lg font-semibold">
              {moodboard.title.charAt(0).toUpperCase()}
            </div>
          )}
          <CardTitle className="text-xl font-semibold text-foreground">{moodboard.title}</CardTitle>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => onEdit(moodboard)} className="text-blue-500 hover:bg-blue-500/10">
            <Edit className="h-4 w-4" />
            <span className="sr-only">Editar Moodboard</span>
          </Button>
          <Button variant="ghost" size="icon" onClick={() => onDelete(moodboard.id)} className="text-red-500 hover:bg-red-500/10">
            <Trash2 className="h-4 w-4" />
            <span className="sr-only">Deletar Moodboard</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col justify-between">
        {moodboard.description && (
          <CardDescription className="text-muted-foreground mb-3">{moodboard.description}</CardDescription>
        )}
        <div className="text-xs text-muted-foreground mb-3">
          <p>Criado em: {format(parseISO(moodboard.created_at), "PPP", { locale: ptBR })}</p>
          <p>Última edição: {format(parseISO(moodboard.updated_at), "PPP", { locale: ptBR })}</p>
        </div>
        <Link to={`/clients/${moodboard.client_id}/moodboards/${moodboard.id}`} className="w-full">
          <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
            <Eye className="mr-2 h-4 w-4" /> Abrir Moodboard
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
};

export default MoodboardCard;