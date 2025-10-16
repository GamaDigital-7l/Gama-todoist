"use client";

import React from "react";
import { NavLink, Link } from "react-router-dom";
import { Home, ListTodo, Target, Sparkles, Settings, BookOpen, MessageSquare, GraduationCap, HeartPulse } from "lucide-react"; // Importar HeartPulse
import { cn } from "@/lib/utils";

interface SidebarProps {
  className?: string;
}

const Sidebar: React.FC<SidebarProps> = ({ className }) => {
  return (
    <div className={cn("hidden border-r bg-sidebar md:block", className)}>
      <div className="flex h-full max-h-screen flex-col gap-2">
        <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
          <Link to="/" className="flex items-center gap-2 font-semibold text-sidebar-foreground">
            <span className="text-lg">Nexus Flow</span>
          </Link>
        </div>
        <div className="flex-1 py-2">
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
              to="/health" // Novo link para saúde
              className={({ isActive }) =>
                cn(
                  "nav-link-base",
                  isActive ? "nav-link-active" : "nav-link-inactive"
                )
              }
            >
              <HeartPulse className="h-4 w-4" /> {/* Ícone para saúde */}
              Saúde
            </NavLink>
            {/* Link de Motivação removido */}
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
        <div className="mt-auto p-4 border-t">
          {/* Elementos de usuário/login removidos */}
        </div>
      </div>
    </div>
  );
};

export default Sidebar;