"use client";

import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Loader2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { useSession } from "@/integrations/supabase/auth";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FinancialAccount, FinancialCategory, FinancialRecurrenceFrequency, FinancialTransactionType } from "@/types/finance";
import { useQuery } from "@tanstack/react-query";

const recurrenceSchema = z.object({
  id: z.string().optional(),
  description: z.string().min(1, "A descrição é obrigatória."),
  amount: z.preprocess(
    (val) => (val === "" ? 0 : Number(String(val).replace(',', '.'))),
    z.number().min(0.01, "O valor deve ser maior que zero.")
  ),
  type: z.enum(["income", "expense"]).default("expense"),
  category_id: z.string().nullable().optional(),
  account_id: z.string().min(1, "A conta é obrigatória."),
  frequency: z.enum(["daily", "weekly", "monthly", "annually"]).default("monthly"),
  start_date: z.date().default(new Date()),
  end_date: z.date().nullable().optional(),
});

export type RecurrenceFormValues = z.infer<typeof recurrenceSchema>;

interface RecurrenceFormProps {
  initialData?: RecurrenceFormValues;
  onRecurrenceSaved: () => void;
  onClose: () => void;
}

const RecurrenceForm: React.FC<RecurrenceFormProps> = ({ initialData, onRecurrenceSaved, onClose }) => {
  const { session } = useSession();
  const userId = session?.user?.id;

  const form = useForm<RecurrenceFormValues>({
    resolver: zodResolver(recurrenceSchema),
    defaultValues: initialData ? {
      ...initialData,
      start_date: initialData.start_date ? (typeof initialData.start_date === 'string' ? parseISO(initialData.start_date) : initialData.start_date) : new Date(),
      end_date: initialData.end_date ? (typeof initialData.end_date === 'string' ? parseISO(initialData.end_date) : initialData.end_date) : null,
    } : {
      description: "",
      amount: 0,
      type: "expense",
      category_id: null,
      account_id: "",
      frequency: "monthly",
      start_date: new Date(),
      end_date: null,
    },
  });

  const recurrenceType = form.watch("type");

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

  const filteredCategories = categories?.filter(cat => 
    cat.type === "both" || cat.type === recurrenceType
  ) || [];

  const onSubmit = async (values: RecurrenceFormValues) => {
    if (!userId) {
      showError("Usuário não autenticado.");
      return;
    }

    try {
      const dataToSave = {
        description: values.description,
        amount: values.amount,
        type: values.type,
        category_id: values.category_id || null,
        account_id: values.account_id,
        frequency: values.frequency,
        start_date: format(values.start_date, "yyyy-MM-dd"),
        end_date: values.end_date ? format(values.end_date, "yyyy-MM-dd") : null,
        next_due_date: format(values.start_date, "yyyy-MM-dd"), // Inicialmente, a próxima data de vencimento é a data de início
        updated_at: new Date().toISOString(),
      };

      if (initialData?.id) {
        const { error } = await supabase
          .from("financial_recurrences")
          .update(dataToSave)
          .eq("id", initialData.id)
          .eq("user_id", userId);
        if (error) throw error;
        showSuccess("Recorrência atualizada com sucesso!");
      } else {
        const { error } = await supabase.from("financial_recurrences").insert({
          ...dataToSave,
          user_id: userId,
        });
        if (error) throw error;
        showSuccess("Recorrência adicionada com sucesso!");
      }
      
      form.reset();
      onRecurrenceSaved();
      onClose();
    } catch (error: any) {
      showError("Erro ao salvar recorrência: " + error.message);
      console.error("Erro ao salvar recorrência:", error);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-4 bg-card rounded-xl frosted-glass">
      <div>
        <Label htmlFor="description" className="text-foreground">Descrição</Label>
        <Input
          id="description"
          {...form.register("description")}
          placeholder="Ex: Aluguel, Salário"
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
          placeholder="Ex: 1500.00"
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
          onValueChange={(value) => form.setValue("category_id", value)}
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

      <div>
        <Label htmlFor="frequency" className="text-foreground">Frequência</Label>
        <Select
          onValueChange={(value: FinancialRecurrenceFrequency) => form.setValue("frequency", value)}
          value={form.watch("frequency")}
        >
          <SelectTrigger id="frequency" className="w-full bg-input border-border text-foreground focus-visible:ring-ring">
            <SelectValue placeholder="Selecionar frequência" />
          </SelectTrigger>
          <SelectContent className="bg-popover text-popover-foreground border-border rounded-md shadow-lg">
            <SelectItem value="daily">Diário</SelectItem>
            <SelectItem value="weekly">Semanal</SelectItem>
            <SelectItem value="monthly">Mensal</SelectItem>
            <SelectItem value="annually">Anual</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="start_date" className="text-foreground">Data de Início</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={"outline"}
              className={cn(
                "w-full justify-start text-left font-normal bg-input border-border text-foreground hover:bg-accent hover:text-accent-foreground",
                !form.watch("start_date") && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
              {form.watch("start_date") ? (
                format(form.watch("start_date")!, "PPP", { locale: ptBR })
              ) : (
                <span>Escolha uma data</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 bg-popover border-border rounded-md shadow-lg">
            <Calendar
              mode="single"
              selected={form.watch("start_date") || undefined}
              onSelect={(date) => form.setValue("start_date", date || new Date())}
              initialFocus
              locale={ptBR}
            />
          </PopoverContent>
        </Popover>
      </div>

      <div>
        <Label htmlFor="end_date" className="text-foreground">Data de Fim (Opcional)</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={"outline"}
              className={cn(
                "w-full justify-start text-left font-normal bg-input border-border text-foreground hover:bg-accent hover:text-accent-foreground",
                !form.watch("end_date") && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
              {form.watch("end_date") ? (
                format(form.watch("end_date")!, "PPP", { locale: ptBR })
              ) : (
                <span>Escolha uma data</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 bg-popover border-border rounded-md shadow-lg">
            <Calendar
              mode="single"
              selected={form.watch("end_date") || undefined}
              onSelect={(date) => form.setValue("end_date", date || null)}
              initialFocus
              locale={ptBR}
            />
          </PopoverContent>
        </Popover>
      </div>

      <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
        {initialData?.id ? "Atualizar Recorrência" : "Adicionar Recorrência"}
      </Button>
    </form>
  );
};

export default RecurrenceForm;