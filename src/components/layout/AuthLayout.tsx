"use client";

import React, { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useSession } from '@/contexts/SessionContext';
import Layout from './Layout'; // Assuming your main layout is here

const AuthLayout: React.FC = () => {
  const { session, isLoading } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !session) {
      navigate('/login');
    }
  }, [session, isLoading, navigate]);

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Carregando autenticação...</div>;
  }

  if (!session) {
    return null; // Or a loading spinner, as the redirect will happen
  }

  return <Layout><Outlet /></Layout>;
};

export default AuthLayout;