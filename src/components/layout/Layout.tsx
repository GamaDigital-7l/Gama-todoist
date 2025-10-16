"use client";

import React from "react";
import { Outlet } from "react-router-dom";
import Header from "./Header";
import Sidebar from "./Sidebar";
import { useIsMobile } from "@/hooks/use-mobile";

const Layout: React.FC = () => {
  const isMobile = useIsMobile();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  // Fechar sidebar automaticamente em desktop se estiver aberta por engano
  React.useEffect(() => {
    if (!isMobile && isSidebarOpen) {
      setIsSidebarOpen(false);
    }
  }, [isMobile, isSidebarOpen]);

  // Determinar as colunas do grid com base no estado da sidebar e tamanho da tela
  const gridColsClass = isSidebarOpen
    ? "md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]"
    : "md:grid-cols-[0px_1fr] lg:grid-cols-[0px_1fr]"; // Sidebar colapsada em desktop

  return (
    <div className={`grid min-h-screen w-full ${gridColsClass}`}>
      {/* Sidebar para desktop e mobile (controlada internamente) */}
      <Sidebar isSidebarOpen={isSidebarOpen} toggleSidebar={toggleSidebar} />
      
      <div className="flex flex-col">
        {/* Pass setIsSidebarOpen para o Header para que o Sheet possa controlar seu próprio estado */}
        <Header toggleSidebar={toggleSidebar} setIsSidebarOpen={setIsSidebarOpen} isSidebarOpen={isSidebarOpen} />
        <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;