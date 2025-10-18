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
import React, { useEffect, useState } from "react";
import { showInfo, showSuccess, showError } from "./utils/toast"; // Importar showInfo

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24, // Cache por 24 horas
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
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

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

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <TooltipProvider>
        <Sonner />
        <BrowserRouter>
          <SessionContextProvider>
            <PWAHandler /> {/* Adicionado o PWAHandler aqui */}
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/books/:id/read" element={<ProtectedRoute><BookReaderFullScreen /></ProtectedRoute>} />
              <Route path="/approval/:uniqueId" element={<PublicApprovalPage />} />
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Layout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Dashboard />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/tasks" element={<Tasks />} />
                <Route path="/goals" element={<Goals />} />
                <Route path="/books" element={<Books />} />
                <Route path="/books/:id" element={<BookDetails />} />
                <Route path="/study" element={<Study />} />
                <Route path="/health" element={<Health />} />
                <Route path="/notes" element={<Notes />} />
                <Route path="/planner" element={<Planner />} />
                <Route path="/clients" element={<Clients />} />
                <Route path="/clients/:id" element={<ClientDetails />} />
                <Route path="/ai-chat" element={<AIChat />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/results" element={<Results />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </SessionContextProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;