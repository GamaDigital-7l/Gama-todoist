import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { persistQueryClient } from "@tanstack/query-sync-storage-persister";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/layout/Layout";
import Dashboard from "./pages/Dashboard";
import Tasks from "./pages/Tasks";
import Goals from "./pages/Goals";
import Motivation from "./pages/Motivation";
import Settings from "./pages/Settings";
import Books from "./pages/Books";
import BookReader from "./pages/BookReader";
import AIChat from "./pages/AIChat";
import Study from "./pages/Study";
import Health from "./pages/Health";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import { SessionContextProvider, useSession } from "./integrations/supabase/auth";
import { ThemeProvider } from "./components/ThemeProvider";
import PushNotificationManager from "./components/PushNotificationManager"; // Importar o novo componente

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

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Carregando autenticação...</div>;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return (
    <>
      <PushNotificationManager /> {/* Adicionar o gerenciador de notificações aqui */}
      {children}
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <SessionContextProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
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
                <Route path="/books/:id" element={<BookReader />} />
                <Route path="/motivation" element={<Motivation />} />
                <Route path="/ai-chat" element={<AIChat />} />
                <Route path="/study" element={<Study />} />
                <Route path="/health" element={<Health />} />
                <Route path="/settings" element={<Settings />} />
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