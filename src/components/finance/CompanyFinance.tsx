"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, DollarSign, Briefcase } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import TransactionForm from './TransactionForm';
import { FinancialTransaction } from '@/types/finance';
import { DIALOG_CONTENT_CLASSNAMES } from '@/lib/constants';

interface CompanyFinanceProps {
  currentPeriod: Date;
  onTransactionAdded: () => void;
}

const CompanyFinance: React.FC<CompanyFinanceProps> = ({ currentPeriod, onTransactionAdded }) => {
  const [isTransactionFormOpen, setIsTransactionFormOpen] = React.useState(false);

  const handleTransactionSaved = () => {
    onTransactionAdded();
    setIsTransactionFormOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Briefcase className="h-6 w-6 text-primary" /> Financeiro Empresa
        </h2>
        <Dialog open={isTransactionFormOpen} onOpenChange={setIsTransactionFormOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setIsTransactionFormOpen(true)} className="bg-primary text-primary-foreground hover:bg-primary/90">
              <PlusCircle className="mr-2 h-4 w-4" /> Nova Transação
            </Button>
          </DialogTrigger>
          <DialogContent className={DIALOG_CONTENT_CLASSNAMES}>
            <DialogHeader>
              <DialogTitle className="text-foreground">Adicionar Transação da Empresa</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Registre uma nova receita ou despesa para a empresa.
              </DialogDescription>
            </DialogHeader>
            <TransactionForm
              initialData={{ date: currentPeriod, type: "expense" }}
              onTransactionSaved={handleTransactionSaved}
              onClose={() => setIsTransactionFormOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Cards de Resumo Específicos da Empresa (a serem implementados) */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="bg-card border border-border rounded-xl shadow-sm frosted-glass card-hover-effect">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Caixa de Emergência</CardTitle>
            <DollarSign className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">R$ 0,00</div>
            <p className="text-xs text-muted-foreground">0% da meta</p>
          </CardContent>
        </Card>
        {/* Outros cards específicos da empresa */}
      </div>

      {/* Listagem de Transações da Empresa (a ser implementada) */}
      <Card className="bg-card border border-border rounded-xl shadow-sm frosted-glass card-hover-effect">
        <CardHeader>
          <CardTitle className="text-foreground">Transações da Empresa</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Nenhuma transação registrada para este período.</p>
          {/* Aqui virá a tabela ou lista de transações */}
        </CardContent>
      </Card>
    </div>
  );
};

export default CompanyFinance;