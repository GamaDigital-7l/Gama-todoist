"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, DollarSign, Briefcase, Repeat, Target, Settings, Edit, Trash2, CalendarDays, Clock, Banknote } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import TransactionForm from './TransactionForm';
import RecurrenceForm from './RecurrenceForm';
import FinancialGoalForm from './FinancialGoalForm';
import ProLaboreForm from './ProLaboreForm';
import { FinancialTransaction, FinancialRecurrence, FinancialGoal, FinancialAccount, FinancialCategory } from '@/types/finance';
import { DIALOG_CONTENT_CLASSNAMES } from '@/lib/constants';
import { useSession } from '@/integrations/supabase/auth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { format, parseISO, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

interface CompanyFinanceProps {
  currentPeriod: Date;
  onTransactionAdded: () => void;
}

interface ProLaboreSetting {
  id: string;
  amount: number;
  payment_day_of_month: number;
  target_account_id?: string | null;
  target_account?: FinancialAccount | null;
}

const fetchCompanyTransactions = async (userId: string, period: Date): Promise<FinancialTransaction[]> => {
  const start = format(startOfMonth(period), "yyyy-MM-dd");
  const end = format(endOfMonth(period), "yyyy-MM-dd");

  const { data, error } = await supabase
    .from("financial_transactions")
    .select(`
      *,
      category:financial_categories!financial_transactions_category_id_fkey(id, name, type),
      account:financial_accounts(id, name, type)
    `)
    .eq("user_id", userId)
    .in('account.type', ['company_cash', 'credit_card']) // Filtrar por contas da empresa
    .gte("date", start)
    .lte("date", end)
    .order("date", { ascending: false });

  if (error) throw error;
  return data || [];
};

const fetchCompanyRecurrences = async (userId: string): Promise<FinancialRecurrence[]> => {
  const { data, error } = await supabase
    .from("financial_recurrences")
    .select(`
      *,
      category:financial_categories(id, name, type),
      account:financial_accounts(id, name, type)
    `)
    .eq("user_id", userId)
    .in('account.type', ['company_cash', 'credit_card']) // Filtrar por contas da empresa
    .order("next_due_date", { ascending: true });

  if (error) throw error;
  return data || [];
};

const fetchCompanyGoals = async (userId: string): Promise<FinancialGoal[]> => {
  const { data, error } = await supabase
    .from("financial_goals")
    .select(`
      *,
      linked_account:financial_accounts(id, name, type, current_balance)
    `)
    .eq("user_id", userId)
    .in('type', ['emergency_fund']) // Filtrar por metas da empresa (ex: fundo de emergência)
    .order("target_date", { ascending: true });

  if (error) throw error;
  return data || [];
};

