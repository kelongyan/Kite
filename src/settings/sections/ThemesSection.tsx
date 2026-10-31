import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useMessages } from "@/modules/i18n";
import { listBuiltinThemes, useTheme } from "@/modules/theme";
import {
  deleteCustomTheme,
  saveCustomTheme,
} from "@/modules/theme/customThemes";
import { validateTheme } from "@/modules/theme/validateTheme";
import { DEFAULT_THEME_ID, type Theme } from "@/modules/theme/types";
import { Cancel01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useMemo, useRef, useState } from "react";
import { SectionHeader } from "../components/SectionHeader";

export function ThemesSection() {
  const messages = useMessages();
  const themeMessages = messages.settings.themes;
  const { themeId, setThemeId, resolvedMode, customThemes } = useTheme();
  const builtinThemes = listBuiltinThemes();
  // One flat list that follows the resolved mode: a theme is only offered
  // with the face it would actually apply, so a card's preview is what
  // clicking yields. Built-ins lead (default first), customs trail.
  const themes = useMemo(
    () => [...builtinThemes, ...customThemes],
    [builtinThemes, customThemes],
  );
  const visibleThemes = useMemo(
    () => themes.filter((t) => t.variants[resolvedMode]),
    [themes, resolvedMode],
  );
  const customIds = useMemo(
    () => new Set(customThemes.map((t) => t.id)),
    [customThemes],
  );

  const [importError, setImportError] = useState<string | null>(null);
  const [themeToDelete, setThemeToDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleThemeFiles = async (files: FileList | null) => {
    setImportError(null);
    if (!files || files.length === 0) return;
    for (const file of Array.from(files)) {
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        const result = validateTheme(parsed);
        if (!result.ok) {
          setImportError(`${file.name}: ${result.error}`);
          return;
        }
        await saveCustomTheme(result.theme);
        setThemeId(result.theme.id);
      } catch (e) {
        setImportError(
          `${file.name}: ${
            e instanceof Error ? e.message : themeMessages.theme.failedToRead
          }`,
        );
        return;
      }
    }
  };

  const onPickThemeFile = () => fileInputRef.current?.click();

  const onRemoveCustomTheme = async (id: string) => {
    if (themeId === id) setThemeId(DEFAULT_THEME_ID);
    await deleteCustomTheme(id);
  };

  const confirmDelete = () => {
    if (themeToDelete) {
      void onRemoveCustomTheme(themeToDelete.id);
      setThemeToDelete(null);
    }
  };

  const renderCard = (t: Theme) => {
    const variant = t.variants[resolvedMode] ?? t.variants.dark ?? t.variants.light;
    const c = variant?.colors;
    const term = variant?.terminal;
    const swatchBg = c?.background ?? "var(--background)";
    const swatchFg = c?.foreground ?? "var(--foreground)";
    const swatchAccent = c?.primary ?? "var(--primary)";
    const ansi = term?.ansi;
    const dots = ansi
      ? [ansi[1], ansi[2], ansi[4]]
      : ["var(--destructive)", swatchAccent, "#3ecf8e"];
    const selected = themeId === t.id;
    const isCustom = customIds.has(t.id);
    return (
      <div
        key={t.id}
        className={cn(
          "group/theme relative flex flex-col rounded-lg border p-1.5 transition-[border-color,box-shadow] duration-[var(--dur-fast)] ease-[var(--ease-soft)] focus-within:ring-1 focus-within:ring-foreground/20",
          selected
            ? "border-foreground/60 ring-1 ring-foreground/20"
            : "border-border/60 hover:border-border",
        )}
      >
        <button
          type="button"
          aria-pressed={selected}
          onClick={() => setThemeId(t.id)}
          className="flex min-w-0 flex-1 flex-col gap-1.5 rounded-md text-left focus-visible:outline-none"
        >
          <div
            className="relative h-16 w-full overflow-hidden rounded-md border border-border/30"
            style={{ background: swatchBg }}
          >
            <div className="flex items-center gap-1 px-2 pt-2">
              {dots.map((dot, i) => (
                <span
                  key={["red", "green", "blue"][i]}
                  className="size-1.5 rounded-full"
                  style={{ background: dot }}
                />
              ))}
            </div>
            <div className="flex flex-col gap-1 px-2 pt-1.5">
              <span
                className="h-1 w-3/5 rounded-full"
                style={{ background: swatchFg, opacity: 0.75 }}
              />
              <span
                className="h-1 w-2/5 rounded-full"
                style={{ background: swatchFg, opacity: 0.45 }}
              />
            </div>
            <span
              className="absolute bottom-2 left-2 h-2.5 w-1 rounded-[2px]"
              style={{ background: swatchAccent }}
            />
          </div>
          <div className="flex min-w-0 items-center justify-between gap-1 px-1 pb-0.5">
            <span className="min-w-0 truncate text-[12px] font-medium">
              {t.name}
            </span>
            {selected ? (
              <span className="kite-theme-check flex size-4 shrink-0 items-center justify-center rounded-full bg-foreground text-background">
                <HugeiconsIcon icon={Tick02Icon} size={9} strokeWidth={3} />
              </span>
            ) : null}
          </div>
        </button>
        {isCustom ? (
          <button
            type="button"
            aria-label={themeMessages.theme.removeTheme(t.name)}
            className="absolute right-1.5 top-1.5 inline-flex size-6 items-center justify-center rounded-md bg-background/60 text-muted-foreground opacity-0 backdrop-blur-sm transition-opacity duration-[var(--dur-fast)] hover:text-destructive focus-visible:opacity-100 focus-visible:outline-none group-hover/theme:opacity-100"
            onClick={() => setThemeToDelete({ id: t.id, name: t.name })}
          >
            <HugeiconsIcon icon={Cancel01Icon} size={13} strokeWidth={1.5} />
          </button>
        ) : null}
      </div>
    );
  };

  return (
    <section
      aria-label={themeMessages.theme.title}
      className="flex flex-col gap-4"
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      }}
      onDrop={(e) => {
        e.preventDefault();
        void handleThemeFiles(e.dataTransfer.files);
      }}
    >
      <div className="flex flex-col">
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <SectionHeader title={themeMessages.title} />
            <span className="text-[11px] text-muted-foreground/60">
              {visibleThemes.length}
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-[11px]"
            onClick={onPickThemeFile}
          >
            {themeMessages.theme.importTheme}
          </Button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".kite-theme,.terax-theme,.json,application/json"
          className="hidden"
          onChange={(e) => {
            void handleThemeFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <div
          className="kite-reveal data-[state=open]:mt-3"
          data-state={importError ? "open" : "closed"}
        >
          <div>
            <div
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/10 px-2.5 py-1.5 text-[11.5px] text-destructive"
            >
              {importError ?? ""}
            </div>
          </div>
        </div>
      </div>
      <div className="relative grid grid-cols-3 gap-2.5">
        {visibleThemes.map(renderCard)}
      </div>
      <AlertDialog
        open={!!themeToDelete}
        onOpenChange={(open) => !open && setThemeToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {themeMessages.theme.removeTheme(themeToDelete?.name ?? "")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {themeMessages.theme.removeThemeConfirm}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{themeMessages.theme.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>
              {themeMessages.theme.remove}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
