import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { motion, AnimatePresence } from "framer-motion"; // Importar motion e AnimatePresence
import { Loader2 } from "lucide-react"; // Ícone de loading

const Layout = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false); // Estado de loading global

  // Função para simular um loading (pode ser integrado com React Query ou outras lógicas)
  const startLoading = () => setIsLoading(true);
  const stopLoading = () => setIsLoading(false);

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <div className="flex flex-col flex-1">
        <Header onMenuClick={() => setIsSidebarOpen(true)} />
        <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6 overflow-auto relative">
          <AnimatePresence>
            {isLoading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex items-center justify-center bg-background/80 z-50"
              >
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
              </motion.div>
            )}
          </AnimatePresence>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;