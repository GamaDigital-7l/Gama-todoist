import { Link, useLocation } from "react-router-dom";
import { Home, ListTodo, Goal, Book, Brain, Heart, NotebookPen, CalendarDays, Users, MessageSquare, Settings, BarChart3, Download, Wallet, Menu } from "lucide-react"; // Adicionado ícone Wallet e Menu
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import React, { useState, useEffect } from "react";
import { showSuccess, showInfo } from "@/utils/toast";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const location = useLocation();
  const [deferredPrompt, setDeferredPrompt] = useState<Event | null>(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = () => {
    if (deferredPrompt) {
      (deferredPrompt as any).prompt();
      (deferredPrompt as any).userChoice.then((choiceResult: any) => {
        if (choiceResult.outcome === 'accepted') {
          showSuccess('Nexus Flow instalado com sucesso!');
        } else {
          showInfo('Instalação cancelada.');
        }
        setDeferredPrompt(null);
      });
    }
  };

  const navItems = [
    { name: "Dashboard", path: "/dashboard", icon: Home },
    { name: "Tarefas", path: "/tasks", icon: ListTodo },
    { name: "Planner", path: "/planner", icon: CalendarDays },
    { name: "Metas", path: "/goals", icon: Goal },
    { name: "Clientes", path: "/clients", icon: Users },
    { name: "Financeiro", path: "/finance", icon: Wallet }, // Novo item de navegação
    { name: "Estudo", path: "/study", icon: Brain },
    { name: "Saúde", path: "/health", icon: Heart },
    { name: "Livros", path: "/books", icon: Book },
    { name: "Notas", path: "/notes", icon: NotebookPen },
    { name: "AI Chat", path: "/ai-chat", icon: MessageSquare },
    { name: "Resultados", path: "/results", icon: BarChart3 },
    { name: "Configurações", path: "/settings", icon: Settings },
  ];

  return (
    <div
      className={cn(
        "fixed inset-y-0 left-0 z-50 flex h-full w-64 flex-col border-r border-sidebar-border bg-sidebar-background transition-transform duration-300 ease-in-out md:relative md:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}
    >
      <div className="flex h-16 items-center border-b border-sidebar-border px-4 lg:px-6">
        <Link to="/" className="flex items-center gap-2 font-semibold text-sidebar-primary text-xl">
          <span className="text-sidebar-primary-foreground">Nexus Flow</span>
        </Link>
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto md:hidden"
          onClick={onClose}
        >
          <Menu className="h-5 w-5 text-sidebar-foreground" />
          <span className="sr-only">Close sidebar</span>
        </Button>
      </div>
      <nav className="flex-1 overflow-auto py-4">
        <ul className="grid items-start gap-2 px-4 text-sm font-medium lg:px-6">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || (item.path !== "/" && location.pathname.startsWith(item.path + "/"));
            return (
              <li key={item.name}>
                <Link
                  to={item.path}
                  className={cn(
                    "nav-link-base",
                    isActive ? "nav-link-active" : "nav-link-inactive"
                  )}
                  onClick={onClose}
                >
                  <Icon className="h-5 w-5" />
                  {item.name}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="mt-auto p-4 border-t border-sidebar-border">
        {deferredPrompt && (
          <Button onClick={handleInstallClick} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
            <Download className="mr-2 h-4 w-4" /> Instalar App
          </Button>
        )}
      </div>
    </div>
  );
};