import { createClient } from '@supabase/supabase-js';

// Hardcoding the Supabase URL and Anon Key to bypass .env issues
export const supabaseUrl = "https://qbhwjmwyrkfyxajaksfk.supabase.co"; // Exportado
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFiaHdqbXd5cmtmeXhhamFrc2ZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAzODU5MjcsImV4cCI6MjA3NTk2MTkyN30.sJuNU7QIMhB775xafh9fi2FHwA6zVc9sEZ05AomPCZg";

// Chave Pública VAPID para Web Push Notifications (AGORA LIDA DE VARIÁVEL DE AMBIENTE)
// Certifique-se de que VITE_VAPID_PUBLIC_KEY esteja definido no seu arquivo .env
// Exemplo: VITE_VAPID_PUBLIC_KEY="SUA_CHAVE_PUBLICA_VAPID_AQUI"
export const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

// Adicione estes logs para verificar se as variáveis estão sendo carregadas
// console.log("Supabase URL (hardcoded):", supabaseUrl); // Removido console.log
// console.log("Supabase Anon Key (hardcoded):", supabaseAnonKey ? "Loaded" : "Not Loaded"); // Removido console.log
// console.log("VAPID Public Key (from env):", VAPID_PUBLIC_KEY ? "Loaded" : "Not Loaded"); // Removido console.log


export const supabase = createClient(supabaseUrl, supabaseAnonKey);