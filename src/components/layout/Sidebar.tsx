"use client";

import React from "react";
import { NavLink, Link } from "react-router-dom";
import { Home, ListTodo, Target, Sparkles, Settings, BookOpen, MessageSquare, GraduationCap, HeartPulse, NotebookText, X, CalendarDays, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface SidebarProps {
  className?: string;
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ className, isSidebarOpen, toggleSidebar }) => {
  return (
    <div className={cn(
      "fixed inset-y-0 left-0 z-40 flex flex-col h-full border-r border-sidebar-border bg-sidebar-background transition-all duration-300 ease-in-out frosted-glass",
      "md:relative",
      isSidebarOpen ? "w-[220px] lg:w-[280px]" : "w-0 overflow-hidden",
      className
    )}>
      <div className="flex h-14 items-center border-b border-sidebar-border px-4 lg:h-[60px] lg:px-6">
        <Link to="/" className="flex items-center gap-2 font-semibold text-sidebar-foreground">
          <span className="text-lg">Nexus Flow</span>
        </Link>
        {isSidebarOpen && (
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="ml-auto h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hidden md:flex"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Fechar Sidebar</span>
          </Button>
        )}
      </div>
      <div className="flex-1 py-2 overflow-y-auto">
        <nav className="grid items-start px-4 text-sm font-medium lg:px-6 gap-1">
          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              cn(
                "nav-link-base",
                isActive ? "nav-link-active" : "nav-link-inactive"
              )
            }
          >
            <Home className="h-4 w-4" />
            Dashboard
          </NavLink>
          <NavLink
            to="/planner"
            className={({ isActive }) =>
              cn(
                "nav-link-base",
                isActive ? "nav-link-active" : "nav-link-inactive"
              )
            }
          >
            <CalendarDays className="h-4 w-4" />
            Planner
          </NavLink>
          <NavLink
            to="/tasks"
            className={({ isActive }) =>
              cn(
                "nav-link-base",
                isActive ? "nav-link-active" : "nav-link-inactive"
              )
            }
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
          >
            <NotebookText className="h-4 w-4" />
            Notas
          </NavLink>
          <NavLink
            to="/clients"
            className={({ isActive }) =>
              cn(
                "nav-link-base",
                isActive ? "nav-link-active" : "nav-link-inactive"
              )
            }
          >
            <Users className="h-4 w-4" />
            Clientes
          </NavLink>
          <NavLink
            to="/ai-chat"
            className={({ isActive }) =>
              cn(
                "nav-link-base",
                isActive ? "nav-link-active" : "nav-link-inactive"
              )
            }
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
          >
            <Settings className="h-4 w-4" />
            Configurações
          </NavLink>
        </nav>
      </div>
      <div className="mt-auto p-4 border-t border-sidebar-border">
        {/* Elementos de usuário/login removidos */}
      </div>
    </div>
  );
};

export default Sidebar;