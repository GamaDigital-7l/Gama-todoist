"use client";

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';
import { useSession } from '@/integrations/supabase/auth';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { FinancialTransaction, FinancialCategory, FinancialAccount, FinancialTransactionType } from '@/types/finance';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DIALOG_CONTENT_CLASSNAMES } from '@/lib/constants';
import { Client } from '@/types/client'; // Importar tipo Client

const transactionSchema = z.object({
  id: z.string().optional(),
  date: z.date().default(new Date()),
  description: z.string().min(1, "A descrição é obrigatória."),
  amount: z.preprocess(
    (val) => (val === "" ? 0 : Number(String(val).replace(',', '.'))), // Handle comma as decimal separator
    z.number().min(0.01, "O valor deve ser maior que zero.")
  ),
  type: z.enum(["income", "expense"]).default("expense"),
  category_id: z.string().nullable().optional(),
  subcategory_id: z.string().nullable().optional(),
  client_id: z.string().nullable().optional(),
  account_id: z.string().min(1, "A conta é obrigatória."),
  recurrence_id: z.string().nullable().optional(), // Not implemented in this form yet
  payment_method: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  attachment_url: z.string().nullable().optional(), // Adicionado
  is_recurrent_instance: z.boolean().default(false), // Not implemented in this form yet
});

export type TransactionFormValues = z.infer<typeof transactionSchema>;

interface TransactionFormProps {
  initialData?: Partial<FinancialTransaction>;
  onTransactionSaved: () => void;
  onClose: () => void;
}

