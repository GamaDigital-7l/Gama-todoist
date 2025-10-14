"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { NavLink } from "react-router-dom";
import { ThemeToggle } from "@/components/ThemeToggle"; // Importar ThemeToggle

interface HeaderProps {
  toggleSidebar: () => void;
}

const Header: React.FC<HeaderProps> = ({ toggleSidebar }) => {
  const isMobile = useIsMobile();

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
          <SheetContent side="left" className="sm:max-w-xs">
            <nav className="grid gap-6 text-lg font-medium">
              <NavLink
                to="/dashboard"
                className={({ isActive }) =>
                  `flex items-center gap-4 px-2.5 ${isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"}`
                }
              >
                Dashboard
              </NavLink>
              <NavLink
                to="/tasks"
                className={({ isActive }) =>
                  `flex items-center gap-4 px-2.5 ${isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"}`
                }
              >
                Tarefas
              </NavLink>
              <NavLink
                to="/goals"
                className={({ isActive }) =>
                  `flex items-center gap-4 px-2.5 ${isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"}`
                }
                >
                Metas
              </NavLink>
              <NavLink
                to="/books"
                className={({ isActive }) =>
                  `flex items-center gap-4 px-2.5 ${isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"}`
                }
              >
                Livros
              </NavLink>
              <NavLink
                to="/motivation"
                className={({ isActive }) =>
                  `flex items-center gap-4 px-2.5 ${isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"}`
                }
              >
                Motivação
              </NavLink>
              <NavLink
                to="/settings"
                className={({ isActive }) =>
                  `flex items-center gap-4 px-2.5 ${isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"}`
                }
              >
                Configurações
              </NavLink>
            </nav>
          </SheetContent>
        </Sheet>
      )}
      <h1 className="text-xl font-semibold">Minha Netflix da Vida Pessoal</h1>
      <div className="ml-auto flex items-center gap-4">
        <ThemeToggle /> {/* Adicionar o botão de alternância de tema aqui */}
      </div>
    </header>
  );
};

export default Header;