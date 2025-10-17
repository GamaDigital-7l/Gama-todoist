import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseServiceRole = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { uniqueId, taskId, newStatus, editReason } = await req.json();

    if (!uniqueId || !taskId || !newStatus) {
      return new Response(
        JSON.stringify({ error: "Missing uniqueId, taskId, or newStatus." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 1. Verificar a validade do uniqueId e obter o client_id e user_id
    const { data: approvalLink, error: fetchLinkError } = await supabaseServiceRole
      .from('public_approval_links')
      .select('client_id, user_id, expires_at')
      .eq('unique_id', uniqueId)
      .single();

    if (fetchLinkError || !approvalLink) {
      console.error("Erro ao buscar link de aprovação ou link não encontrado:", fetchLinkError);
      return new Response(
        JSON.stringify({ error: "Invalid or expired approval link." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (new Date() > new Date(approvalLink.expires_at)) {
      return new Response(
        JSON.stringify({ error: "Approval link has expired." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { client_id, user_id } = approvalLink;

    // 2. Atualizar o status da tarefa do cliente
    const updateData: { status: string; edit_reason?: string | null; is_completed?: boolean; completed_at?: string | null; updated_at: string } = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    };

    if (newStatus === 'edit_requested') {
      updateData.edit_reason = editReason || null;
      updateData.is_completed = false;
      updateData.completed_at = null;
    } else if (newStatus === 'approved') {
      updateData.is_completed = true;
      updateData.completed_at = new Date().toISOString();
      updateData.edit_reason = null; // Limpar motivo de edição se aprovado
    }

    const { data: updatedClientTask, error: updateTaskError } = await supabaseServiceRole
      .from('client_tasks')
      .update(updateData)
      .eq('id', taskId)
      .eq('client_id', client_id)
      .eq('user_id', user_id)
      .select('is_standard_task, main_task_id')
      .single();

    if (updateTaskError || !updatedClientTask) {
      console.error("Erro ao atualizar tarefa do cliente:", updateTaskError);
      return new Response(
        JSON.stringify({ error: "Failed to update client task status." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 3. Sincronizar com a tarefa principal se for uma tarefa padrão
    if (updatedClientTask.is_standard_task && updatedClientTask.main_task_id) {
      const mainTaskUpdateData: { is_completed?: boolean; current_board?: string; updated_at: string } = {
        updated_at: new Date().toISOString(),
      };
      if (newStatus === 'approved') {
        mainTaskUpdateData.is_completed = true;
        mainTaskUpdateData.current_board = 'completed';
      } else if (newStatus === 'edit_requested') {
        mainTaskUpdateData.is_completed = false;
        mainTaskUpdateData.current_board = 'general';
      }
      
      const { error: mainTaskError } = await supabaseServiceRole
        .from("tasks")
        .update(mainTaskUpdateData)
        .eq("id", updatedClientTask.main_task_id)
        .eq("user_id", user_id);
      if (mainTaskError) console.error("Erro ao sincronizar tarefa principal:", mainTaskError);
    }

    return new Response(JSON.stringify({ message: "Client task status updated successfully." }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Erro na Edge Function update-client-task-status-public:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});