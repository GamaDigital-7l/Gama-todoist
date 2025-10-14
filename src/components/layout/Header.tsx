"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { NavLink } from "react-router-dom";
import { ThemeToggle } from "@/components/ThemeToggle";
import { cn } from "@/lib/utils"; // Importar cn

interface HeaderProps {
  toggleSidebar: () => void;
}

const Header: React.FC<HeaderProps> = ({ toggleSidebar }) => {
  const isMobile = useIsMobile();

  const navLinkClasses = (isActive: boolean) =>
    cn(
      "flex items-center gap-4 px-2.5 py-2 rounded-lg",
      isActive
        ? "text-sidebar-primary bg-sidebar-accent"
        : "text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent",
    );

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
      {isMobile && (
        <Sheet>
          <SheetTrigger asChild>
            <Button size="icon" variant="outline" className="sm:hidden">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Alternar Menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="sm:max-w-xs bg-sidebar">
            <nav className="grid gap-6 text-lg font-medium p-4">
              <NavLink to="/dashboard" className={({ isActive }) => navLinkClasses(isActive)}>
                Dashboard
              </NavLink>
              <NavLink to="/tasks" className={({ isActive }) => navLinkClasses(isActive)}>
                Tarefas
              </NavLink>
              <NavLink to="/goals" className={({ isActive }) => navLinkClasses(isActive)}>
                Metas
              </NavLink>
              <NavLink to="/books" className={({ isActive }) => navLinkClasses(isActive)}>
                Livros
              </NavLink>
              <NavLink to="/study" className={({ isActive }) => navLinkClasses(isActive)}>
                Estudos
              </NavLink>
              <NavLink to="/health" className={({ isActive }) => navLinkClasses(isActive)}>
                Saúde
              </NavLink>
              <NavLink to="/motivation" className={({ isActive }) => navLinkClasses(isActive)}>
                Motivação
              </NavLink>
              <NavLink to="/ai-chat" className={({ isActive }) => navLinkClasses(isActive)}>
                Chat IA
              </NavLink>
              <NavLink to="/settings" className={({ isActive }) => navLinkClasses(isActive)}>
                Configurações
              </NavLink>
            </nav>
          </SheetContent>
        </Sheet>
      )}
      <h1 className="text-xl font-semibold">Minha Netflix da Vida Pessoal</h1>
      <div className="ml-auto flex items-center gap-4">
        <ThemeToggle />
      </div>
    </header>
  );
};

export default Header;