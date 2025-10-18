import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu, Bell, Plus, Download } from "lucide-react";
import { Link } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useSession } from "@/integrations/supabase/auth";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError, showInfo } from "@/utils/toast";
import React, { useState, useEffect } from "react";

interface HeaderProps {
  onMenuClick: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const { session } = useSession();
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

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      showSuccess("Desconectado com sucesso!");
    } catch (error: any) {
      showError("Erro ao desconectar: " + error.message);
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-40 flex h-[calc(4rem+var(--sat))] items-center gap-4 border-b border-border bg-background px-4 lg:px-6 shadow-sm frosted-glass pt-[var(--sat)]">
      <Sheet>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 md:hidden"
            onClick={onMenuClick}
          >
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle navigation menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="flex flex-col bg-sidebar-background border-r border-sidebar-border">
          {/* Conteúdo da Sidebar será renderizado aqui */}
        </SheetContent>
      </Sheet>
      <div className="flex-1 text-lg font-semibold">Nexus Flow</div>
      <div className="flex items-center gap-4">
        {deferredPrompt && (
          <Button variant="ghost" size="icon" onClick={handleInstallClick} className="text-primary hover:text-primary-light">
            <Download className="h-5 w-5" />
            <span className="sr-only">Instalar Aplicativo</span>
          </Button>
        )}
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary">
          <Bell className="h-5 w-5" />
          <span className="sr-only">Notificações</span>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
              <Avatar className="h-8 w-8">
                <AvatarImage src={session?.user?.user_metadata?.avatar_url || "https://github.com/shadcn.png"} alt="Avatar" />
                <AvatarFallback>{session?.user?.email?.[0]?.toUpperCase() || "U"}</AvatarFallback>
              </Avatar>
              <span className="sr-only">Toggle user menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-popover border border-border text-popover-foreground">
            <DropdownMenuLabel>Minha Conta</DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-border" />
            <DropdownMenuItem asChild>
              <Link to="/settings" className="cursor-pointer">Configurações</Link>
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer">Suporte</DropdownMenuItem>
            <DropdownMenuSeparator className="bg-border" />
            <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive hover:bg-destructive/10">
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};