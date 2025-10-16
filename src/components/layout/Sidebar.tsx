"use client";

import React from "react";
import { NavLink, Link } from "react-router-dom";
import { Home, ListTodo, Target, Sparkles, Settings, BookOpen, MessageSquare, GraduationCap, HeartPulse, NotebookText, X, CalendarDays } from "lucide-react"; // Importar CalendarDays
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button"; // Importar Button

interface SidebarProps {
  className?: string;
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ className, isSidebarOpen, toggleSidebar }) => {
  return (
    <div className={cn(
      "fixed inset-y-0 left-0 z-40 flex flex-col h-full border-r bg-sidebar transition-all duration-300 ease-in-out",
      "md:relative", // Torna a sidebar relativa em telas md e maiores
      isSidebarOpen ? "w-[220px] lg:w-[280px]" : "w-0 overflow-hidden", // Controla a largura e overflow
      className
    )}>
      <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
        <Link to="/" className="flex items-center gap-2 font-semibold text-sidebar-foreground">
          <span className="text-lg">Nexus Flow</span>
        </Link>
        {/* Botão de fechar para a sidebar em desktop quando aberta */}
        {isSidebarOpen && (
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="ml-auto h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hidden md:flex" // Visível apenas em desktop quando a sidebar está aberta
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Fechar Sidebar</span>
          </Button>
        )}
      </div>
      <div className="flex-1 py-2 overflow-y-auto"> {/* Adicionado overflow-y-auto para rolagem */}
        <nav className="grid items-start px-4 text-sm font-medium lg:px-6 gap-1">
          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              cn(
                "nav-link-base",
                isActive ? "nav-link-active" : "nav-link-inactive"
              )
            }
            onClick={toggleSidebar} // Fecha a sidebar ao clicar em um link
          >
            <Home className="h-4 w-4" />
            Dashboard
          </NavLink>
          <NavLink
            to="/daily-planner" // Nova rota
            className={({ isActive }) =>
              cn(
                "nav-link-base",
                isActive ? "nav-link-active" : "nav-link-inactive"
              )
            }
            onClick={toggleSidebar}
          >
            <CalendarDays className="h-4 w-4" /> {/* Novo ícone */}
            Planejador Diário
          </NavLink>
          <NavLink
            to="/tasks"
            className={({ isActive }) =>
              cn(
                "nav-link-base",
                isActive ? "nav-link-active" : "nav-link-inactive"
              )
            }
            onClick={toggleSidebar}
          >
            <ListTodo className="h-4 w-4" />
            Tarefas
          </NavLink>
          <NavLink
            to="/goals"
            className={({ isActive }) =>
              cn(
                "nav-link-base",
                isActive ? "nav-link-active" : "nav-link-inactive"
              )
            }
            onClick={toggleSidebar}
          >
            <Target className="h-4 w-4" />
            Metas
          </NavLink>
          <NavLink
            to="/books"
            className={({ isActive }) =>
              cn(
                "nav-link-base",
                isActive ? "nav-link-active" : "nav-link-inactive"
              )
            }
            onClick={toggleSidebar}
          >
            <BookOpen className="h-4 w-4" />
            Livros
          </NavLink>
          <NavLink
            to="/study"
            className={({ isActive }) =>
              cn(
                "nav-link-base",
                isActive ? "nav-link-active" : "nav-link-inactive"
              )
            }
            onClick={toggleSidebar}
          >
            <GraduationCap className="h-4 w-4" />
            Estudos
          </NavLink>
          <NavLink
            to="/health"
            className={({ isActive }) =>
              cn(
                "nav-link-base",
                isActive ? "nav-link-active" : "nav-link-inactive"
              )
            }
            onClick={toggleSidebar}
          >
            <HeartPulse className="h-4 w-4" />
            Saúde
          </NavLink>
          <NavLink
            to="/notes"
            className={({ isActive }) =>
              cn(
                "nav-link-base",
                isActive ? "nav-link-active" : "nav-link-inactive"
              )
            }
            onClick={toggleSidebar}
          >
            <NotebookText className="h-4 w-4" />
            Notas
          </NavLink>
          <NavLink
            to="/ai-chat"
            className={({ isActive }) =>
              cn(
                "nav-link-base",
                isActive ? "nav-link-active" : "nav-link-inactive"
              )
            }
            onClick={toggleSidebar}
          >
            <MessageSquare className="h-4 w-4" />
            Chat IA
          </NavLink>
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              cn(
                "nav-link-base",
                isActive ? "nav-link-active" : "nav-link-inactive"
              )
            }
            onClick={toggleSidebar}
          >
            <Settings className="h-4 w-4" />
            Configurações
          </NavLink>
        </nav>
      </div>
      <div className="mt-auto p-4 border-t">
        {/* Elementos de usuário/login removidos */}
      </div>
    </div>
  );
};

export default Sidebar;