const fetchProLaboreSettings = async (userId: string): Promise<ProLaboreSetting | null> => {
  const { data, error } = await supabase
    .from("pro_labore_settings")
    .select(`
      *,
      target_account:financial_accounts(id, name, type)
    `)
    .eq("user_id", userId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data || null;
};

const CompanyFinance: React.FC<CompanyFinanceProps> = ({ currentPeriod, onTransactionAdded }) => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();

  const [isTransactionFormOpen, setIsTransactionFormOpen] = useState(false);
  const [isRecurrenceFormOpen, setIsRecurrenceFormOpen] = useState(false);
  const [isGoalFormOpen, setIsGoalFormOpen] = useState(false);
  const [isProLaboreFormOpen, setIsProLaboreFormOpen] = useState(false);

  const [editingTransaction, setEditingTransaction] = useState<FinancialTransaction | undefined>(undefined);
  const [editingRecurrence, setEditingRecurrence] = useState<FinancialRecurrence | undefined>(undefined);
  const [editingGoal, setEditingGoal] = useState<FinancialGoal | undefined>(undefined);
  const [editingProLabore, setEditingProLabore] = useState<ProLaboreSetting | undefined>(undefined);

  const { data: transactions, isLoading: isLoadingTransactions, error: transactionsError, refetch: refetchTransactions } = useQuery<FinancialTransaction[], Error>({
    queryKey: ["companyTransactions", userId, currentPeriod.toISOString()],
    queryFn: () => fetchCompanyTransactions(userId!, currentPeriod),
    enabled: !!userId,
  });

  const { data: recurrences, isLoading: isLoadingRecurrences, error: recurrencesError, refetch: refetchRecurrences } = useQuery<FinancialRecurrence[], Error>({
    queryKey: ["companyRecurrences", userId],
    queryFn: () => fetchCompanyRecurrences(userId!),
    enabled: !!userId,
  });

  const { data: goals, isLoading: isLoadingGoals, error: goalsError, refetch: refetchGoals } = useQuery<FinancialGoal[], Error>({
    queryKey: ["companyGoals", userId],
    queryFn: () => fetchCompanyGoals(userId!),
    enabled: !!userId,
  });

  const { data: proLaboreSettings, isLoading: isLoadingProLabore, error: proLaboreError, refetch: refetchProLabore } = useQuery<ProLaboreSetting | null, Error>({
    queryKey: ["proLaboreSettings", userId],
    queryFn: () => fetchProLaboreSettings(userId!),
    enabled: !!userId,
  });

  const handleTransactionSaved = () => {
    onTransactionAdded(); // Refetch all finance data in parent
    refetchTransactions();
    setIsTransactionFormOpen(false);
    setEditingTransaction(undefined);
  };

  const handleRecurrenceSaved = () => {
    refetchRecurrences();
    setIsRecurrenceFormOpen(false);
    setEditingRecurrence(undefined);
  };

  const handleGoalSaved = () => {
    refetchGoals();
    setIsGoalFormOpen(false);
    setEditingGoal(undefined);
  };

  const handleProLaboreSaved = () => {
    refetchProLabore();
    setIsProLaboreFormOpen(false);
    setEditingProLabore(undefined);
  };

  const handleEditTransaction = (transaction: FinancialTransaction) => {
    setEditingTransaction(transaction);
    setIsTransactionFormOpen(true);
  };

  const handleDeleteTransaction = async (transactionId: string) => {
    if (!userId) { showError("Usuário não autenticado."); return; }
    if (window.confirm("Tem certeza que deseja deletar esta transação?")) {
      try {
        const { error } = await supabase.from("financial_transactions").delete().eq("id", transactionId).eq("user_id", userId);
        if (error) throw error;
        showSuccess("Transação deletada com sucesso!");
        handleTransactionSaved();
      } catch (err: any) { showError("Erro ao deletar transação: " + err.message); console.error(err); }
    }
  };

  const handleEditRecurrence = (recurrence: FinancialRecurrence) => {
    setEditingRecurrence(recurrence);
    setIsRecurrenceFormOpen(true);
  };

  const handleDeleteRecurrence = async (recurrenceId: string) => {
    if (!userId) { showError("Usuário não autenticado."); return; }
    if (window.confirm("Tem certeza que deseja deletar esta recorrência?")) {
      try {
        const { error } = await supabase.from("financial_recurrences").delete().eq("id", recurrenceId).eq("user_id", userId);
        if (error) throw error;
        showSuccess("Recorrência deletada com sucesso!");
        handleRecurrenceSaved();
      } catch (err: any) { showError("Erro ao deletar recorrência: " + err.message); console.error(err); }
    }
  };

  const handleEditGoal = (goal: FinancialGoal) => {
    setEditingGoal(goal);
    setIsGoalFormOpen(true);
  };

  const handleDeleteGoal = async (goalId: string) => {
    if (!userId) { showError("Usuário não autenticado."); return; }
    if (window.confirm("Tem certeza que deseja deletar esta meta financeira?")) {
      try {
        const { error } = await supabase.from("financial_goals").delete().eq("id", goalId).eq("user_id", userId);
        if (error) throw error;
        showSuccess("Meta financeira deletada com sucesso!");
        handleGoalSaved();
      } catch (err: any) { showError("Erro ao deletar meta financeira: " + err.message); console.error(err); }
    }
  };

  const handleEditProLabore = (settings: ProLaboreSetting) => {
    setEditingProLabore(settings);
    setIsProLaboreFormOpen(true);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const emergencyFundGoal = goals?.find(goal => goal.type === 'emergency_fund');
  const emergencyFundProgress = emergencyFundGoal && emergencyFundGoal.target_amount > 0
    ? (emergencyFundGoal.current_amount / emergencyFundGoal.target_amount) * 100
    : 0;

  if (transactionsError) showError("Erro ao carregar transações da empresa: " + transactionsError.message);
  if (recurrencesError) showError("Erro ao carregar recorrências da empresa: " + recurrencesError.message);
  if (goalsError) showError("Erro ao carregar metas da empresa: " + goalsError.message);
  if (proLaboreError) showError("Erro ao carregar configurações de pró-labore: " + proLaboreError.message);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Briefcase className="h-6 w-6 text-primary" /> Financeiro Empresa
        </h2>
        <Dialog open={isTransactionFormOpen} onOpenChange={setIsTransactionFormOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingTransaction(undefined)} className="bg-primary text-primary-foreground hover:bg-primary/90">
              <PlusCircle className="mr-2 h-4 w-4" /> Nova Transação
            </Button>
          </DialogTrigger>
          <DialogContent
            className={DIALOG_CONTENT_CLASSNAMES}
            aria-labelledby="company-transaction-title"
            aria-describedby="company-transaction-description"
          >
            <DialogHeader>
              <DialogTitle id="company-transaction-title" className="text-foreground">
                {editingTransaction ? "Editar Transação da Empresa" : "Adicionar Transação da Empresa"}
              </DialogTitle>
              <DialogDescription id="company-transaction-description" className="text-muted-foreground">
                {editingTransaction ? "Atualize os detalhes da transação da empresa." : "Registre uma nova receita ou despesa para a empresa."}
              </DialogDescription>
            </DialogHeader>
            <TransactionForm
              initialData={editingTransaction ? { ...editingTransaction, date: parseISO(editingTransaction.date) } : { date: currentPeriod, type: "expense" }}
              onTransactionSaved={handleTransactionSaved}
              onClose={() => setIsTransactionFormOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Cards de Resumo Específicos da Empresa */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="bg-card border border-border rounded-xl shadow-sm frosted-glass card-hover-effect">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Caixa de Emergência</CardTitle>
            <DollarSign className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            {isLoadingGoals ? (
              <div className="h-6 w-24 bg-muted animate-pulse rounded-md" />
            ) : (
              <>
                <div className="text-2xl font-bold text-foreground">{formatCurrency(emergencyFundGoal?.current_amount || 0)}</div>
                {emergencyFundGoal && (
                  <>
                    <p className="text-xs text-muted-foreground">{emergencyFundProgress.toFixed(0)}% da meta de {formatCurrency(emergencyFundGoal.target_amount)}</p>
                    <Progress value={emergencyFundProgress} className="w-full mt-2" />
                  </>
                )}
                {!emergencyFundGoal && (
                  <p className="text-xs text-muted-foreground">Nenhuma meta de fundo de emergência definida.</p>
                )}
              </>
            )}
          </CardContent>
        </Card>
        {/* Outros cards específicos da empresa */}
      </div>

      {/* Configurações de Pró-Labore */}
      <div className="flex items-center justify-between flex-wrap gap-2 mt-6">
        <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Banknote className="h-5 w-5 text-primary" /> Pró-Labore
        </h3>
        <Dialog open={isProLaboreFormOpen} onOpenChange={setIsProLaboreFormOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleEditProLabore(proLaboreSettings || undefined)} variant="outline" className="border-primary text-primary hover:bg-primary/10">
              <Settings className="mr-2 h-4 w-4" /> {proLaboreSettings ? "Editar Pró-Labore" : "Definir Pró-Labore"}
            </Button>
          </DialogTrigger>
          <DialogContent
            className={DIALOG_CONTENT_CLASSNAMES}
            aria-labelledby="prolabore-title"
            aria-describedby="prolabore-description"
          >
            <DialogHeader>
              <DialogTitle id="prolabore-title" className="text-foreground">
                {proLaboreSettings ? "Editar Configurações de Pró-Labore" : "Definir Configurações de Pró-Labore"}
              </DialogTitle>
              <DialogDescription id="prolabore-description" className="text-muted-foreground">
                Defina o valor e o dia de pagamento do seu pró-labore.
              </DialogDescription>
            </DialogHeader>
            <ProLaboreForm
              initialData={editingProLabore}
              onProLaboreSaved={handleProLaboreSaved}
              onClose={() => setIsProLaboreFormOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>
      {proLaboreSettings && (
        <Card className="bg-card border border-border rounded-xl shadow-sm frosted-glass card-hover-effect p-4">
          <CardContent className="flex flex-col sm:flex-row items-center justify-between gap-2">
            <p className="text-foreground">
              Valor: <span className="font-semibold">{formatCurrency(proLaboreSettings.amount)}</span> |
              Dia de Pagamento: <span className="font-semibold">{proLaboreSettings.payment_day_of_month}</span> |
              Conta de Destino: <span className="font-semibold">{proLaboreSettings.target_account?.name || "Não definida"}</span>
            </p>
          </CardContent>
        </Card>
      )}
      {!proLaboreSettings && !isLoadingProLabore && (
        <p className="text-muted-foreground">Nenhuma configuração de pró-labore definida.</p>
      )}

      <Separator className="my-6" />

      {/* Recorrências da Empresa */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Repeat className="h-5 w-5 text-primary" /> Recorrências
        </h3>
        <Dialog open={isRecurrenceFormOpen} onOpenChange={setIsRecurrenceFormOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingRecurrence(undefined)} variant="outline" className="border-primary text-primary hover:bg-primary/10">
              <PlusCircle className="mr-2 h-4 w-4" /> Nova Recorrência
            </Button>
          </DialogTrigger>
          <DialogContent
            className={DIALOG_CONTENT_CLASSNAMES}
            aria-labelledby="company-recurrence-title"
            aria-describedby="company-recurrence-description"
          >
            <DialogHeader>
              <DialogTitle id="company-recurrence-title" className="text-foreground">
                {editingRecurrence ? "Editar Recorrência da Empresa" : "Adicionar Recorrência da Empresa"}
              </DialogTitle>
              <DialogDescription id="company-recurrence-description" className="text-muted-foreground">
                {editingRecurrence ? "Atualize os detalhes da recorrência." : "Registre uma nova receita ou despesa recorrente para a empresa."}
              </DialogDescription>
            </DialogHeader>
            <RecurrenceForm
              initialData={editingRecurrence ? { ...editingRecurrence, start_date: parseISO(editingRecurrence.start_date), end_date: editingRecurrence.end_date ? parseISO(editingRecurrence.end_date) : null } : { type: "expense", start_date: currentPeriod }}
              onRecurrenceSaved={handleRecurrenceSaved}
              onClose={() => setIsRecurrenceFormOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>
      {isLoadingRecurrences ? (
        <p className="text-muted-foreground">Carregando recorrências...</p>
      ) : recurrences && recurrences.length > 0 ? (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
          {recurrences.map(rec => (
            <Card key={rec.id} className="bg-card border border-border rounded-xl shadow-sm frosted-glass card-hover-effect p-4">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-lg font-semibold text-foreground break-words">{rec.description}</CardTitle>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={() => handleEditRecurrence(rec)} className="text-blue-500 hover:bg-blue-500/10">
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDeleteRecurrence(rec.id)} className="text-red-500 hover:bg-red-500/10">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-1">
                <p className={cn("text-lg font-bold", rec.type === "income" ? "text-green-500" : "text-red-500")}>
                  {formatCurrency(rec.amount)} ({rec.type === "income" ? "Receita" : "Despesa"})
                </p>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <CalendarDays className="h-4 w-4" /> Frequência: {rec.frequency}
                </p>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Clock className="h-4 w-4" /> Próximo Vencimento: {format(parseISO(rec.next_due_date), "PPP", { locale: ptBR })}
                </p>
                {rec.category && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    Categoria: {rec.category.name}
                  </p>
                )}
                {rec.account && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    Conta: {rec.account.name}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground">Nenhuma recorrência registrada para a empresa.</p>
      )}

      <Separator className="my-6" />

      {/* Metas da Empresa */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" /> Metas Financeiras
        </h3>
        <Dialog open={isGoalFormOpen} onOpenChange={setIsGoalFormOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingGoal(undefined)} variant="outline" className="border-primary text-primary hover:bg-primary/10">
              <PlusCircle className="mr-2 h-4 w-4" /> Nova Meta
            </Button>
          </DialogTrigger>
          <DialogContent
            className={DIALOG_CONTENT_CLASSNAMES}
            aria-labelledby="company-goal-title"
            aria-describedby="company-goal-description"
          >
            <DialogHeader>
              <DialogTitle id="company-goal-title" className="text-foreground">
                {editingGoal ? "Editar Meta Financeira da Empresa" : "Adicionar Meta Financeira da Empresa"}
              </DialogTitle>
              <DialogDescription id="company-goal-description" className="text-muted-foreground">
                {editingGoal ? "Atualize os detalhes da meta financeira." : "Crie uma nova meta financeira para a empresa."}
              </DialogDescription>
            </DialogHeader>
            <FinancialGoalForm
              initialData={editingGoal ? { ...editingGoal, target_date: editingGoal.target_date ? parseISO(editingGoal.target_date) : null } : { type: "emergency_fund" }}
              onGoalSaved={handleGoalSaved}
              onClose={() => setIsGoalFormOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>
      {isLoadingGoals ? (
        <p className="text-muted-foreground">Carregando metas...</p>
      ) : goals && goals.length > 0 ? (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
          {goals.map(goal => {
            const progress = goal.target_amount > 0 ? (goal.current_amount / goal.target_amount) * 100 : 0;
            return (
              <Card key={goal.id} className="bg-card border border-border rounded-xl shadow-sm frosted-glass card-hover-effect p-4">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-lg font-semibold text-foreground break-words">{goal.name}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => handleEditGoal(goal)} className="text-blue-500 hover:bg-blue-500/10">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteGoal(goal.id)} className="text-red-500 hover:bg-red-500/10">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-1">
                  <p className="text-lg font-bold text-foreground">
                    {formatCurrency(goal.current_amount)} / {formatCurrency(goal.target_amount)}
                  </p>
                  <Progress value={progress} className="w-full mt-2" />
                  <p className="text-xs text-muted-foreground text-right">{progress.toFixed(0)}%</p>
                  {goal.target_date && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <CalendarDays className="h-4 w-4" /> Data Alvo: {format(parseISO(goal.target_date), "PPP", { locale: ptBR })}
                    </p>
                  )}
                  {goal.linked_account && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      Conta Vinculada: {goal.linked_account.name}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <p className="text-muted-foreground">Nenhuma meta financeira registrada para a empresa.</p>
      )}

      <Separator className="my-6" />

      {/* Listagem de Transações da Empresa */}
      <Card className="bg-card border border-border rounded-xl shadow-sm frosted-glass card-hover-effect">
        <CardHeader>
          <CardTitle className="text-foreground">Transações do Mês</CardTitle>
          <CardDescription className="text-muted-foreground">
            Transações para {format(currentPeriod, "MMMM yyyy", { locale: ptBR })}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingTransactions ? (
            <p className="text-muted-foreground">Carregando transações...</p>
          ) : transactions && transactions.length > 0 ? (
            <div className="space-y-3">
              {transactions.map(transaction => (
                <div key={transaction.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/20 border border-border">
                  <div className="flex-grow min-w-0">
                    <p className="text-sm text-muted-foreground">{format(parseISO(transaction.date), "dd/MM")}</p>
                    <h3 className="font-semibold text-foreground text-base break-words">{transaction.description}</h3>
                    <p className={cn("text-lg font-bold", transaction.type === "income" ? "text-green-500" : "text-red-500")}>
                      {formatCurrency(transaction.amount)} ({transaction.type === "income" ? "Receita" : "Despesa"})
                    </p>
                    {transaction.category && (
                      <p className="text-xs text-muted-foreground">Categoria: {transaction.category.name}</p>
                    )}
                    {transaction.account && (
                      <p className="text-xs text-muted-foreground">Conta: {transaction.account.name}</p>
                    )}
                    {transaction.payment_method && (
                      <p className="text-xs text-muted-foreground">Método: {transaction.payment_method}</p>
                    )}
                  </div>
                  <div className="flex-shrink-0 flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => handleEditTransaction(transaction)} className="h-7 w-7 text-blue-500 hover:bg-blue-500/10">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteTransaction(transaction.id)} className="h-7 w-7 text-red-500 hover:bg-red-500/10">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">Nenhuma transação registrada para este período.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CompanyFinance;