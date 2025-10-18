import { useState, useEffect, useCallback } from "react"; // Importar useEffect e useCallback
import { Outlet, useNavigate } from "react-router-dom"; // Importar useNavigate
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { motion, AnimatePresence } from "framer-motion"; // Importar motion e AnimatePresence
import { Loader2 } from "lucide-react"; // Ícone de loading

const Layout = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false); // Estado de loading global
  const navigate = useNavigate();

  // Função para simular um loading (pode ser integrado com React Query ou outras lógicas)
  const startLoading = () => setIsLoading(true);
  const stopLoading = () => setIsLoading(false);

  // Atalhos de teclado para desktop
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Ctrl + N ou Cmd + N para Nova Tarefa
    if ((event.ctrlKey || event.metaKey) && event.key === 'n') {
      event.preventDefault();
      navigate('/tasks', { state: { openNewTaskForm: true } });
    }
    // Ctrl + D ou Cmd + D para Dashboard
    if ((event.ctrlKey || event.metaKey) && event.key === 'd') {
      event.preventDefault();
      navigate('/dashboard');
    }
    // Ctrl + S ou Cmd + S para Configurações
    if ((event.ctrlKey || event.metaKey) && event.key === 's') {
      event.preventDefault();
      navigate('/settings');
    }
  }, [navigate]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

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