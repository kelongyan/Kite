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
import { useTheme } from "@/modules/theme";
import {
  deleteCustomTheme,
  saveCustomTheme,
} from "@/modules/theme/customThemes";
import { listBuiltinThemes } from "@/modules/theme/themes";
import { validateTheme } from "@/modules/theme/validateTheme";
import { DEFAULT_THEME_ID } from "@/modules/theme/types";
import { Cancel01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useMemo, useRef, useState } from "react";
import { SectionHeader } from "../components/SectionHeader";

export function ThemesSection() {
  const messages = useMessages();
  const themeMessages = messages.settings.themes;
  const { themeId, setThemeId, resolvedMode, customThemes } = useTheme();
  const builtinThemes = listBuiltinThemes();
  const themes = useMemo(
    () => [...builtinThemes, ...customThemes],
    [builtinThemes, customThemes],
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

  return (
    <section
      aria-label={themeMessages.theme.title}
      className="flex flex-col gap-5"
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      }}
      onDrop={(e) => {
        e.preventDefault();
        void handleThemeFiles(e.dataTransfer.files);
      }}
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <SectionHeader
            title={themeMessages.title}
            description={themeMessages.description}
          />
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
          className="kite-reveal"
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
      <div className="grid grid-cols-2 gap-2">
        {themes.map((t) => {
          const v =
            t.variants[resolvedMode] ?? t.variants.dark ?? t.variants.light;
          const c = v?.colors;
          const swatchBg = c?.background ?? "var(--background)";
          const swatchFg = c?.foreground ?? "var(--foreground)";
          const swatchAccent = c?.primary ?? c?.accent ?? "var(--accent)";
          const swatchMuted = c?.muted ?? "var(--muted)";
          const selected = themeId === t.id;
          const isCustom = customIds.has(t.id);
          return (
            <div
              key={t.id}
              className={cn(
                "group/theme flex items-center gap-2.5 rounded-lg border p-2 text-left transition-[border-color,box-shadow,background-color] duration-[var(--dur-fast)] ease-[var(--ease-soft)] focus-within:ring-1 focus-within:ring-foreground/20",
                selected
                  ? "border-foreground/60 ring-1 ring-foreground/20"
                  : "border-border/60 hover:border-border",
              )}
            >
              <button
                type="button"
                aria-pressed={selected}
                onClick={() => setThemeId(t.id)}
                className="flex min-w-0 flex-1 items-center gap-3 rounded-md text-left focus-visible:outline-none"
              >
                <div
                  className="flex h-9 w-12 shrink-0 flex-col justify-center gap-1 rounded-md border border-border/40 px-1.5"
                  style={{ background: swatchBg }}
                >
                  <div className="flex items-center gap-1">
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: swatchAccent }}
                    />
                    <span
                      className="h-1 w-7 rounded-full"
                      style={{ background: swatchFg, opacity: 0.85 }}
                    />
                  </div>
                  <span
                    className="h-1 w-9 rounded-full"
                    style={{ background: swatchMuted }}
                  />
                  <span
                    className="h-1 w-6 rounded-full"
                    style={{ background: swatchFg, opacity: 0.55 }}
                  />
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[12px] font-medium">
                    {t.name}
                  </span>
                  {t.description ? (
                    <span className="line-clamp-2 text-[11px] leading-snug text-muted-foreground">
                      {t.description}
                    </span>
                  ) : null}
                </div>
              </button>
              {selected ? (
                <span className="kite-theme-check flex size-4.5 shrink-0 items-center justify-center rounded-full bg-foreground text-background">
                  <HugeiconsIcon
                    icon={Tick02Icon}
                    size={10}
                    strokeWidth={3}
                  />
                </span>
              ) : null}
              {isCustom ? (
                <span className="ml-1 flex shrink-0 items-center gap-0.5">
                  <button
                    type="button"
                    aria-label={themeMessages.theme.removeTheme(t.name)}
                    className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                    onClick={() => setThemeToDelete({ id: t.id, name: t.name })}
                  >
                    <HugeiconsIcon
                      icon={Cancel01Icon}
                      size={14}
                      strokeWidth={1.5}
                    />
                  </button>
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-muted-foreground">
        {themeMessages.theme.dragHint}
      </p>

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
