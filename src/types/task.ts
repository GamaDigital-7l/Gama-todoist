export interface Tag {
  id: string;
  name: string;
  color: string;
}

export type RecurrenceType = "none" | "daily" | "weekly" | "monthly";
export type OriginBoard = "general" | "today_priority" | "today_no_priority" | "overdue" | "completed" | "recurrent" | "jobs_woe_today";
export type TemplateFormOriginBoard = "general" | "today_priority" | "today_no_priority" | "jobs_woe_today";

export interface Task {
  id: string;
  title: string;
  description?: string | null;
  due_date?: string | null; // ISO string
  time?: string | null; // Formato "HH:mm"
  is_completed: boolean;
  recurrence_type: RecurrenceType;
  recurrence_details?: string | null;
  last_successful_completion_date?: string | null;
  origin_board: OriginBoard; // Novo campo para o quadro de origem
  created_at: string;
  updated_at: string;
  completed_at?: string | null; // Adicionado para tarefas finalizadas
  last_moved_to_overdue_at?: string | null; // Adicionado para tarefas atrasadas
  tags: Tag[];
  parent_task_id?: string | null; // Novo campo para subtarefas
  subtasks?: Task[]; // Para carregar subtarefas aninhadas
}

export interface TemplateTask {
  id: string;
  user_id: string;
  title: string;
  description?: string | null;
  recurrence_type: RecurrenceType;
  recurrence_details?: string | null;
  origin_board: TemplateFormOriginBoard; // Restringido para TemplateFormOriginBoard
  created_at: string;
  updated_at: string;
  tags: Tag[]; // Para carregar tags associadas
}

export interface TemplateTaskTag {
  template_task_id: string;
  tag_id: string;
  created_at: string;
}

export const DAYS_OF_WEEK_MAP: { [key: string]: number } = {
  "Sunday": 0, "Monday": 1, "Tuesday": 2, "Wednesday": 3,
  "Thursday": 4, "Friday": 5, "Saturday": 6
};

export const DAYS_OF_WEEK_LABELS: { [key: string]: string } = {
  "Sunday": "Dom", "Monday": "Seg", "Tuesday": "Ter", "Wednesday": "Qua",
  "Thursday": "Qui", "Friday": "Sex", "Saturday": "Sáb"
};