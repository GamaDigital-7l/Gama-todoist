import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import Layout from "./components/layout/Layout";
import Dashboard from "./pages/Dashboard";
import Tasks from "./pages/Tasks";
import Goals from "./pages/Goals";
import Settings from "./pages/Settings";
import Books from "./pages/Books";
import BookDetails from "./pages/BookDetails";
import BookReaderFullScreen from "./pages/BookReaderFullScreen";
import AIChat from "./pages/AIChat";
import Study from "./pages/Study";
import Health from "./pages/Health";
import Notes from "./pages/Notes";
import Planner from "./pages/Planner";
import Clients from "./pages/Clients";
import ClientDetails from "./pages/ClientDetails";
import ClientKanbanPage from "./pages/ClientKanbanPage";
import PublicApprovalPage from "./pages/PublicApprovalPage";
import Results from "./pages/Results";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import { SessionContextProvider, useSession } from "./integrations/supabase/auth";
import { ThemeProvider } from "./components/ThemeProvider";
import PushNotificationManager from "./components/PushNotificationManager";
import React, { useEffect, useState, Suspense, lazy } from "react";
import { showInfo, showSuccess, showError } from "./utils/toast";
import { AnimatePresence, motion } from "framer-motion";

// Lazy load de páginas para otimização de desempenho
const LazyDashboard = lazy(() => import("./pages/Dashboard"));
const LazyTasks = lazy(() => import("./pages/Tasks"));
const LazyGoals = lazy(() => import("./pages/Goals"));
const LazySettings = lazy(() => import("./pages/Settings"));
const LazyBooks = lazy(() => import("./pages/Books"));
const LazyBookDetails = lazy(() => import("./pages/BookDetails"));
const LazyBookReaderFullScreen = lazy(() => import("./pages/BookReaderFullScreen"));
const LazyAIChat = lazy(() => import("./pages/AIChat"));
const LazyStudy = lazy(() => import("./pages/Study"));
const LazyHealth = lazy(() => import("./pages/Health"));
const LazyNotes = lazy(() => import("./pages/Notes"));
const LazyPlanner = lazy(() => import("./pages/Planner"));
const LazyClients = lazy(() => import("./pages/Clients"));
const LazyClientDetails = lazy(() => import("./pages/ClientDetails"));
const LazyClientKanbanPage = lazy(() => import("./pages/ClientKanbanPage"));
const LazyPublicApprovalPage = lazy(() => import("./pages/PublicApprovalPage"));
const LazyResults = lazy(() => import("./pages/Results"));
const LazyNotFound = lazy(() => import("./pages/NotFound"));
const LazyLogin = lazy(() => import("./pages/Login"));


const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24, // Cache por 24 horas
      staleTime: 1000 * 60 * 5, // Dados considerados "frescos" por 5 minutos
    },
  },
});

// Configura o persister para usar localStorage
const localStoragePersister = createSyncStoragePersister({
  storage: window.localStorage,
});

// Persiste o QueryClient
persistQueryClient({
  queryClient,
  persister: localStoragePersister,
});

// Componente para proteger rotas
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session, isLoading } = useSession();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!isLoading && !session) {
      navigate('/login', { state: { from: location.pathname }, replace: true });
    }
  }, [session, isLoading, navigate, location]);

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-background text-foreground text-lg md:text-xl">Carregando autenticação...</div>;
  }

  if (!session) {
    return null; // Ou um spinner, mas Navigate já está cuidando do redirecionamento
  }

  return (
    <>
      <PushNotificationManager />
      {children}
    </>
  );
};

// Componente para gerenciar a conectividade e atualizações do PWA
const PWAHandler: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [newVersionAvailable, setNewVersionAvailable] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<Event | null>(null);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      showSuccess("Você está online novamente!");
      // Tentar sincronizar requisições pendentes
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then(registration => {
          if (registration.sync) {
            registration.sync.register('offline-post-sync');
          }
        });
      }
    };
    const handleOffline = () => {
      setIsOnline(false);
      showError("Você está offline. Algumas funcionalidades podem estar limitadas.");
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Lógica para detectar atualização do Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'APP_UPDATE') {
          setNewVersionAvailable(true);
          showInfo("Uma nova versão do aplicativo está disponível! Clique para atualizar.", {
            action: {
              label: "Atualizar",
              onClick: () => {
                if (navigator.serviceWorker.controller) {
                  navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
                  window.location.reload();
                }
              },
            },
          });
        }
      });
    }

    // Lógica para o evento beforeinstallprompt (para instalação manual)
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      showInfo("Instale o Nexus Flow para uma experiência completa!", {
        action: {
          label: "Instalar",
          onClick: () => {
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
          },
        },
        duration: 10000, // Mostrar por 10 segundos
      });
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [deferredPrompt, navigate, location]);

  // Lógica de Deep Linking
  useEffect(() => {
    const handleDeepLink = () => {
      const path = window.location.pathname;
      const search = window.location.search;

      // Exemplo de deep links internos
      if (path.startsWith('/tasks') && search.includes('action=new')) {
        // Lógica para abrir o formulário de nova tarefa
        // Isso pode ser feito via estado global ou redirecionamento para uma rota com modal
        navigate('/tasks', { state: { openNewTaskForm: true } });
      } else if (path.startsWith('/clients') && search.includes('openTaskId=')) {
        const taskId = new URLSearchParams(search).get('openTaskId');
        const clientId = path.split('/')[2]; // Assumindo /clients/:id
        if (clientId && taskId) {
          navigate(`/clients/${clientId}?openTaskId=${taskId}`);
        }
      } else if (path.startsWith('/approval/')) {
        // Já é uma rota pública, não precisa de redirecionamento extra
      }
      // Adicione mais lógica de deep linking conforme necessário
    };

    // Executar ao carregar a página
    handleDeepLink();

    // Adicionar listener para mudanças de URL (se o app já estiver aberto e um deep link for ativado)
    window.addEventListener('popstate', handleDeepLink);
    return () => window.removeEventListener('popstate', handleDeepLink);
  }, [navigate, location]);


  return null; // Este componente não renderiza nada visível
};

