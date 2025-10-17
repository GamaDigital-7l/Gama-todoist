export type ClientType = 'fixed' | 'freela' | 'agency';
export type ClientTaskStatus = 'backlog' | 'in_production' | 'in_approval' | 'approved' | 'scheduled' | 'published' | 'edit_requested';

export interface Client {
  id: string;
  user_id: string;
  name: string;
  logo_url?: string | null;
  description?: string | null;
  color: string;
  type: ClientType; // Novo campo
  monthly_delivery_goal: number; // Novo campo
  created_at: string;
  updated_at: string;
}

export interface ClientTask {
  id: string;
  client_id: string;
  user_id: string;
  title: string;
  description?: string | null;
  month_year_reference: string; // Ex: "2025-10"
  status: ClientTaskStatus;
  due_date?: string | null; // ISO string
  time?: string | null; // Novo campo: Formato "HH:mm"
  responsible_id?: string | null; // Novo campo: ID do responsável
  is_completed: boolean;
  completed_at?: string | null;
  order_index: number;
  created_at: string;
  updated_at: string;
  tags?: { id: string; name: string; color: string }[]; // Para carregar tags associadas
  responsible?: { id: string; first_name: string; last_name: string; avatar_url: string } | null; // Para carregar dados do responsável
  image_urls?: string[] | null; // Novo campo: URLs das imagens anexadas
  edit_reason?: string | null; // Novo campo: Motivo da solicitação de edição
  is_standard_task: boolean; // Novo campo: Indica se a tarefa é padrão e deve ir para o dashboard principal
  main_task_id?: string | null; // Novo campo: ID da tarefa correspondente no dashboard principal
}

export interface ClientTaskGenerationPattern {
  week: number; // 1, 2, 3, 4
  day_of_week: "Sunday" | "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday"; // Dia da semana
  count: number; // Quantidade de tarefas a gerar
}

export interface ClientTaskGenerationTemplate {
  id: string;
  client_id: string;
  user_id: string;
  template_name: string;
  delivery_count: number;
  generation_pattern: ClientTaskGenerationPattern[]; // JSONB
  is_active: boolean; // Novo campo
  default_due_days?: number | null; // Novo campo
  created_at: string;
  updated_at: string;
}

export interface PublicApprovalLink {
  id: string;
  client_id: string;
  user_id: string;
  month_year_reference: string;
  unique_id: string;
  expires_at: string;
  created_at: string;
}