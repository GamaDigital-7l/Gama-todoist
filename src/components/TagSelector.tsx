"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showError } from "@/utils/toast";
import { useSession } from "@/integrations/supabase/auth";
import { Badge } from "@/components/ui/badge";
import { Check, PlusCircle } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import TagForm from "./TagForm";
import { Label } from "@/components/ui/label"; // Importar Label

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface TagSelectorProps {
  selectedTagIds: string[];
  onTagSelectionChange: (newSelectedTagIds: string[]) => void;
}

const fetchTags = async (userId: string): Promise<Tag[]> => {
  const { data, error } = await supabase
    .from("tags")
    .select("id, name, color")
    .eq("user_id", userId)
    .order("name", { ascending: true });
  if (error) {
    throw error;
  }
  return data || [];
};

const TagSelector: React.FC<TagSelectorProps> = ({ selectedTagIds, onTagSelectionChange }) => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const [open, setOpen] = React.useState(false);
  const [isTagFormOpen, setIsTagFormOpen] = React.useState(false);

  const { data: availableTags, isLoading, error, refetch } = useQuery<Tag[], Error>({
    queryKey: ["tags", userId],
    queryFn: () => fetchTags(userId!),
    enabled: !!userId,
  });

  const handleSelectTag = (tagId: string) => {
    const newSelectedTagIds = selectedTagIds.includes(tagId)
      ? selectedTagIds.filter((id) => id !== tagId)
      : [...selectedTagIds, tagId];
    onTagSelectionChange(newSelectedTagIds);
  };

  const selectedTags = availableTags?.filter(tag => selectedTagIds.includes(tag.id)) || [];

  if (isLoading) return <p className="text-muted-foreground">Carregando tags...</p>;
  if (error) {
    showError("Erro ao carregar tags: " + error.message);
    return <p className="text-red-500">Erro ao carregar tags.</p>;
  }

  return (
    <div className="space-y-2">
      <Label className="text-foreground">Tags</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between bg-input border-border text-foreground hover:bg-accent hover:text-accent-foreground"
          >
            {selectedTags.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {selectedTags.map((tag) => (
                  <Badge key={tag.id} style={{ backgroundColor: tag.color, color: '#FFFFFF' }} className="text-xs">
                    {tag.name}
                  </Badge>
                ))}
              </div>
            ) : (
              "Selecionar tags..."
            )}
            <PlusCircle className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[200px] p-0 bg-popover border-border rounded-md shadow-lg">
          <Command className="bg-popover text-popover-foreground">
            <CommandInput placeholder="Buscar tag..." className="h-9" />
            <CommandList>
              <CommandEmpty>Nenhuma tag encontrada.</CommandEmpty>
              <CommandGroup>
                {availableTags?.map((tag) => (
                  <CommandItem
                    key={tag.id}
                    value={tag.name}
                    onSelect={() => handleSelectTag(tag.id)}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <Badge style={{ backgroundColor: tag.color, color: '#FFFFFF' }} className="text-xs">
                        {tag.name}
                      </Badge>
                    </div>
                    <Check
                      className={cn(
                        "h-4 w-4",
                        selectedTagIds.includes(tag.id) ? "opacity-100" : "opacity-0"
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandGroup className="border-t border-border">
                <Dialog open={isTagFormOpen} onOpenChange={setIsTagFormOpen}>
                  <DialogTrigger asChild>
                    <CommandItem onSelect={() => setIsTagFormOpen(true)} className="text-primary hover:bg-accent hover:text-accent-foreground">
                      <PlusCircle className="mr-2 h-4 w-4" /> Criar Nova Tag
                    </CommandItem>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px] bg-card border border-border rounded-lg shadow-lg">
                    <DialogHeader>
                      <DialogTitle className="text-foreground">Criar Nova Tag</DialogTitle>
                    </DialogHeader>
                    <TagForm onTagSaved={refetch} onClose={() => setIsTagFormOpen(false)} />
                  </DialogContent>
                </Dialog>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default TagSelector;