const App = () => {
  const location = useLocation(); // Usar useLocation dentro do componente App

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
        <TooltipProvider>
          <Sonner />
          <BrowserRouter>
            <SessionContextProvider>
              <PWAHandler />
              <AnimatePresence mode="wait">
                <Routes location={location} key={location.pathname}>
                  <Route path="/login" element={
                    <motion.div
                      initial={{ opacity: 0, x: -100 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 100 }}
                      transition={{ duration: 0.3 }}
                    >
                      <LazyLogin />
                    </motion.div>
                  } />
                  <Route path="/books/:id/read" element={
                    <motion.div
                      initial={{ opacity: 0, y: 50 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -50 }}
                      transition={{ duration: 0.3 }}
                    >
                      <ProtectedRoute><LazyBookReaderFullScreen /></ProtectedRoute>
                    </motion.div>
                  } />
                  <Route path="/approval/:uniqueId" element={
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <LazyPublicApprovalPage />
                    </motion.div>
                  } />
                  <Route
                    path="/"
                    element={
                      <ProtectedRoute>
                        <Layout />
                      </ProtectedRoute>
                    }
                  >
                    <Route index element={
                      <motion.div
                        initial={{ opacity: 0, x: 100 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -100 }}
                        transition={{ duration: 0.3 }}
                      >
                        <LazyDashboard />
                      </motion.div>
                    } />
                    <Route path="/dashboard" element={
                      <motion.div
                        initial={{ opacity: 0, x: 100 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -100 }}
                        transition={{ duration: 0.3 }}
                      >
                        <LazyDashboard />
                      </motion.div>
                    } />
                    <Route path="/tasks" element={
                      <motion.div
                        initial={{ opacity: 0, x: 100 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -100 }}
                        transition={{ duration: 0.3 }}
                      >
                        <LazyTasks />
                      </motion.div>
                    } />
                    <Route path="/goals" element={
                      <motion.div
                        initial={{ opacity: 0, x: 100 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -100 }}
                        transition={{ duration: 0.3 }}
                      >
                        <LazyGoals />
                      </motion.div>
                    } />
                    <Route path="/books" element={
                      <motion.div
                        initial={{ opacity: 0, x: 100 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -100 }}
                        transition={{ duration: 0.3 }}
                      >
                        <LazyBooks />
                      </motion.div>
                    } />
                    <Route path="/books/:id" element={
                      <motion.div
                        initial={{ opacity: 0, x: 100 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -100 }}
                        transition={{ duration: 0.3 }}
                      >
                        <LazyBookDetails />
                      </motion.div>
                    } />
                    <Route path="/study" element={
                      <motion.div
                        initial={{ opacity: 0, x: 100 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -100 }}
                        transition={{ duration: 0.3 }}
                      >
                        <LazyStudy />
                      </motion.div>
                    } />
                    <Route path="/health" element={
                      <motion.div
                        initial={{ opacity: 0, x: 100 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -100 }}
                        transition={{ duration: 0.3 }}
                      >
                        <LazyHealth />
                      </motion.div>
                    } />
                    <Route path="/notes" element={
                      <motion.div
                        initial={{ opacity: 0, x: 100 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -100 }}
                        transition={{ duration: 0.3 }}
                      >
                        <LazyNotes />
                      </motion.div>
                    } />
                    <Route path="/planner" element={
                      <motion.div
                        initial={{ opacity: 0, x: 100 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -100 }}
                        transition={{ duration: 0.3 }}
                      >
                        <LazyPlanner />
                      </motion.div>
                    } />
                    <Route path="/clients" element={
                      <motion.div
                        initial={{ opacity: 0, x: 100 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -100 }}
                        transition={{ duration: 0.3 }}
                      >
                        <LazyClients />
                      </motion.div>
                    } />
                    <Route path="/clients/:id" element={
                      <motion.div
                        initial={{ opacity: 0, x: 100 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -100 }}
                        transition={{ duration: 0.3 }}
                      >
                        <LazyClientDetails />
                      </motion.div>
                    } />
                    <Route path="/ai-chat" element={
                      <motion.div
                        initial={{ opacity: 0, x: 100 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -100 }}
                        transition={{ duration: 0.3 }}
                      >
                        <LazyAIChat />
                      </motion.div>
                    } />
                    <Route path="/settings" element={
                      <motion.div
                        initial={{ opacity: 0, x: 100 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -100 }}
                        transition={{ duration: 0.3 }}
                      >
                        <LazySettings />
                      </motion.div>
                    } />
                    <Route path="/results" element={
                      <motion.div
                        initial={{ opacity: 0, x: 100 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -100 }}
                        transition={{ duration: 0.3 }}
                      >
                        <LazyResults />
                      </motion.div>
                    } />
                  </Route>
                  <Route path="*" element={
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <LazyNotFound />
                    </motion.div>
                  } />
                </Routes>
              </AnimatePresence>
            </SessionContextProvider>
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;