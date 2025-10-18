"use client";

import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { useSession } from "@/integrations/supabase/auth";
import { FinancialAccount } from "@/types/finance";
import { useQuery } from "@tanstack/react-query";

const proLaboreSchema = z.object({
  id: z.string().optional(),
  amount: z.preprocess(
    (val) => (val === "" ? 0 : Number(String(val).replace(',', '.'))),
    z.number().min(0.01, "O valor deve ser maior que zero.")
  ),
  payment_day_of_month: z.preprocess(
    (val) => (val === "" ? 1 : Number(val)),
    z.number().int().min(1, "O dia deve ser entre 1 e 31.").max(31, "O dia deve ser entre 1 e 31.")
  ),
  target_account_id: z.string().nullable().optional(),
});

export type ProLaboreFormValues = z.infer<typeof proLaboreSchema>;

interface ProLaboreFormProps {
  initialData?: ProLaboreFormValues;
  onProLaboreSaved: () => void;
  onClose: () => void;
}

const ProLaboreForm: React.FC<ProLaboreFormProps> = ({ initialData, onProLaboreSaved, onClose }) => {
  const { session } = useSession();
  const userId = session?.user?.id;

  const form = useForm<ProLaboreFormValues>({
    resolver: zodResolver(proLaboreSchema),
    defaultValues: initialData || {
      amount: 0,
      payment_day_of_month: 1,
      target_account_id: null,
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

  const onSubmit = async (values: ProLaboreFormValues) => {
    if (!userId) {
      showError("Usuário não autenticado.");
      return;
    }

    try {
      const dataToSave = {
        amount: values.amount,
        payment_day_of_month: values.payment_day_of_month,
        target_account_id: values.target_account_id || null,
        updated_at: new Date().toISOString(),
      };

      if (initialData?.id) {
        const { error } = await supabase
          .from("pro_labore_settings")
          .update(dataToSave)
          .eq("id", initialData.id)
          .eq("user_id", userId);
        if (error) throw error;
        showSuccess("Configurações de Pró-Labore atualizadas com sucesso!");
      } else {
        const { error } = await supabase.from("pro_labore_settings").insert({
          ...dataToSave,
          user_id: userId,
        });
        if (error) throw error;
        showSuccess("Configurações de Pró-Labore adicionadas com sucesso!");
      }
      
      form.reset();
      onProLaboreSaved();
      onClose();
    } catch (error: any) {
      showError("Erro ao salvar configurações de Pró-Labore: " + error.message);
      console.error("Erro ao salvar configurações de Pró-Labore:", error);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-4 bg-card rounded-xl frosted-glass">
      <div>
        <Label htmlFor="amount" className="text-foreground">Valor do Pró-Labore</Label>
        <Input
          id="amount"
          type="number"
          step="0.01"
          {...form.register("amount", { valueAsNumber: true })}
          placeholder="Ex: 2500.00"
          className="w-full bg-input border-border text-foreground focus-visible:ring-ring"
        />
        {form.formState.errors.amount && (
          <p className="text-red-500 text-sm mt-1">
            {form.formState.errors.amount.message}
          </p>
        )}
      </div>

      <div>
        <Label htmlFor="payment_day_of_month" className="text-foreground">Dia do Mês para Pagamento</Label>
        <Input
          id="payment_day_of_month"
          type="number"
          min="1"
          max="31"
          {...form.register("payment_day_of_month", { valueAsNumber: true })}
          placeholder="Ex: 5"
          className="w-full bg-input border-border text-foreground focus-visible:ring-ring"
        />
        {form.formState.errors.payment_day_of_month && (
          <p className="text-red-500 text-sm mt-1">
            {form.formState.errors.payment_day_of_month.message}
          </p>
        )}
      </div>

      <div>
        <Label htmlFor="target_account_id" className="text-foreground">Conta de Destino (Pessoal, Opcional)</Label>
        <Select
          onValueChange={(value) => form.setValue("target_account_id", value)}
          value={form.watch("target_account_id") || ""}
          disabled={isLoadingAccounts}
        >
          <SelectTrigger id="target_account_id" className="w-full bg-input border-border text-foreground focus-visible:ring-ring">
            {isLoadingAccounts ? (
              <div className="flex items-center gap-2">
                <Loader2 className="mr-2 h-4 w-4 animate-spin flex-shrink-0" /> Carregando contas...
              </div>
            ) : (
              <SelectValue placeholder="Selecionar conta pessoal" />
            )}
          </SelectTrigger>
          <SelectContent className="bg-popover text-popover-foreground border-border rounded-md shadow-lg">
            <SelectItem value="">Nenhuma</SelectItem>
            {accounts?.filter(acc => acc.type === 'personal_cash' || acc.type === 'savings').map(account => (
              <SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
        {initialData?.id ? "Atualizar Pró-Labore" : "Definir Pró-Labore"}
      </Button>
    </form>
  );
};

export default ProLaboreForm;