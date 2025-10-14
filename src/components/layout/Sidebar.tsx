"use client";

import React from "react";
import { NavLink, Link } from "react-router-dom";
import { Home, ListTodo, Target, Sparkles, Settings, BookOpen } from "lucide-react"; // Importar BookOpen
import { cn } from "@/lib/utils";

interface SidebarProps {
  className?: string;
}

const Sidebar: React.FC<SidebarProps> = ({ className }) => {
  return (
    <div className={cn("hidden border-r bg-muted/40 md:block", className)}>
      <div className="flex h-full max-h-screen flex-col gap-2">
        <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <span className="text-lg">Minha Vida</span>
          </Link>
        </div>
        <div className="flex-1">
          <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
            <NavLink
              to="/dashboard"
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 transition-all hover:text-primary",
                  isActive ? "bg-muted text-primary" : "text-muted-foreground"
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
                  "flex items-center gap-3 rounded-lg px-3 py-2 transition-all hover:text-primary",
                  isActive ? "bg-muted text-primary" : "text-muted-foreground"
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
                  "flex items-center gap-3 rounded-lg px-3 py-2 transition-all hover:text-primary",
                  isActive ? "bg-muted text-primary" : "text-muted-foreground"
                )
              }
            >
              <Target className="h-4 w-4" />
              Metas
            </NavLink>
            <NavLink
              to="/books" // Novo link para Books
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 transition-all hover:text-primary",
                  isActive ? "bg-muted text-primary" : "text-muted-foreground"
                )
              }
            >
              <BookOpen className="h-4 w-4" /> {/* Ícone para Books */}
              Livros
            </NavLink>
            <NavLink
              to="/motivation"
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 transition-all hover:text-primary",
                  isActive ? "bg-muted text-primary" : "text-muted-foreground"
                )
              }
            >
              <Sparkles className="h-4 w-4" />
              Motivação
            </NavLink>
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 transition-all hover:text-primary",
                  isActive ? "bg-muted text-primary" : "text-muted-foreground"
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