export type FinancialTransactionType = 'income' | 'expense';
export type FinancialRecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'annually';
export type FinancialGoalType = 'personal_savings' | 'emergency_fund' | 'purchase' | 'travel';
export type FinancialAccountType = 'checking' | 'savings' | 'credit_card' | 'investment' | 'company_cash' | 'personal_cash' | 'emergency_fund'; // Adicionado emergency_fund para caixinhas

export type FinancialCategory = {
  id: string;
  user_id: string;
  name: string;
  type: FinancialTransactionType | 'both';
  parent_id: string | null;
  created_at: string;
  updated_at: string;
};

export type FinancialAccount = {
  id: string;
  user_id: string;
  name: string;
  type: FinancialAccountType;
  current_balance: number;
  created_at: string;
  updated_at: string;
};

export type FinancialTransaction = {
  id: string;
  user_id: string;
  date: string; // ISO date string
  description: string;
  amount: number;
  type: FinancialTransactionType;
  category_id: string | null;
  subcategory_id: string | null;
  client_id: string | null;
  account_id: string;
  recurrence_id: string | null;
  payment_method: string | null;
  notes: string | null;
  attachment_url: string | null;
  is_recurrent_instance: boolean;
  created_at: string;
  updated_at: string;
  category?: FinancialCategory | null; // Joined category
  subcategory?: FinancialCategory | null; // Joined subcategory
  account?: FinancialAccount | null; // Joined account
  client?: { id: string; name: string } | null; // Joined client
};

export type FinancialRecurrence = {
  id: string;
  user_id: string;
  description: string;
  amount: number;
  type: FinancialTransactionType;
  category_id: string | null;
  account_id: string;
  frequency: FinancialRecurrenceFrequency;
  start_date: string; // ISO date string
  end_date: string | null; // ISO date string
  next_due_date: string; // ISO date string
  created_at: string;
  updated_at: string;
  category?: FinancialCategory | null; // Joined category
  account?: FinancialAccount | null; // Joined account
};

export type FinancialGoal = {
  id: string;
  user_id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  target_date: string | null; // ISO date string
  type: FinancialGoalType;
  linked_account_id: string | null;
  created_at: string;
  updated_at: string;
  linked_account?: FinancialAccount | null; // Joined account
};

export type FinancialBudget = {
  id: string;
  user_id: string;
  name: string;
  category_id: string | null;
  category?: FinancialCategory | null; // Joined category
  amount: number;
  start_date: string; // ISO date string
  end_date: string; // ISO date string
  type: FinancialTransactionType; // 'income' ou 'expense'
  scope: 'personal' | 'company'; // Adicionado: 'personal' ou 'company'
  created_at: string;
  updated_at: string;
};