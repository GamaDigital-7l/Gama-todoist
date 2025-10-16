import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { format, getDay, parseISO, isToday } from "https://esm.sh/date-fns@2.30.0";
import { utcToZonedTime } from "https://esm.sh/date-fns-tz@2.0.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DAYS_OF_WEEK_MAP: { [key: string]: number } = {
  "Sunday": 0, "Monday": 1, "Tuesday": 2, "Wednesday": 3,
  "Thursday": 4, "Friday": 5, "Saturday": 6
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

    const nowUtc = new Date();
    const nowSaoPaulo = utcToZonedTime(nowUtc, SAO_PAULO_TIMEZONE);
    const todaySaoPaulo = format(nowSaoPaulo, "yyyy-MM-dd", { timeZone: SAO_PAULO_TIMEZONE });
    const currentDayOfWeekSaoPaulo = getDay(nowSaoPaulo); // 0 para domingo, 1 para segunda, etc.
    const currentDayOfMonthSaoPaulo = nowSaoPaulo.getDate().toString();

    console.log(`Executando instantiate-template-tasks para o dia: ${todaySaoPaulo}`);

    // 1. Buscar todas as tarefas padrão
    const { data: templateTasks, error: fetchTemplatesError } = await supabase
      .from('template_tasks')
      .select(`
        id,
        user_id,
        title,
        description,
        recurrence_type,
        recurrence_details,
        origin_board,
        template_task_tags (tag_id)
      `);

    if (fetchTemplatesError) throw fetchTemplatesError;

    const tasksToInsert = [];
    const taskTagsToInsert = [];

    for (const template of templateTasks || []) {
      let shouldInstantiate = false;

      // Verifica se a tarefa já foi instanciada hoje para este usuário
      const { data: existingTask, error: checkExistingError } = await supabase
        .from('tasks')
        .select('id')
        .eq('user_id', template.user_id)
        .eq('title', template.title) // Uma verificação simples para evitar duplicatas
        .eq('description', template.description)
        .eq('due_date', todaySaoPaulo)
        .limit(1);

      if (checkExistingError) {
        console.error(`Erro ao verificar tarefa existente para o template ${template.id}:`, checkExistingError);
        continue;
      }
      if (existingTask && existingTask.length > 0) {
        console.log(`Tarefa "${template.title}" (template ${template.id}) já instanciada para hoje para o usuário ${template.user_id}.`);
        continue; // Já existe uma tarefa para hoje, pular
      }

      if (template.recurrence_type === 'daily') {
        shouldInstantiate = true;
      } else if (template.recurrence_type === 'weekly' && template.recurrence_details) {
        const days = template.recurrence_details.split(',');
        shouldInstantiate = days.some(day => DAYS_OF_WEEK_MAP[day] === currentDayOfWeekSaoPaulo);
      } else if (template.recurrence_type === 'monthly' && template.recurrence_details) {
        shouldInstantiate = template.recurrence_details === currentDayOfMonthSaoPaulo;
      }

      if (shouldInstantiate) {
        tasksToInsert.push({
          user_id: template.user_id,
          title: template.title,
          description: template.description,
          due_date: todaySaoPaulo, // A data de vencimento é sempre hoje para tarefas instanciadas
          time: null, // Tarefas padrão não têm horário predefinido, pode ser adicionado manualmente
          is_completed: false,
          recurrence_type: 'none', // A tarefa instanciada não é recorrente por si só
          recurrence_details: null,
          origin_board: template.origin_board,
          created_at: nowUtc.toISOString(),
          updated_at: nowUtc.toISOString(),
          parent_task_id: null, // Tarefas padrão não geram subtarefas diretamente
        });
      }
    }

    if (tasksToInsert.length > 0) {
      const { data: newTasks, error: insertTasksError } = await supabase
        .from('tasks')
        .insert(tasksToInsert)
        .select('id, user_id');

      if (insertTasksError) throw insertTasksError;

      // Associar tags das tarefas padrão às novas tarefas instanciadas
      for (const newTask of newTasks || []) {
        const template = templateTasks?.find(t => t.user_id === newTask.user_id && t.title === tasksToInsert.find(ti => ti.user_id === newTask.user_id && ti.title === newTask.title)?.title);
        if (template && template.template_task_tags && template.template_task_tags.length > 0) {
          for (const tag of template.template_task_tags) {
            taskTagsToInsert.push({
              task_id: newTask.id,
              tag_id: tag.tag_id,
            });
          }
        }
      }

      if (taskTagsToInsert.length > 0) {
        const { error: insertTaskTagsError } = await supabase
          .from('task_tags')
          .insert(taskTagsToInsert);
        if (insertTaskTagsError) throw insertTaskTagsError;
      }

      console.log(`Instanciadas ${newTasks?.length || 0} tarefas a partir de templates.`);
    } else {
      console.log("Nenhuma tarefa padrão para instanciar hoje.");
    }

    return new Response(JSON.stringify({ message: "Template tasks instantiation process completed." }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Erro na Edge Function instantiate-template-tasks:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});