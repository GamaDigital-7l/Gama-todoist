"use client";

import React from "react";
import { Outlet } from "react-router-dom";
import Header from "./Header";
import Sidebar from "./Sidebar";
import { useIsMobile } from "@/hooks/use-mobile";

const Layout: React.FC = () => {
  const isMobile = useIsMobile();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false); // Controla a visibilidade da sidebar desktop
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false); // Controla a abertura do Sheet mobile

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  // O useEffect problemático foi removido daqui.
  // A sidebar desktop agora será controlada apenas pelos botões de toggle.

  // Determinar as colunas do grid com base no estado da sidebar e tamanho da tela
  const gridColsClass = isSidebarOpen
    ? "md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]"
    : "md:grid-cols-[0px_1fr] lg:grid-cols-[0px_1fr]"; // Sidebar colapsada em desktop

  return (
    <div className={`grid min-h-screen w-full ${gridColsClass}`}>
      {/* Sidebar para desktop (controlada por isSidebarOpen) */}
      <Sidebar isSidebarOpen={isSidebarOpen} toggleSidebar={toggleSidebar} />
      
      <div className="flex flex-col">
        {/* Header recebe os estados para controlar o menu mobile e o botão de toggle desktop */}
        <Header 
          toggleSidebar={toggleSidebar} 
          isSidebarOpen={isSidebarOpen} 
          isMobileMenuOpen={isMobileMenuOpen}
          setIsMobileMenuOpen={setIsMobileMenuOpen}
        />
        <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;