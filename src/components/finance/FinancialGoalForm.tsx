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
import { FinancialAccount, FinancialGoalType } from "@/types/finance";
import { useQuery } from "@tanstack/react-query";

const financialGoalSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "O nome da meta é obrigatório."),
  target_amount: z.preprocess(
    (val) => (val === "" ? 0 : Number(String(val).replace(',', '.'))),
    z.number().min(0.01, "O valor alvo deve ser maior que zero.")
  ),
  current_amount: z.preprocess(
    (val) => (val === "" ? 0 : Number(String(val).replace(',', '.'))),
    z.number().min(0, "O valor atual não pode ser negativo.").default(0)
  ),
  target_date: z.date().nullable().optional(),
  type: z.enum(["personal_savings", "emergency_fund", "purchase", "travel"]).default("personal_savings"),
  linked_account_id: z.string().nullable().optional(),
});

export type FinancialGoalFormValues = z.infer<typeof financialGoalSchema>;

interface FinancialGoalFormProps {
  initialData?: FinancialGoalFormValues;
  onGoalSaved: () => void;
  onClose: () => void;
}

const FinancialGoalForm: React.FC<FinancialGoalFormProps> = ({ initialData, onGoalSaved, onClose }) => {
  const { session } = useSession();
  const userId = session?.user?.id;

  const form = useForm<FinancialGoalFormValues>({
    resolver: zodResolver(financialGoalSchema),
    defaultValues: initialData ? {
      ...initialData,
      target_date: initialData.target_date ? (typeof initialData.target_date === 'string' ? parseISO(initialData.target_date) : initialData.target_date) : null,
    } : {
      name: "",
      target_amount: 0,
      current_amount: 0,
      target_date: null,
      type: "personal_savings",
      linked_account_id: null,
    },
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

  const onSubmit = async (values: FinancialGoalFormValues) => {
    if (!userId) {
      showError("Usuário não autenticado.");
      return;
    }

    try {
      const dataToSave = {
        name: values.name,
        target_amount: values.target_amount,
        current_amount: values.current_amount,
        target_date: values.target_date ? format(values.target_date, "yyyy-MM-dd") : null,
        type: values.type,
        linked_account_id: values.linked_account_id || null,
        updated_at: new Date().toISOString(),
      };

      if (initialData?.id) {
        const { error } = await supabase
          .from("financial_goals")
          .update(dataToSave)
          .eq("id", initialData.id)
          .eq("user_id", userId);
        if (error) throw error;
        showSuccess("Meta financeira atualizada com sucesso!");
      } else {
        const { error } = await supabase.from("financial_goals").insert({
          ...dataToSave,
          user_id: userId,
        });
        if (error) throw error;
        showSuccess("Meta financeira adicionada com sucesso!");
      }
      
      form.reset();
      onGoalSaved();
      onClose();
    } catch (error: any) {
      showError("Erro ao salvar meta financeira: " + error.message);
      console.error("Erro ao salvar meta financeira:", error);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-4 bg-card rounded-xl frosted-glass">
      <div>
        <Label htmlFor="name" className="text-foreground">Nome da Meta</Label>
        <Input
          id="name"
          {...form.register("name")}
          placeholder="Ex: Reserva Zen, Carro Novo"
          className="w-full bg-input border-border text-foreground focus-visible:ring-ring"
        />
        {form.formState.errors.name && (
          <p className="text-red-500 text-sm mt-1">
            {form.formState.errors.name.message}
          </p>
        )}
      </div>

      <div>
        <Label htmlFor="target_amount" className="text-foreground">Valor Alvo</Label>
        <Input
          id="target_amount"
          type="number"
          step="0.01"
          {...form.register("target_amount", { valueAsNumber: true })}
          placeholder="Ex: 10000.00"
          className="w-full bg-input border-border text-foreground focus-visible:ring-ring"
        />
        {form.formState.errors.target_amount && (
          <p className="text-red-500 text-sm mt-1">
            {form.formState.errors.target_amount.message}
          </p>
        )}
      </div>

      <div>
        <Label htmlFor="current_amount" className="text-foreground">Valor Atual</Label>
        <Input
          id="current_amount"
          type="number"
          step="0.01"
          {...form.register("current_amount", { valueAsNumber: true })}
          placeholder="Ex: 2500.00"
          className="w-full bg-input border-border text-foreground focus-visible:ring-ring"
        />
        {form.formState.errors.current_amount && (
          <p className="text-red-500 text-sm mt-1">
            {form.formState.errors.current_amount.message}
          </p>
        )}
      </div>

      <div>
        <Label htmlFor="type" className="text-foreground">Tipo de Meta</Label>
        <Select
          onValueChange={(value: FinancialGoalType) => form.setValue("type", value)}
          value={form.watch("type")}
        >
          <SelectTrigger id="type" className="w-full bg-input border-border text-foreground focus-visible:ring-ring">
            <SelectValue placeholder="Selecionar tipo" />
          </SelectTrigger>
          <SelectContent className="bg-popover text-popover-foreground border-border rounded-md shadow-lg">
            <SelectItem value="personal_savings">Poupança Pessoal</SelectItem>
            <SelectItem value="emergency_fund">Fundo de Emergência</SelectItem>
            <SelectItem value="purchase">Compra Específica</SelectItem>
            <SelectItem value="travel">Viagem</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="linked_account_id" className="text-foreground">Vincular à Conta (Opcional)</Label>
        <Select
          onValueChange={(value) => form.setValue("linked_account_id", value)}
          value={form.watch("linked_account_id") || ""}
          disabled={isLoadingAccounts}
        >
          <SelectTrigger id="linked_account_id" className="w-full bg-input border-border text-foreground focus-visible:ring-ring">
            {isLoadingAccounts ? (
              <div className="flex items-center gap-2">
                <Loader2 className="mr-2 h-4 w-4 animate-spin flex-shrink-0" /> Carregando contas...
              </div>
            ) : (
              <SelectValue placeholder="Selecionar conta" />
            )}
          </SelectTrigger>
          <SelectContent className="bg-popover text-popover-foreground border-border rounded-md shadow-lg">
            <SelectItem value="">Nenhuma</SelectItem>
            {accounts?.map(account => (
              <SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="target_date" className="text-foreground">Data Alvo (Opcional)</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={"outline"}
              className={cn(
                "w-full justify-start text-left font-normal bg-input border-border text-foreground hover:bg-accent hover:text-accent-foreground",
                !form.watch("target_date") && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
              {form.watch("target_date") ? (
                format(form.watch("target_date")!, "PPP", { locale: ptBR })
              ) : (
                <span>Escolha uma data</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 bg-popover border-border rounded-md shadow-lg">
            <Calendar
              mode="single"
              selected={form.watch("target_date") || undefined}
              onSelect={(date) => form.setValue("target_date", date || null)}
              initialFocus
              locale={ptBR}
            />
          </PopoverContent>
        </Popover>
      </div>

      <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
        {initialData?.id ? "Atualizar Meta" : "Adicionar Meta"}
      </Button>
    </form>
  );
};

export default FinancialGoalForm;