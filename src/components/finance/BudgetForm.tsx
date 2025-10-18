"use client";

import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { FinancialCategory, FinancialTransactionType } from "@/types/finance";
import { useQuery } from "@tanstack/react-query";

const budgetSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "O nome do orçamento é obrigatório."),
  category_id: z.string().nullable().optional(),
  amount: z.preprocess(
    (val) => (val === "" ? 0 : Number(String(val).replace(',', '.'))),
    z.number().min(0.01, "O valor deve ser maior que zero.")
  ),
  start_date: z.date().default(new Date()),
  end_date: z.date().default(new Date()),
  type: z.enum(["income", "expense"]).default("expense"),
  scope: z.enum(["personal", "company"]).default("personal"),
});

export type BudgetFormValues = z.infer<typeof budgetSchema>;

interface BudgetFormProps {
  initialData?: BudgetFormValues;
  onBudgetSaved: () => void;
  onClose: () => void;
  defaultScope: 'personal' | 'company'; // Para definir o escopo padrão
}

const BudgetForm: React.FC<BudgetFormProps> = ({ initialData, onBudgetSaved, onClose, defaultScope }) => {
  const { session } = useSession();
  const userId = session?.user?.id;

  const form = useForm<BudgetFormValues>({
    resolver: zodResolver(budgetSchema),
    defaultValues: initialData ? {
      ...initialData,
      start_date: initialData.start_date ? (typeof initialData.start_date === 'string' ? parseISO(initialData.start_date) : initialData.start_date) : new Date(),
      end_date: initialData.end_date ? (typeof initialData.end_date === 'string' ? parseISO(initialData.end_date) : initialData.end_date) : new Date(),
    } : {
      name: "",
      category_id: null,
      amount: 0,
      start_date: new Date(),
      end_date: new Date(),
      type: "expense",
      scope: defaultScope,
    },
  });

  const budgetType = form.watch("type");

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

  const filteredCategories = categories?.filter(cat => 
    cat.type === "both" || cat.type === budgetType
  ) || [];

  const onSubmit = async (values: BudgetFormValues) => {
    if (!userId) {
      showError("Usuário não autenticado.");
      return;
    }

    try {
      const dataToSave = {
        name: values.name,
        category_id: values.category_id || null,
        amount: values.amount,
        start_date: format(values.start_date, "yyyy-MM-dd"),
        end_date: format(values.end_date, "yyyy-MM-dd"),
        type: values.type,
        scope: values.scope,
        updated_at: new Date().toISOString(),
      };

      if (initialData?.id) {
        const { error } = await supabase
          .from("budgets")
          .update(dataToSave)
          .eq("id", initialData.id)
          .eq("user_id", userId);
        if (error) throw error;
        showSuccess("Orçamento atualizado com sucesso!");
      } else {
        const { error } = await supabase.from("budgets").insert({
          ...dataToSave,
          user_id: userId,
        });
        if (error) throw error;
        showSuccess("Orçamento adicionado com sucesso!");
      }
      
      form.reset();
      onBudgetSaved();
      onClose();
    } catch (error: any) {
      showError("Erro ao salvar orçamento: " + error.message);
      console.error("Erro ao salvar orçamento:", error);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-4 bg-card rounded-xl frosted-glass">
      <div>
        <Label htmlFor="name" className="text-foreground">Nome do Orçamento</Label>
        <Input
          id="name"
          {...form.register("name")}
          placeholder="Ex: Orçamento de Marketing, Gastos com Alimentação"
          className="w-full bg-input border-border text-foreground focus-visible:ring-ring"
        />
        {form.formState.errors.name && (
          <p className="text-red-500 text-sm mt-1">
            {form.formState.errors.name.message}
          </p>
        )}
      </div>

      <div>
        <Label htmlFor="amount" className="text-foreground">Valor Orçado</Label>
        <Input
          id="amount"
          type="number"
          step="0.01"
          {...form.register("amount", { valueAsNumber: true })}
          placeholder="Ex: 500.00"
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
        <Label htmlFor="end_date" className="text-foreground">Data de Fim</Label>
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
              onSelect={(date) => form.setValue("end_date", date || new Date())}
              initialFocus
              locale={ptBR}
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Campo de Scope (oculto ou fixo dependendo do contexto) */}
      <Input type="hidden" {...form.register("scope")} />

      <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
        {initialData?.id ? "Atualizar Orçamento" : "Adicionar Orçamento"}
      </Button>
    </form>
  );
};

export default BudgetForm;