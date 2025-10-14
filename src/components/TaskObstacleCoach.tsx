"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Brain, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { showError } from "@/utils/toast";

interface TaskObstacleCoachProps {
  isOpen: boolean;
  onClose: () => void;
  taskTitle: string;
  taskDescription?: string;
}

const TaskObstacleCoach: React.FC<TaskObstacleCoachProps> = ({ isOpen, onClose, taskTitle, taskDescription }) => {
  const [obstacleInput, setObstacleInput] = useState("");
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleGetSuggestion = async () => {
    if (obstacleInput.trim() === "") {
      showError("Por favor, descreva seu obstáculo.");
      return;
    }

    setIsLoading(true);
    setAiSuggestion(null);

    try {
      const { data, error } = await supabase.functions.invoke('ai-obstacle-coach', {
        body: {
          taskTitle,
          taskDescription,
          obstacle: obstacleInput,
        },
      });

      if (error) {
        throw error;
      }

      setAiSuggestion(data.suggestion);
    } catch (err: any) {
      showError("Erro ao obter sugestão da IA: " + err.message);
      console.error("Erro na Edge Function ai-obstacle-coach:", err);
      setAiSuggestion("Desculpe, não consegui gerar uma sugestão no momento. Tente novamente mais tarde.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setObstacleInput("");
    setAiSuggestion(null);
    setIsLoading(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[475px] bg-card border border-border rounded-lg shadow-lg">
        <DialogHeader>
          <DialogTitle className="text-foreground">Coach de Obstáculos da IA</DialogTitle>
          <DialogDescription className="text-muted-foreground break-words">
            Descreva o que está te impedindo de completar a tarefa "{taskTitle}" e a IA te dará uma sugestão.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 p-4">
          <div>
            <Label htmlFor="obstacle" className="text-foreground">Meu obstáculo é:</Label>
            <Textarea
              id="obstacle"
              value={obstacleInput}
              onChange={(e) => setObstacleInput(e.target.value)}
              placeholder="Ex: Estou procrastinando, não sei por onde começar, estou sem tempo..."
              className="bg-input border-border text-foreground focus-visible:ring-ring"
              rows={4}
              disabled={isLoading}
            />
          </div>
          <Button
            onClick={handleGetSuggestion}
            disabled={isLoading || obstacleInput.trim() === ""}
            className="w-full bg-blue-600 text-white hover:bg-blue-700"
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Brain className="mr-2 h-4 w-4" />
            )}
            Obter Sugestão da IA
          </Button>

          {aiSuggestion && (
            <div className="mt-4 p-3 bg-secondary rounded-md text-secondary-foreground border border-border">
              <p className="font-semibold mb-2">Sugestão da IA:</p>
              <p className="text-sm whitespace-pre-wrap break-words">{aiSuggestion}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TaskObstacleCoach;