"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu, LogOut } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSupabase } from "@/integrations/supabase/supabaseContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface HeaderProps {
  toggleSidebar: () => void;
}

const Header: React.FC<HeaderProps> = ({ toggleSidebar }) => {
  const isMobile = useIsMobile();
  const { session } = useSupabase();
  const navigate = useNavigate();

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Erro ao fazer logout: " + error.message);
    } else {
      toast.success("Logout realizado com sucesso!");
      navigate('/login');
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
      {isMobile && (
        <Sheet>
          <SheetTrigger asChild>
            <Button size="icon" variant="outline" className="sm:hidden">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle Menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="sm:max-w-xs">
            <nav className="grid gap-6 text-lg font-medium">
              <a
                href="/dashboard"
                className="flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground"
              >
                Dashboard
              </a>
              <a
                href="/tasks"
                className="flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground"
              >
                Tarefas
              </a>
              <a
                href="/goals"
                className="flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground"
              >
                Metas
              </a>
              <a
                href="/motivation"
                className="flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground"
              >
                Motivação
              </a>
              <a
                href="/settings"
                className="flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground"
              >
                Configurações
              </a>
              {session && (
                <Button
                  variant="ghost"
                  onClick={handleLogout}
                  className="flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground"
                >
                  <LogOut className="h-5 w-5" />
                  Sair
                </Button>
              )}
            </nav>
          </SheetContent>
        </Sheet>
      )}
      <h1 className="text-xl font-semibold">Minha Netflix da Vida Pessoal</h1>
      <div className="ml-auto">
        {session && (
          <Button variant="ghost" onClick={handleLogout} className="hidden sm:flex">
            <LogOut className="h-5 w-5 mr-2" />
            Sair
          </Button>
        )}
      </div>
    </header>
  );
};

export default Header;