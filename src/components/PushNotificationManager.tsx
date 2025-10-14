"use client";

import React, { useEffect } from 'react';
import { supabase, VAPID_PUBLIC_KEY } from '@/integrations/supabase/client';
import { useSession } from '@/integrations/supabase/auth';
import { showSuccess, showError } from '@/utils/toast';

// Função utilitária para converter base64 para Uint8Array
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

const PushNotificationManager: React.FC = () => {
  const { session, isLoading } = useSession();
  const userId = session?.user?.id;

  useEffect(() => {
    if (!isLoading && userId) {
      // Verifica se as notificações push são suportadas
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.warn('Notificações Push não são suportadas neste navegador.');
        return;
      }

      const subscribeUser = async () => {
        try {
          const registration = await navigator.serviceWorker.ready;
          let subscription = await registration.pushManager.getSubscription();

          if (!subscription) {
            // Se não houver inscrição, cria uma nova
            const convertedVapidKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
            subscription = await registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: convertedVapidKey,
            });
            showSuccess('Inscrito para notificações push!');
          } else {
            console.log('Já inscrito para notificações push:', subscription);
          }

          // Salva a inscrição no banco de dados do Supabase
          const { data: existingSubscription, error: fetchError } = await supabase
            .from('user_subscriptions')
            .select('id')
            .eq('user_id', userId)
            .limit(1)
            .single();

          if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = no rows found
            throw fetchError;
          }

          if (existingSubscription) {
            // Atualiza a inscrição existente
            const { error: updateError } = await supabase
              .from('user_subscriptions')
              .update({ subscription: subscription.toJSON(), updated_at: new Date().toISOString() })
              .eq('id', existingSubscription.id);
            if (updateError) throw updateError;
            console.log('Inscrição de push atualizada no Supabase.');
          } else {
            // Insere uma nova inscrição
            const { error: insertError } = await supabase
              .from('user_subscriptions')
              .insert({ user_id: userId, subscription: subscription.toJSON() });
            if (insertError) throw insertError;
            console.log('Nova inscrição de push salva no Supabase.');
          }

        } catch (err: any) {
          console.error('Erro ao inscrever o usuário para notificações push:', err);
          showError('Erro ao configurar notificações push: ' + err.message);
        }
      };

      // Solicita permissão e inscreve o usuário
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          subscribeUser();
        } else {
          console.warn('Permissão de notificação negada.');
          // showError('Permissão de notificação negada. As notificações push não funcionarão.');
        }
      });
    }
  }, [isLoading, userId]);

  return null; // Este componente não renderiza nada visível
};

export default PushNotificationManager;