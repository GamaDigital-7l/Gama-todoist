"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu, LogOut, User as UserIcon } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { NavLink, useNavigate } from "react-router-dom";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Home, ListTodo, Target, Sparkles, Settings, BookOpen, MessageSquare, GraduationCap, HeartPulse, NotebookText, CalendarDays, Users, BarChart2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useSession } from "@/integrations/supabase/auth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import MobileNavLinks from './MobileNavLinks'; // Importar o novo componente

interface HeaderProps {
  toggleSidebar: () => void;
  isSidebarOpen: boolean;
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

interface UserProfile {
  first_name?: string | null;
  last_name?: string | null;
  avatar_url?: string | null;
}

const fetchUserProfile = async (userId: string): Promise<UserProfile | null> => {
  const { data, error } = await supabase
    .from("profiles")
    .select("first_name, last_name, avatar_url")
    .eq("id", userId)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }
  return data || null;
};

const Header: React.FC<HeaderProps> = ({ toggleSidebar, isSidebarOpen, isMobileMenuOpen, setIsMobileMenuOpen }) => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { session } = useSession();
  const userId = session?.user?.id;

  const { data: userProfile, isLoading: isLoadingProfile, error: profileError } = useQuery<UserProfile | null, Error>({
    queryKey: ["userProfile", userId],
    queryFn: () => fetchUserProfile(userId!),
    enabled: !!userId,
  });

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      showSuccess("Você foi desconectado com sucesso!");
      navigate("/login");
    } catch (err: any) {
      showError("Erro ao fazer logout: " + err.message);
      console.error("Erro ao fazer logout:", err);
    }
  };

  const displayName = userProfile?.first_name || session?.user?.email?.split('@')[0] || "Usuário";
  const displayInitials = (userProfile?.first_name?.charAt(0) || session?.user?.email?.charAt(0) || "U").toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-border bg-background px-4 md:px-6 lg:px-8 sm:static sm:h-auto sm:border-0 sm:bg-transparent"> {/* Ajustado padding */}
      {/* Gatilho do Sheet para mobile */}
      {isMobile ? (
        <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button size="icon" variant="outline" className="sm:hidden">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Alternar Menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="sm:max-w-xs bg-sidebar-background border-r border-sidebar-border">
            <MobileNavLinks onLinkClick={() => setIsMobileMenuOpen(false)} onLogout={handleLogout} />
          </SheetContent>
        </Sheet>
      ) : (
        !isSidebarOpen && (
          <Button size="icon" variant="outline" onClick={toggleSidebar} className="hidden md:flex">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Abrir Menu</span>
          </Button>
        )
      )}

      <h1 className="text-base sm:text-xl font-semibold truncate flex-1 text-center sm:text-left min-w-0">Nexus Flow</h1>
      <div className="ml-auto flex items-center gap-4">
        <ThemeToggle />
        {session && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full h-9 w-9">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={userProfile?.avatar_url || undefined} alt={displayName} />
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    {displayInitials}
                  </AvatarFallback>
                </Avatar>
                <span className="sr-only">Menu do Usuário</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-popover border-border rounded-md shadow-lg">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none text-foreground">{displayName}</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {session.user.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/settings")} className="cursor-pointer">
                <UserIcon className="mr-2 h-4 w-4" /> Perfil
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-500 hover:bg-red-500/10">
                <LogOut className="mr-2 h-4 w-4" /> Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
};

export default Header;