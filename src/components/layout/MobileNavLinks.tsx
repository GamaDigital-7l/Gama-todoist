"use client";

import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, ListTodo, Target, Settings, BookOpen, MessageSquare, GraduationCap, HeartPulse, NotebookText, CalendarDays, Users, BarChart2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface MobileNavLinksProps {
  onLinkClick: () => void;
  onLogout: () => void;
}

const MobileNavLinks: React.FC<MobileNavLinksProps> = ({ onLinkClick, onLogout }) => {
  return (
    <nav className="grid gap-6 text-lg font-medium p-4">
      <NavLink
        to="/dashboard"
        className={({ isActive }) =>
          cn("flex items-center gap-4 px-2.5 py-2 rounded-lg", isActive ? "text-sidebar-primary bg-sidebar-accent" : "text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent")
        }
        onClick={onLinkClick}
      >
        <Home className="h-5 w-5" /> Dashboard
      </NavLink>
      <NavLink
        to="/planner"
        className={({ isActive }) =>
          cn("flex items-center gap-4 px-2.5 py-2 rounded-lg", isActive ? "text-sidebar-primary bg-sidebar-accent" : "text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent")
        }
        onClick={onLinkClick}
      >
        <CalendarDays className="h-5 w-5" /> Planner
      </NavLink>
      <NavLink
        to="/tasks"
        className={({ isActive }) =>
          cn("flex items-center gap-4 px-2.5 py-2 rounded-lg", isActive ? "text-sidebar-primary bg-sidebar-accent" : "text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent")
        }
        onClick={onLinkClick}
      >
        <ListTodo className="h-5 w-5" /> Tarefas
      </NavLink>
      <NavLink
        to="/goals"
        className={({ isActive }) =>
          cn("flex items-center gap-4 px-2.5 py-2 rounded-lg", isActive ? "text-sidebar-primary bg-sidebar-accent" : "text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent")
        }
        onClick={onLinkClick}
      >
        <Target className="h-5 w-5" /> Metas
      </NavLink>
      <NavLink
        to="/books"
        className={({ isActive }) =>
          cn("flex items-center gap-4 px-2.5 py-2 rounded-lg", isActive ? "text-sidebar-primary bg-sidebar-accent" : "text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent")
        }
        onClick={onLinkClick}
      >
        <BookOpen className="h-5 w-5" /> Livros
      </NavLink>
      <NavLink
        to="/study"
        className={({ isActive }) =>
          cn("flex items-center gap-4 px-2.5 py-2 rounded-lg", isActive ? "text-sidebar-primary bg-sidebar-accent" : "text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent")
        }
        onClick={onLinkClick}
      >
        <GraduationCap className="h-5 w-5" /> Estudos
      </NavLink>
      <NavLink
        to="/health"
        className={({ isActive }) =>
          cn("flex items-center gap-4 px-2.5 py-2 rounded-lg", isActive ? "text-sidebar-primary bg-sidebar-accent" : "text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent")
        }
        onClick={onLinkClick}
      >
        <HeartPulse className="h-5 w-5" /> Saúde
      </NavLink>
      <NavLink
        to="/notes"
        className={({ isActive }) =>
          cn("flex items-center gap-4 px-2.5 py-2 rounded-lg", isActive ? "text-sidebar-primary bg-sidebar-accent" : "text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent")
        }
        onClick={onLinkClick}
      >
        <NotebookText className="h-5 w-5" /> Notas
      </NavLink>
      <NavLink
        to="/clients"
        className={({ isActive }) =>
          cn("flex items-center gap-4 px-2.5 py-2 rounded-lg", isActive ? "text-sidebar-primary bg-sidebar-accent" : "text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent")
        }
        onClick={onLinkClick}
      >
        <Users className="h-5 w-5" /> Clientes
      </NavLink>
      <NavLink
        to="/results"
        className={({ isActive }) =>
          cn("flex items-center gap-4 px-2.5 py-2 rounded-lg", isActive ? "text-sidebar-primary bg-sidebar-accent" : "text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent")
        }
        onClick={onLinkClick}
      >
        <BarChart2 className="h-5 w-5" /> Resultados
      </NavLink>
      <NavLink
        to="/ai-chat"
        className={({ isActive }) =>
          cn("flex items-center gap-4 px-2.5 py-2 rounded-lg", isActive ? "text-sidebar-primary bg-sidebar-accent" : "text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent")
        }
        onClick={onLinkClick}
      >
        <MessageSquare className="h-5 w-5" /> Chat IA
      </NavLink>
      <NavLink
        to="/settings"
        className={({ isActive }) =>
          cn("flex items-center gap-4 px-2.5 py-2 rounded-lg", isActive ? "text-sidebar-primary bg-sidebar-accent" : "text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent")
        }
        onClick={onLinkClick}
      >
        <Settings className="h-5 w-5" /> Configurações
      </NavLink>
      <div className="mt-auto pt-4 border-t border-sidebar-border">
        <Button
          onClick={onLogout}
          className="w-full justify-start text-red-500 hover:bg-red-500/10"
          variant="ghost"
        >
          <LogOut className="mr-2 h-5 w-5" /> Sair
        </Button>
      </div>
    </nav>
  );
};

export default MobileNavLinks;