"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { NavLink } from "react-router-dom";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Home, ListTodo, Target, Sparkles, Settings, BookOpen, MessageSquare, GraduationCap, HeartPulse, NotebookText } from "lucide-react";

interface HeaderProps {
  toggleSidebar: () => void;
  isSidebarOpen: boolean;
}

const Header: React.FC<HeaderProps> = ({ toggleSidebar, isSidebarOpen }) => {
  const isMobile = useIsMobile();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
      {/* Gatilho do Sheet para mobile */}
      {isMobile ? (
        <Sheet open={isSidebarOpen} onOpenChange={toggleSidebar}>
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
                onClick={toggleSidebar}
              >
                <Home className="h-5 w-5" /> Dashboard
              </NavLink>
              <NavLink
                to="/tasks"
                className={({ isActive }) =>
                  `flex items-center gap-4 px-2.5 py-2 rounded-lg ${isActive ? "text-sidebar-primary bg-sidebar-accent" : "text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent"}`
                }
                onClick={toggleSidebar}
              >
                <ListTodo className="h-5 w-5" /> Tarefas
              </NavLink>
              <NavLink
                to="/goals"
                className={({ isActive }) =>
                  `flex items-center gap-4 px-2.5 py-2 rounded-lg ${isActive ? "text-sidebar-primary bg-sidebar-accent" : "text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent"}`
                }
                onClick={toggleSidebar}
                >
                <Target className="h-5 w-5" /> Metas
              </NavLink>
              <NavLink
                to="/books"
                className={({ isActive }) =>
                  `flex items-center gap-4 px-2.5 py-2 rounded-lg ${isActive ? "text-sidebar-primary bg-sidebar-accent" : "text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent"}`
                }
                onClick={toggleSidebar}
              >
                <BookOpen className="h-5 w-5" /> Livros
              </NavLink>
              <NavLink
                to="/study"
                className={({ isActive }) =>
                  `flex items-center gap-4 px-2.5 py-2 rounded-lg ${isActive ? "text-sidebar-primary bg-sidebar-accent" : "text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent"}`
                }
                onClick={toggleSidebar}
              >
                <GraduationCap className="h-5 w-5" /> Estudos
              </NavLink>
              <NavLink
                to="/health"
                className={({ isActive }) =>
                  `flex items-center gap-4 px-2.5 py-2 rounded-lg ${isActive ? "text-sidebar-primary bg-sidebar-accent" : "text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent"}`
                }
                onClick={toggleSidebar}
              >
                <HeartPulse className="h-5 w-5" /> Saúde
              </NavLink>
              <NavLink
                to="/notes"
                className={({ isActive }) =>
                  `flex items-center gap-4 px-2.5 py-2 rounded-lg ${isActive ? "text-sidebar-primary bg-sidebar-accent" : "text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent"}`
                }
                onClick={toggleSidebar}
              >
                <NotebookText className="h-5 w-5" /> Notas
              </NavLink>
              <NavLink
                to="/ai-chat"
                className={({ isActive }) =>
                  `flex items-center gap-4 px-2.5 py-2 rounded-lg ${isActive ? "text-sidebar-primary bg-sidebar-accent" : "text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent"}`
                }
                onClick={toggleSidebar}
              >
                <MessageSquare className="h-5 w-5" /> Chat IA
              </NavLink>
              <NavLink
                to="/settings"
                className={({ isActive }) =>
                  `flex items-center gap-4 px-2.5 py-2 rounded-lg ${isActive ? "text-sidebar-primary bg-sidebar-accent" : "text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent"}`
                }
                onClick={toggleSidebar}
              >
                <Settings className="h-5 w-5" /> Configurações
              </NavLink>
            </nav>
          </SheetContent>
        </Sheet>
      ) : (
        // Botão de alternância da Sidebar para desktop
        !isSidebarOpen && (
          <Button size="icon" variant="outline" onClick={toggleSidebar} className="hidden md:flex">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Abrir Menu</span>
          </Button>
        )
      )}

      <h1 className="text-base sm:text-xl font-semibold truncate flex-1 text-center sm:text-left">Nexus Flow</h1>
      <div className="ml-auto flex items-center gap-4">
        <ThemeToggle />
      </div>
    </header>
  );
};

export default Header;