import { useState } from "react";
import { Popover as PopoverPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";
import {
  Command,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { HugeiconsIcon } from "@hugeicons/react";
import { UnfoldMoreIcon } from "@hugeicons/core-free-icons";

export type ComboboxOption = {
  value: string;
  label: string;
};

type ComboboxProps = {
  value: string;
  options: ComboboxOption[];
  onValueChange: (value: string) => void;
  /** Placeholder shown in the search field inside the popover. */
  searchPlaceholder?: string;
  /** Text shown on the trigger when the current value is empty. */
  emptyLabel?: string;
  /** Label prefix for the "use your own text" row, e.g. 使用. */
  customPrefix?: string;
  /** Accessible name for the trigger, since it renders no visible label. */
  ariaLabel?: string;
  className?: string;
};

export function Combobox({
  value,
  options,
  onValueChange,
  searchPlaceholder,
  emptyLabel,
  customPrefix = "使用",
  ariaLabel,
  className,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const trimmed = query.trim();
  const matched = options.find((option) => option.value === value);
  const displayLabel =
    value === "" ? emptyLabel : (matched?.label ?? value);
  const showCustom =
    trimmed !== "" &&
    !options.some(
      (option) => option.value.toLowerCase() === trimmed.toLowerCase(),
    );

  const commit = (next: string) => {
    onValueChange(next);
    setOpen(false);
    setQuery("");
  };

  return (
    <PopoverPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          data-slot="combobox-trigger"
          aria-label={ariaLabel}
          aria-expanded={open}
          className={cn(
            "flex w-full items-center justify-between gap-1.5 rounded-3xl border border-transparent bg-input/50 px-3 py-2 text-[12px] whitespace-nowrap transition-[color,box-shadow,background-color] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 h-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
            className,
          )}
        >
          <span
            className={cn(
              "line-clamp-1 text-left",
              value === "" && "text-muted-foreground",
            )}
          >
            {displayLabel}
          </span>
          <HugeiconsIcon
            icon={UnfoldMoreIcon}
            strokeWidth={2}
            className="pointer-events-none size-4 text-muted-foreground"
          />
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={4}
          className={cn(
            "z-50 w-64 origin-(--radix-popover-content-transform-origin) overflow-hidden rounded-3xl bg-popover p-1 text-popover-foreground shadow-lg ring-1 ring-foreground/5 outline-none",
          )}
        >
          <Command>
            <CommandInput
              placeholder={searchPlaceholder}
              value={query}
              onValueChange={setQuery}
            />
            <CommandList>
              {options.map((option) => (
                <CommandItem
                  key={option.value || "__empty__"}
                  value={option.value || "__empty__"}
                  data-checked={option.value === value}
                  onSelect={() => commit(option.value)}
                >
                  {option.label}
                </CommandItem>
              ))}
              {showCustom && (
                <CommandItem
                  value={`custom:${trimmed}`}
                  onSelect={() => commit(trimmed)}
                >
                  {`${customPrefix} "${trimmed}"`}
                </CommandItem>
              )}
            </CommandList>
          </Command>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
