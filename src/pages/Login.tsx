"use client";

import React from 'react';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '@/integrations/supabase/client';
import { useSupabase } from '@/integrations/supabase/supabaseContext';
import { useNavigate } from 'react-router-dom';

const Login: React.FC = () => {
  const { session, isLoading } = useSupabase();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (!isLoading && session) {
      navigate('/dashboard');
    }
  }, [session, isLoading, navigate]);

  if (isLoading) {
    return <div className="flex justify-center items-center min-h-screen">Carregando...</div>;
  }

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-lg shadow-md dark:bg-gray-800">
        <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-white">
          Faça login na sua Netflix da Vida Pessoal
        </h2>
        <Auth
          supabaseClient={supabase}
          providers={[]} // No third-party providers unless specified
          appearance={{
            theme: ThemeSupa,
            variables: {
              default: {
                colors: {
                  brand: 'hsl(var(--primary))',
                  brandAccent: 'hsl(var(--primary-foreground))',
                },
              },
            },
          }}
          theme="light" // Default to light theme
          redirectTo={window.location.origin + '/dashboard'}
        />
      </div>
    </div>
  );
};

export default Login;