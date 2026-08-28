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

  return (
    <div className="flex flex-col gap-6">
      <SectionHeader
        title={themeMessages.title}
        description={themeMessages.description}
      />

      <section
        aria-labelledby="theme-files-label"
        className="flex flex-col gap-2"
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
        }}
        onDrop={(e) => {
          e.preventDefault();
          void handleThemeFiles(e.dataTransfer.files);
        }}
      >
        <div className="flex items-center justify-between">
          <div id="theme-files-label">
            <Label>{themeMessages.theme.title}</Label>
          </div>
          <div className="flex items-center gap-1.5">
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
        </div>
        {importError ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-2.5 py-1.5 text-[11.5px] text-destructive">
            {importError}
          </div>
        ) : null}
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
                  "group/theme flex items-center gap-3 rounded-lg border p-2.5 text-left transition-all focus-within:ring-1 focus-within:ring-foreground/20",
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
                    className="flex h-10 w-14 shrink-0 items-center justify-center gap-1 rounded-md border border-border/40"
                    style={{ background: swatchBg }}
                  >
                    <span
                      className="h-5 w-2 rounded-sm"
                      style={{ background: swatchAccent }}
                    />
                    <span
                      className="h-5 w-2 rounded-sm"
                      style={{ background: swatchFg, opacity: 0.7 }}
                    />
                    <span
                      className="h-5 w-2 rounded-sm"
                      style={{ background: swatchMuted }}
                    />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[12.5px] font-medium">
                      {t.name}
                    </span>
                    {t.description ? (
                      <span className="truncate text-[11px] text-muted-foreground">
                        {t.description}
                      </span>
                    ) : null}
                  </div>
                </button>
                {isCustom ? (
                  <span className="ml-1 flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover/theme:opacity-100 group-focus-within/theme:opacity-100">
                    <button
                      type="button"
                      aria-label={themeMessages.theme.removeTheme(t.name)}
                      className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                      onClick={() => void onRemoveCustomTheme(t.id)}
                    >
                      ×
                    </button>
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-medium tracking-tight text-muted-foreground">
      {children}
    </span>
  );
}
