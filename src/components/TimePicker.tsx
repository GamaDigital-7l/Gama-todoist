"use client";

import React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface TimePickerProps {
  value?: string; // Formato "HH:mm"
  onChange: (time: string | null) => void; // Alterado para aceitar null
}

const TimePicker: React.FC<TimePickerProps> = ({ value, onChange }) => {
  const [hour, setHour] = React.useState<string>(value ? value.split(":")[0] : "");
  const [minute, setMinute] = React.useState<string>(value ? value.split(":")[1] : "");

  React.useEffect(() => {
    if (hour && minute) {
      onChange(`${hour}:${minute}`);
    } else {
      onChange(null); // Retorna null se não houver hora ou minuto
    }
  }, [hour, minute, onChange]);

  const handleHourChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === "" || (parseInt(val) >= 0 && parseInt(val) <= 23 && val.length <= 2)) {
      setHour(val);
    }
  };

  const handleMinuteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === "" || (parseInt(val) >= 0 && parseInt(val) <= 59 && val.length <= 2)) {
      setMinute(val);
    }
  };

  // Não precisamos de formatTimePart aqui, pois o valor é formatado no useEffect
  // e o input type="number" já lida com a entrada.

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          className={cn(
            "w-full justify-start text-left font-normal bg-input border-border text-foreground hover:bg-accent hover:text-accent-foreground rounded-xl",
            !value && "text-muted-foreground"
          )}
        >
          <Clock className="mr-2 h-4 w-4" />
          {value ? value : <span>Escolha um horário</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2 bg-popover border-border rounded-2xl shadow-xl frosted-glass">
        <div className="flex items-center space-x-2">
          <input
            type="number"
            min="0"
            max="23"
            value={hour}
            onChange={handleHourChange}
            placeholder="HH"
            className="w-12 text-center border border-border rounded-xl p-1 focus:outline-none focus:ring-2 focus:ring-ring bg-input text-foreground"
          />
          <span className="text-foreground">:</span>
          <input
            type="number"
            min="0"
            max="59"
            value={minute}
            onChange={handleMinuteChange}
            placeholder="MM"
            className="w-12 text-center border border-border rounded-xl p-1 focus:outline-none focus:ring-2 focus:ring-ring bg-input text-foreground"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default TimePicker;