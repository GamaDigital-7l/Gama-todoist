import { createClient } from '@supabase/supabase-js';

// Hardcoding the Supabase URL and Anon Key to bypass .env issues
const supabaseUrl = "https://qbhwjmwyrkfyxajaksfk.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFiaHdqbXd5cmtmeXhhamFrc2ZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAzODU5MjcsImV4cCI6MjA3NTk2MTkyN30.sJuNU7QIMhB775xafh9fi2FHwA6zVc9sEZ05AomPCZg";

// Adicione estes logs para verificar se as variáveis estão sendo carregadas
console.log("Supabase URL (hardcoded):", supabaseUrl);
console.log("Supabase Anon Key (hardcoded):", supabaseAnonKey ? "Loaded" : "Not Loaded");

export const supabase = createClient(supabaseUrl, supabaseAnonKey);