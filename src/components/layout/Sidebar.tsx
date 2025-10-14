"use client";

import React from "react";
import { NavLink, Link } from "react-router-dom";
import { Home, ListTodo, Target, Sparkles, Settings, BookOpen, MessageSquare, GraduationCap, HeartPulse } from "lucide-react";
import { cn } from "@/lib/utils"; // Importar cn

interface SidebarProps {
  className?: string;
}

const Sidebar: React.FC<SidebarProps> = ({ className }) => {
  const navLinkClasses = (isActive: boolean) =>
    cn(
      "flex items-center gap-3 rounded-lg px-3 py-2 transition-all",
      isActive ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm" : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
    );

  return (
    <div className={cn("hidden border-r bg-sidebar md:block", className)}>
      <div className="flex h-full max-h-screen flex-col gap-2">
        <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
          <Link to="/" className="flex items-center gap-2 font-semibold text-sidebar-foreground">
            <span className="text-lg">Minha Vida</span>
          </Link>
        </div>
        <div className="flex-1 py-2">
          <nav className="grid items-start px-4 text-sm font-medium lg:px-6 gap-1">
            <NavLink to="/dashboard" className={({ isActive }) => navLinkClasses(isActive)}>
              <Home className="h-4 w-4" />
              Dashboard
            </NavLink>
            <NavLink to="/tasks" className={({ isActive }) => navLinkClasses(isActive)}>
              <ListTodo className="h-4 w-4" />
              Tarefas
            </NavLink>
            <NavLink to="/goals" className={({ isActive }) => navLinkClasses(isActive)}>
              <Target className="h-4 w-4" />
              Metas
            </NavLink>
            <NavLink to="/books" className={({ isActive }) => navLinkClasses(isActive)}>
              <BookOpen className="h-4 w-4" />
              Livros
            </NavLink>
            <NavLink to="/study" className={({ isActive }) => navLinkClasses(isActive)}>
              <GraduationCap className="h-4 w-4" />
              Estudos
            </NavLink>
            <NavLink to="/health" className={({ isActive }) => navLinkClasses(isActive)}>
              <HeartPulse className="h-4 w-4" />
              Saúde
            </NavLink>
            <NavLink to="/motivation" className={({ isActive }) => navLinkClasses(isActive)}>
              <Sparkles className="h-4 w-4" />
              Motivação
            </NavLink>
            <NavLink to="/ai-chat" className={({ isActive }) => navLinkClasses(isActive)}>
              <MessageSquare className="h-4 w-4" />
              Chat IA
            </NavLink>
            <NavLink to="/settings" className={({ isActive }) => navLinkClasses(isActive)}>
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