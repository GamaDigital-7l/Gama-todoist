export type FinancialAccountType = 'company_cash' | 'personal_cash' | 'credit_card' | 'savings' | 'emergency_fund';
export type FinancialCategoryType = 'income' | 'expense' | 'both';
export type FinancialTransactionType = 'income' | 'expense';
export type FinancialRecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'annually';
export type FinancialGoalType = 'personal_savings' | 'emergency_fund' | 'purchase' | 'travel';

export interface FinancialAccount {
  id: string;
  user_id: string;
  name: string;
  type: FinancialAccountType;
  initial_balance: number;
  current_balance: number;
  created_at: string;
  updated_at: string;
}

export interface FinancialCategory {
  id: string;
  user_id: string;
  name: string;
  type: FinancialCategoryType;
  parent_id?: string | null;
  created_at: string;
  updated_at: string;
  subcategories?: FinancialCategory[]; // Para categorias aninhadas
}

export interface FinancialRecurrence {
  id: string;
  user_id: string;
  description: string;
  amount: number;
  type: FinancialTransactionType;
  category_id?: string | null;
  account_id?: string | null;
  frequency: FinancialRecurrenceFrequency;
  start_date: string; // ISO date string
  end_date?: string | null; // ISO date string
  next_due_date: string; // ISO date string
  created_at: string;
  updated_at: string;
}

export interface FinancialTransaction {
  id: string;
  user_id: string;
  date: string; // ISO date string
  description: string;
  amount: number;
  type: FinancialTransactionType;
  category_id?: string | null;
  subcategory_id?: string | null;
  client_id?: string | null;
  account_id: string;
  recurrence_id?: string | null;
  payment_method?: string | null;
  notes?: string | null;
  attachment_url?: string | null;
  is_recurrent_instance: boolean;
  created_at: string;
  updated_at: string;
  category?: FinancialCategory; // Para join
  subcategory?: FinancialCategory; // Para join
  client?: { id: string; name: string }; // Para join
  account?: FinancialAccount; // Para join
}

export interface FinancialGoal {
  id: string;
  user_id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  target_date?: string | null; // ISO date string
  type: FinancialGoalType;
  linked_account_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuickTransactionSuggestion {
  description: string;
  amount: number;
  type: FinancialTransactionType;
  category_id?: string | null;
  category_name?: string | null;
  account_id?: string | null;
  account_name?: string | null;
  payment_method?: string | null;
  client_id?: string | null;
  client_name?: string | null;
}