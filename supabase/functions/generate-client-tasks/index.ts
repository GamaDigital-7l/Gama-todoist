import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { format, getWeek, getDay, addDays, startOfMonth, endOfMonth, isSameDay, parseISO, addDays as dateFnsAddDays } from "https://esm.sh/date-fns@2.30.0";
import { utcToZonedTime } from "https://esm.sh/date-fns-tz@2.0.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DAYS_OF_WEEK_MAP: { [key: string]: number } = {
  "Sunday": 0, "Monday": 1, "Tuesday": 2, "Wednesday": 3,
  "Thursday": 4, "Friday": 5, "Saturday": 6
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

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: userAuth, error: authError } = await supabaseServiceRole.auth.getUser(token);

    if (authError || !userAuth.user) {
      console.error("Erro de autenticação:", authError);
      return new Response(
        JSON.stringify({ error: "Unauthorized: Invalid or missing token." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const userId = userAuth.user.id;

    const { clientId, monthYearRef } = await req.json(); // monthYearRef: "yyyy-MM"

    if (!clientId || !monthYearRef) {
      return new Response(
        JSON.stringify({ error: "Missing clientId or monthYearRef." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Obter o fuso horário do usuário
    const { data: profile, error: profileError } = await supabaseServiceRole
      .from('profiles')
      .select('timezone')
      .eq('id', userId)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      console.error(`[User ${userId}] Erro ao buscar fuso horário do perfil:`, profileError);
      throw profileError;
    }
    const userTimezone = profile?.timezone || 'America/Sao_Paulo'; // Fallback

    // 1. Buscar o cliente para obter a meta mensal
    const { data: client, error: clientError } = await supabaseServiceRole
      .from('clients')
      .select('monthly_delivery_goal')
      .eq('id', clientId)
      .eq('user_id', userId)
      .single();

    if (clientError || !client) {
      console.error("Erro ao buscar cliente ou cliente não encontrado:", clientError);
      return new Response(
        JSON.stringify({ error: "Client not found or monthly delivery goal not set." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2. Buscar templates de geração de tarefas ATIVOS para o cliente
    const { data: templates, error: templatesError } = await supabaseServiceRole
      .from('client_task_generation_templates')
      .select(`
        id,
        template_name,
        delivery_count,
        generation_pattern,
        is_active,
        default_due_days,
        client_task_tags(
          tags(id, name, color)
        )
      `)
      .eq('client_id', clientId)
      .eq('user_id', userId)
      .eq('is_active', true); // Filtrar apenas templates ativos

    if (templatesError) throw templatesError;

    if (!templates || templates.length === 0) {
      return new Response(
        JSON.stringify({ message: "No active task generation templates found for this client." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const tasksToInsert = [];
    const taskTagsToInsert = [];
    const nowUtc = new Date();

    // Calcular o início e fim do mês de referência no fuso horário do usuário
    const [year, month] = monthYearRef.split('-').map(Number);
    const startOfMonthInTimezone = utcToZonedTime(new Date(year, month - 1, 1), userTimezone);
    const endOfMonthInTimezone = utcToZonedTime(new Date(year, month, 0), userTimezone);

    for (const template of templates) {
      const templateTags = template.client_task_tags.map((ttt: any) => ttt.tags.id);

      for (const pattern of template.generation_pattern) {
        let currentDay = startOfMonthInTimezone;
        let tasksGeneratedForPattern = 0;

        while (currentDay <= endOfMonthInTimezone && tasksGeneratedForPattern < pattern.count) {
          const weekNumber = getWeek(currentDay, { weekStartsOn: 0 }); // Sunday is 0, Monday is 1
          const dayOfWeek = getDay(currentDay); // 0 for Sunday, 1 for Monday, etc.

          // Ajustar weekNumber para ser 1-4 dentro do mês
          const firstDayOfMonthWeek = getWeek(startOfMonthInTimezone, { weekStartsOn: 0 });
          const adjustedWeekNumber = weekNumber - firstDayOfMonthWeek + 1;

          if (adjustedWeekNumber === pattern.week && dayOfWeek === DAYS_OF_WEEK_MAP[pattern.day_of_week]) {
            const taskDueDate = template.default_due_days !== null && template.default_due_days !== undefined
              ? format(dateFnsAddDays(currentDay, template.default_due_days), "yyyy-MM-dd")
              : null;

            // Verificar se já existe uma tarefa com o mesmo título e data para evitar duplicatas
            const { data: existingTask, error: checkExistingError } = await supabaseServiceRole
              .from('client_tasks')
              .select('id')
              .eq('client_id', clientId)
              .eq('user_id', userId)
              .eq('title', template.template_name) // Usar o nome do template como título padrão
              .eq('due_date', taskDueDate) // Comparar com a data de vencimento calculada
              .limit(1);

            if (checkExistingError) {
              console.error(`Erro ao verificar tarefa existente para o cliente ${clientId}:`, checkExistingError);
              continue;
            }

            if (existingTask && existingTask.length > 0) {
              console.log(`Tarefa "${template.template_name}" já existe para ${taskDueDate}. Pulando.`);
              tasksGeneratedForPattern++; // Contar como gerada para não exceder o limite
              currentDay = addDays(currentDay, 1); // Avançar para o próximo dia
              continue;
            }

            const newTaskId = crypto.randomUUID(); // Gerar um UUID para a nova tarefa
            tasksToInsert.push({
              id: newTaskId,
              client_id: clientId,
              user_id: userId,
              title: template.template_name,
              description: `Gerado a partir do template: ${template.template_name}`,
              month_year_reference: monthYearRef,
              status: 'backlog', // Status inicial
              due_date: taskDueDate, // Usar o prazo padrão do template
              time: null, // Responsável e hora não são definidos por template por enquanto
              responsible_id: null,
              is_completed: false,
              completed_at: null,
              order_index: 0, // Será reordenado no frontend se necessário
              created_at: nowUtc.toISOString(),
              updated_at: nowUtc.toISOString(),
            });

            templateTags.forEach((tagId: string) => {
              taskTagsToInsert.push({
                client_task_id: newTaskId,
                tag_id: tagId,
              });
            });
            tasksGeneratedForPattern++;
          }
          currentDay = addDays(currentDay, 1); // Avançar para o próximo dia
        }
      }
    }

    if (tasksToInsert.length > 0) {
      const { error: insertTasksError } = await supabaseServiceRole
        .from('client_tasks')
        .insert(tasksToInsert);
      if (insertTasksError) throw insertTasksError;

      if (taskTagsToInsert.length > 0) {
        const { error: insertTaskTagsError } = await supabaseServiceRole
          .from('client_task_tags')
          .insert(taskTagsToInsert);
        if (insertTaskTagsError) throw insertTaskTagsError;
      }
      console.log(`[User ${userId}, Client ${clientId}] Geradas ${tasksToInsert.length} tarefas para ${monthYearRef}.`);
    } else {
      console.log(`[User ${userId}, Client ${clientId}] Nenhuma tarefa gerada para ${monthYearRef}.`);
    }

    return new Response(JSON.stringify({ message: `Generated ${tasksToInsert.length} tasks for ${monthYearRef}.` }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Erro na Edge Function generate-client-tasks:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});