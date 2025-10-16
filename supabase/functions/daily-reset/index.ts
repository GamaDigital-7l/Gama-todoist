import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { format, subDays, isToday, parseISO } from "https://esm.sh/date-fns@2.30.0";
import { utcToZonedTime } from "https://esm.sh/date-fns-tz@2.0.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SAO_PAULO_TIMEZONE = "America/Sao_Paulo";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Obter a data de ontem no fuso horário de São Paulo
    const nowUtc = new Date();
    const nowSaoPaulo = utcToZonedTime(nowUtc, SAO_PAULO_TIMEZONE);
    const yesterdaySaoPaulo = format(subDays(nowSaoPaulo, 1), "yyyy-MM-dd", { timeZone: SAO_PAULO_TIMEZONE });
    const todaySaoPaulo = format(nowSaoPaulo, "yyyy-MM-dd", { timeZone: SAO_PAULO_TIMEZONE });

    console.log(`Executando daily-reset para o dia: ${todaySaoPaulo}. Verificando tarefas de: ${yesterdaySaoPaulo}`);

    // 1. Mover tarefas não concluídas de 'hoje-urgente' e 'hoje-sem-urgencia' para 'overdue'
    const { data: uncompletedTodayTasks, error: fetchUncompletedError } = await supabase
      .from('tasks')
      .select('id, title, is_completed, due_date, recurrence_type, last_successful_completion_date, origin_board')
      .in('origin_board', ['urgent_today', 'non_urgent_today'])
      .eq('is_completed', false); // Apenas as que ainda estão marcadas como false

    if (fetchUncompletedError) throw fetchUncompletedError;

    const tasksToMoveToOverdue = uncompletedTodayTasks.filter(task => {
      // Verifica se a tarefa era para ser concluída ontem
      if (task.due_date && format(parseISO(task.due_date), "yyyy-MM-dd") === yesterdaySaoPaulo) {
        return true;
      }
      // Para tarefas recorrentes, verifica se a última conclusão foi antes de ontem
      if (task.recurrence_type !== 'none' && task.last_successful_completion_date) {
        const lastCompletionDate = parseISO(task.last_successful_completion_date);
        return !isToday(lastCompletionDate) && !isToday(subDays(lastCompletionDate, -1)); // Se não foi concluída hoje ou ontem
      }
      return false;
    });

    if (tasksToMoveToOverdue.length > 0) {
      const { error: updateOverdueError } = await supabase
        .from('tasks')
        .update({ 
          origin_board: 'overdue', 
          last_moved_to_overdue_at: nowUtc.toISOString(),
          is_completed: false // Garante que continue como não concluída
        })
        .in('id', tasksToMoveToOverdue.map(task => task.id));
      if (updateOverdueError) throw updateOverdueError;
      console.log(`Movidas ${tasksToMoveToOverdue.length} tarefas para 'overdue'.`);
    }

    // 2. Mover tarefas concluídas de 'hoje-urgente' e 'hoje-sem-urgencia' para 'completed'
    const { data: completedTodayTasks, error: fetchCompletedError } = await supabase
      .from('tasks')
      .select('id, title, is_completed, due_date, recurrence_type, last_successful_completion_date, origin_board')
      .in('origin_board', ['urgent_today', 'non_urgent_today'])
      .eq('is_completed', true); // Apenas as que estão marcadas como true

    if (fetchCompletedError) throw fetchCompletedError;

    const tasksToMoveToCompleted = completedTodayTasks.filter(task => {
      // Verifica se a tarefa foi concluída ontem
      if (task.last_successful_completion_date && format(parseISO(task.last_successful_completion_date), "yyyy-MM-dd") === yesterdaySaoPaulo) {
        return true;
      }
      return false;
    });

    if (tasksToMoveToCompleted.length > 0) {
      const { error: updateCompletedError } = await supabase
        .from('tasks')
        .update({ 
          origin_board: 'completed', 
          completed_at: nowUtc.toISOString() 
        })
        .in('id', tasksToMoveToCompleted.map(task => task.id));
      if (updateCompletedError) throw updateCompletedError;
      console.log(`Movidas ${tasksToMoveToCompleted.length} tarefas para 'completed'.`);
    }

    // 3. Resetar o status 'is_completed' para tarefas recorrentes que são devidas hoje
    const { data: recurrentTasks, error: fetchRecurrentError } = await supabase
      .from('tasks')
      .select('id, recurrence_type, recurrence_details, is_completed, last_successful_completion_date')
      .neq('recurrence_type', 'none');

    if (fetchRecurrentError) throw fetchRecurrentError;

    const tasksToResetCompletion = recurrentTasks.filter(task => {
      // Lógica para determinar se a tarefa recorrente deve ser resetada hoje
      const currentDayOfWeek = nowSaoPaulo.getDay(); // 0 (Domingo) a 6 (Sábado)
      const currentDayOfMonth = nowSaoPaulo.getDate().toString();

      let shouldReset = false;

      if (task.recurrence_type === 'daily') {
        shouldReset = true;
      } else if (task.recurrence_type === 'weekly' && task.recurrence_details) {
        const days = task.recurrence_details.split(',');
        const dayMap: { [key: string]: number } = {
          "Sunday": 0, "Monday": 1, "Tuesday": 2, "Wednesday": 3,
          "Thursday": 4, "Friday": 5, "Saturday": 6
        };
        shouldReset = days.some(day => dayMap[day] === currentDayOfWeek);
      } else if (task.recurrence_type === 'monthly' && task.recurrence_details) {
        shouldReset = task.recurrence_details === currentDayOfMonth;
      }

      // Se deve resetar E a tarefa está atualmente marcada como concluída para o período anterior
      // ou se a última conclusão foi antes de hoje
      if (shouldReset && task.last_successful_completion_date) {
        const lastCompletionDate = parseISO(task.last_successful_completion_date);
        return !isToday(lastCompletionDate);
      } else if (shouldReset && !task.last_successful_completion_date) {
        return true; // Se deve resetar e nunca foi concluída, garantir que esteja como false
      }
      return false;
    });

    if (tasksToResetCompletion.length > 0) {
      const { error: resetError } = await supabase
        .from('tasks')
        .update({ is_completed: false })
        .in('id', tasksToResetCompletion.map(task => task.id));
      if (resetError) throw resetError;
      console.log(`Resetadas ${tasksToResetCompletion.length} tarefas recorrentes para 'is_completed: false'.`);
    }

    return new Response(JSON.stringify({ message: "Daily reset process completed." }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Erro na Edge Function daily-reset:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});