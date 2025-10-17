"use client";

import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Edit, Trash2 } from "lucide-react"; // Removido Eye
import { Client } from "@/types/client";
import { Link } from "react-router-dom";

interface ClientCardProps {
  client: Client;
  onEdit: (client: Client) => void;
  onDelete: (clientId: string) => void;
}

const ClientCard: React.FC<ClientCardProps> = ({ client, onEdit, onDelete }) => {
  return (
    <Card className="flex flex-col h-full bg-card border border-border rounded-lg shadow-sm hover:shadow-lg transition-shadow duration-200">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-3 min-w-0">
          {client.logo_url ? (
            <img src={client.logo_url} alt={client.name} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-lg font-semibold flex-shrink-0">
              {client.name.charAt(0).toUpperCase()}
            </div>
          )}
          <CardTitle className="text-xl font-semibold text-foreground break-words min-w-0">{client.name}</CardTitle>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onEdit(client); }} className="text-blue-500 hover:bg-blue-500/10">
            <Edit className="h-4 w-4" />
            <span className="sr-only">Editar Cliente</span>
          </Button>
          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onDelete(client.id); }} className="text-red-500 hover:bg-red-500/10">
            <Trash2 className="h-4 w-4" />
            <span className="sr-only">Deletar Cliente</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col justify-between">
        {client.description && (
          <CardDescription className="text-muted-foreground mb-3 break-words">{client.description}</CardDescription>
        )}
        {/* O botão "Ver Dashboard" foi removido. O card inteiro será clicável através do Link no componente pai. */}
      </CardContent>
    </Card>
  );
};

export default ClientCard;