"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { NavLink } from "react-router-dom";
import { ThemeToggle } from "@/components/ThemeToggle";

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
          <SheetContent side="left" className="sm:max-w-xs bg-sidebar">
            <nav className="grid gap-6 text-lg font-medium p-4">
              <NavLink
                to="/dashboard"
                className={({ isActive }) =>
                  `flex items-center gap-4 px-2.5 py-2 rounded-lg ${isActive ? "text-sidebar-primary bg-sidebar-accent" : "text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent"}`
                }
              >
                Dashboard
              </NavLink>
              <NavLink
                to="/tasks"
                className={({ isActive }) =>
                  `flex items-center gap-4 px-2.5 py-2 rounded-lg ${isActive ? "text-sidebar-primary bg-sidebar-accent" : "text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent"}`
                }
              >
                Tarefas
              </NavLink>
              <NavLink
                to="/goals"
                className={({ isActive }) =>
                  `flex items-center gap-4 px-2.5 py-2 rounded-lg ${isActive ? "text-sidebar-primary bg-sidebar-accent" : "text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent"}`
                }
                >
                Metas
              </NavLink>
              <NavLink
                to="/books"
                className={({ isActive }) =>
                  `flex items-center gap-4 px-2.5 py-2 rounded-lg ${isActive ? "text-primary bg-accent" : "text-muted-foreground hover:text-foreground"}`
                }
              >
                Livros
              </NavLink>
              <NavLink
                to="/motivation"
                className={({ isActive }) =>
                  `flex items-center gap-4 px-2.5 py-2 rounded-lg ${isActive ? "text-sidebar-primary bg-sidebar-accent" : "text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent"}`
                }
              >
                Motivação
              </NavLink>
              <NavLink
                to="/ai-chat" // Novo link para o chat de IA
                className={({ isActive }) =>
                  `flex items-center gap-4 px-2.5 py-2 rounded-lg ${isActive ? "text-sidebar-primary bg-sidebar-accent" : "text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent"}`
                }
              >
                Chat IA
              </NavLink>
              <NavLink
                to="/settings"
                className={({ isActive }) =>
                  `flex items-center gap-4 px-2.5 py-2 rounded-lg ${isActive ? "text-sidebar-primary bg-sidebar-accent" : "text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent"}`
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
        <ThemeToggle />
      </div>
    </header>
  );
};

export default Header;