const TransactionForm: React.FC<TransactionFormProps> = ({ initialData, onTransactionSaved, onClose }) => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: initialData ? {
      ...initialData,
      date: initialData.date ? (typeof initialData.date === 'string' ? parseISO(initialData.date) : initialData.date) : new Date(),
      amount: initialData.amount || 0,
      type: initialData.type || "expense",
      category_id: initialData.category_id || null,
      subcategory_id: initialData.subcategory_id || null,
      client_id: initialData.client_id || null,
      account_id: initialData.account_id || "",
      payment_method: initialData.payment_method || null,
      notes: initialData.notes || null,
      attachment_url: initialData.attachment_url || null, // Adicionado
    } : {
      date: new Date(),
      description: "",
      amount: 0,
      type: "expense",
      category_id: null,
      subcategory_id: null,
      client_id: null,
      account_id: "",
      payment_method: null,
      notes: null,
      attachment_url: null, // Adicionado
    },
  });

  const transactionType = form.watch("type");
  const selectedCategoryId = form.watch("category_id");

  const { data: categories, isLoading: isLoadingCategories } = useQuery<FinancialCategory[], Error>({
    queryKey: ["financialCategories", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_categories")
        .select("*")
        .eq("user_id", userId!)
        .order("name", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });

  const { data: accounts, isLoading: isLoadingAccounts } = useQuery<FinancialAccount[], Error>({
    queryKey: ["financialAccounts", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_accounts")
        .select("*")
        .eq("user_id", userId!)
        .order("name", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });

  const { data: clients, isLoading: isLoadingClients } = useQuery<Client[], Error>({
    queryKey: ["clients", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name")
        .eq("user_id", userId!)
        .order("name", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });

  const filteredCategories = categories?.filter(cat => 
    cat.type === "both" || cat.type === transactionType
  ) || [];

  const subcategories = categories?.filter(cat => cat.parent_id === selectedCategoryId) || [];

  const onSubmit = async (values: TransactionFormValues) => {
    if (!userId) {
      showError("Usuário não autenticado.");
      return;
    }

    try {
      const dataToSave = {
        date: format(values.date, "yyyy-MM-dd"),
        description: values.description,
        amount: values.amount,
        type: values.type,
        category_id: values.category_id || null,
        subcategory_id: values.subcategory_id || null,
        client_id: values.client_id || null,
        account_id: values.account_id,
        payment_method: values.payment_method || null,
        notes: values.notes || null,
        attachment_url: values.attachment_url || null,
        is_recurrent_instance: values.is_recurrent_instance,
        updated_at: new Date().toISOString(),
      };

      if (values.id) {
        const { error } = await supabase
          .from("financial_transactions")
          .update(dataToSave)
          .eq("id", values.id)
          .eq("user_id", userId);
        if (error) throw error;
        showSuccess("Transação atualizada com sucesso!");
      } else {
        const { error } = await supabase.from("financial_transactions").insert({
          ...dataToSave,
          user_id: userId,
        });
        if (error) throw error;
        showSuccess("Transação adicionada com sucesso!");
      }
      
      form.reset();
      onTransactionSaved();
      onClose();
    } catch (error: any) {
      showError("Erro ao salvar transação: " + error.message);
      console.error("Erro ao salvar transação:", error);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-4 bg-card rounded-xl frosted-glass">
      <div>
        <Label htmlFor="description" className="text-foreground">Descrição</Label>
        <Input
          id="description"
          {...form.register("description")}
          placeholder="Ex: Almoço com cliente"
          className="w-full bg-input border-border text-foreground focus-visible:ring-ring"
        />
        {form.formState.errors.description && (
          <p className="text-red-500 text-sm mt-1">
            {form.formState.errors.description.message}
          </p>
        )}
      </div>

      <div>
        <Label htmlFor="amount" className="text-foreground">Valor</Label>
        <Input
          id="amount"
          type="number"
          step="0.01"
          {...form.register("amount", { valueAsNumber: true })}
          placeholder="Ex: 120.50"
          className="w-full bg-input border-border text-foreground focus-visible:ring-ring"
        />
        {form.formState.errors.amount && (
          <p className="text-red-500 text-sm mt-1">
            {form.formState.errors.amount.message}
          </p>
        )}
      </div>

      <div>
        <Label htmlFor="type" className="text-foreground">Tipo</Label>
        <Select
          onValueChange={(value: FinancialTransactionType) => form.setValue("type", value)}
          value={form.watch("type")}
        >
          <SelectTrigger id="type" className="w-full bg-input border-border text-foreground focus-visible:ring-ring">
            <SelectValue placeholder="Selecionar tipo" />
          </SelectTrigger>
          <SelectContent className="bg-popover text-popover-foreground border-border rounded-md shadow-lg">
            <SelectItem value="income">Receita</SelectItem>
            <SelectItem value="expense">Despesa</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="date" className="text-foreground">Data</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={"outline"}
              className={cn(
                "w-full justify-start text-left font-normal bg-input border-border text-foreground hover:bg-accent hover:text-accent-foreground",
                !form.watch("date") && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
              {form.watch("date") ? (
                format(form.watch("date")!, "PPP", { locale: ptBR })
              ) : (
                <span>Escolha uma data</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 bg-popover border-border rounded-md shadow-lg">
            <Calendar
              mode="single"
              selected={form.watch("date") || undefined}
              onSelect={(date) => form.setValue("date", date || new Date())}
              initialFocus
              locale={ptBR}
            />
          </PopoverContent>
        </Popover>
      </div>

      <div>
        <Label htmlFor="account_id" className="text-foreground">Conta</Label>
        <Select
          onValueChange={(value) => form.setValue("account_id", value)}
          value={form.watch("account_id") || ""}
          disabled={isLoadingAccounts}
        >
          <SelectTrigger id="account_id" className="w-full bg-input border-border text-foreground focus-visible:ring-ring">
            {isLoadingAccounts ? (
              <div className="flex items-center gap-2">
                <Loader2 className="mr-2 h-4 w-4 animate-spin flex-shrink-0" /> Carregando contas...
              </div>
            ) : (
              <SelectValue placeholder="Selecionar conta" />
            )}
          </SelectTrigger>
          <SelectContent className="bg-popover text-popover-foreground border-border rounded-md shadow-lg">
            {accounts?.map(account => (
              <SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {form.formState.errors.account_id && (
          <p className="text-red-500 text-sm mt-1">
            {form.formState.errors.account_id.message}
          </p>
        )}
      </div>

      <div>
        <Label htmlFor="category_id" className="text-foreground">Categoria (Opcional)</Label>
        <Select
          onValueChange={(value) => {
            form.setValue("category_id", value);
            form.setValue("subcategory_id", null); // Reset subcategory on category change
          }}
          value={form.watch("category_id") || ""}
          disabled={isLoadingCategories}
        >
          <SelectTrigger id="category_id" className="w-full bg-input border-border text-foreground focus-visible:ring-ring">
            {isLoadingCategories ? (
              <div className="flex items-center gap-2">
                <Loader2 className="mr-2 h-4 w-4 animate-spin flex-shrink-0" /> Carregando categorias...
              </div>
            ) : (
              <SelectValue placeholder="Selecionar categoria" />
            )}
          </SelectTrigger>
          <SelectContent className="bg-popover text-popover-foreground border-border rounded-md shadow-lg">
            <SelectItem value="">Nenhuma</SelectItem>
            {filteredCategories.map(category => (
              <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedCategoryId && subcategories.length > 0 && (
        <div>
          <Label htmlFor="subcategory_id" className="text-foreground">Subcategoria (Opcional)</Label>
          <Select
            onValueChange={(value) => form.setValue("subcategory_id", value)}
            value={form.watch("subcategory_id") || ""}
            disabled={isLoadingCategories}
          >
            <SelectTrigger id="subcategory_id" className="w-full bg-input border-border text-foreground focus-visible:ring-ring">
              <SelectValue placeholder="Selecionar subcategoria" />
            </SelectTrigger>
            <SelectContent className="bg-popover text-popover-foreground border-border rounded-md shadow-lg">
              <SelectItem value="">Nenhuma</SelectItem>
              {subcategories.map(subcategory => (
                <SelectItem key={subcategory.id} value={subcategory.id}>{subcategory.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {transactionType === "income" && (
        <div>
          <Label htmlFor="client_id" className="text-foreground">Cliente (Opcional)</Label>
          <Select
            onValueChange={(value) => form.setValue("client_id", value)}
            value={form.watch("client_id") || ""}
            disabled={isLoadingClients}
          >
            <SelectTrigger id="client_id" className="w-full bg-input border-border text-foreground focus-visible:ring-ring">
              {isLoadingClients ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin flex-shrink-0" /> Carregando clientes...
                </div>
              ) : (
                <SelectValue placeholder="Selecionar cliente" />
              )}
            </SelectTrigger>
            <SelectContent className="bg-popover text-popover-foreground border-border rounded-md shadow-lg">
              <SelectItem value="">Nenhum</SelectItem>
              {clients?.map(client => (
                <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div>
        <Label htmlFor="payment_method" className="text-foreground">Método de Pagamento (Opcional)</Label>
        <Input
          id="payment_method"
          {...form.register("payment_method")}
          placeholder="Ex: Pix, Cartão de Crédito"
          className="w-full bg-input border-border text-foreground focus-visible:ring-ring"
        />
      </div>

      <div>
        <Label htmlFor="attachment_url" className="text-foreground">URL do Anexo (Opcional)</Label>
        <Input
          id="attachment_url"
          {...form.register("attachment_url")}
          placeholder="Ex: https://exemplo.com/recibo.pdf"
          className="w-full bg-input border-border text-foreground focus-visible:ring-ring"
        />
        {form.formState.errors.attachment_url && (
          <p className="text-red-500 text-sm mt-1">
            {form.formState.errors.attachment_url.message}
          </p>
        )}
      </div>

      <div>
        <Label htmlFor="notes" className="text-foreground">Notas (Opcional)</Label>
        <Textarea
          id="notes"
          {...form.register("notes")}
          placeholder="Observações adicionais..."
          className="w-full bg-input border-border text-foreground focus-visible:ring-ring"
        />
      </div>

      <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
        {initialData?.id ? "Atualizar Transação" : "Adicionar Transação"}
      </Button>
    </form>
  );
};

export default TransactionForm;