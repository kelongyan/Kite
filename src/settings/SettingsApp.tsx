import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/sonner";
import { WindowControls } from "@/components/WindowControls";
import { IS_MAC, USE_CUSTOM_WINDOW_CONTROLS } from "@/lib/platform";
import { useMessages } from "@/modules/i18n";
import type { SettingsTab } from "@/modules/settings/openSettingsWindow";
import { usePreferencesStore } from "@/modules/settings/preferences";
import {
  InformationCircleIcon,
  PaintBoardIcon,
  Settings01Icon,
  KeyboardIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import {
  type JSX,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { AboutSection } from "./sections/AboutSection";
import { GeneralSection } from "./sections/GeneralSection";
import { ShortcutsSection } from "./sections/ShortcutsSection";
import { ThemesSection } from "./sections/ThemesSection";

const TABS: {
  id: SettingsTab;
  icon: typeof Settings01Icon;
  component: () => JSX.Element;
}[] = [
  { id: "general", icon: Settings01Icon, component: GeneralSection },
  { id: "themes", icon: PaintBoardIcon, component: ThemesSection },
  { id: "shortcuts", icon: KeyboardIcon, component: ShortcutsSection },
  { id: "about", icon: InformationCircleIcon, component: AboutSection },
];

const VALID_TABS: SettingsTab[] = [
  "general",
  "themes",
  "shortcuts",
  "about",
];

function readInitialTab(): SettingsTab {
  if (typeof window === "undefined") return "general";
  const url = new URL(window.location.href);
  const t = url.searchParams.get("tab");
  if (t && (VALID_TABS as string[]).includes(t)) return t as SettingsTab;
  return "general";
}

export function SettingsApp() {
  const messages = useMessages();
  const [active, setActive] = useState<SettingsTab>(readInitialTab);
  const init = usePreferencesStore((s) => s.init);
  const ActiveSection = TABS.find((t) => t.id === active)?.component;

  const mainRef = useRef<HTMLElement>(null);
  const tabsListRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState<{
    left: number;
    width: number;
  } | null>(null);
  const [indicatorReady, setIndicatorReady] = useState(false);

  const measureIndicator = useCallback(() => {
    const list = tabsListRef.current;
    const activeTrigger = list?.querySelector<HTMLElement>(
      '[data-state="active"]',
    );
    setIndicator(
      activeTrigger
        ? { left: activeTrigger.offsetLeft, width: activeTrigger.offsetWidth }
        : null,
    );
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-measure when the active section changes.
  useLayoutEffect(() => {
    measureIndicator();
  }, [measureIndicator, active]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset scroll when the active section changes.
  useLayoutEffect(() => {
    if (mainRef.current) mainRef.current.scrollTop = 0;
  }, [active]);

  useEffect(() => {
    const list = tabsListRef.current;
    if (!list) return;
    const ro = new ResizeObserver(measureIndicator);
    ro.observe(list);
    return () => ro.disconnect();
  }, [measureIndicator]);

  useEffect(() => {
    if (indicator && !indicatorReady) {
      const raf = requestAnimationFrame(() => setIndicatorReady(true));
      return () => cancelAnimationFrame(raf);
    }
  }, [indicator, indicatorReady]);

  useEffect(() => {
    // A failed hydration leaves the store on defaults, so every picker would
    // silently read the shipped value no matter what the user saved. Surface
    // the failure and retry once: the store IPC can transiently lose the
    // race while the main window is still booting.
    const attempt = (n: number): void => {
      init().catch((error) => {
        console.error("settings preferences hydration failed:", error);
        if (n === 0) window.setTimeout(() => attempt(1), 400);
      });
    };
    attempt(0);
  }, [init]);

  useEffect(() => {
    const apply = (detail: string) => {
      if ((VALID_TABS as string[]).includes(detail)) {
        setActive(detail as SettingsTab);
      }
    };
    const unlistenPromise = getCurrentWebviewWindow().listen<string>(
      "kite:settings-tab",
      (e) => apply(e.payload),
    );
    return () => {
      void unlistenPromise.then((un) => un());
    };
  }, []);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <header
        data-tauri-drag-region
        className={`flex h-11 shrink-0 items-center border-b border-border/60 bg-card/60 select-none ${
          IS_MAC ? "pr-2 pl-20" : "pr-0 pl-3"
        }`}
      >
        <Tabs
          value={active}
          onValueChange={(v) => setActive(v as SettingsTab)}
          orientation="horizontal"
          className="flex-1 items-center select-none"
          data-tauri-drag-region
        >
          <TabsList
            ref={tabsListRef}
            className="relative mx-auto gap-0.5 bg-muted/40 px-1 group-data-horizontal/tabs:h-8"
          >
            {indicator && (
              <span
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-0 h-6 rounded-full bg-background shadow-sm ring-1 ring-foreground/5"
                style={{
                  width: indicator.width,
                  transform: `translate(${indicator.left}px, -50%)`,
                  transitionProperty: indicatorReady
                    ? "transform, width"
                    : "none",
                  transitionDuration: "var(--dur-base)",
                  transitionTimingFunction: "var(--ease-premium)",
                }}
              />
            )}
            {TABS.map((t) => (
              <TabsTrigger
                key={t.id}
                value={t.id}
                className="h-6 gap-1.5 px-3 text-[11.5px] data-active:bg-transparent dark:data-active:bg-transparent"
              >
                <HugeiconsIcon
                  icon={t.icon}
                  className="size-3.5"
                  strokeWidth={1.75}
                />
                <span>{messages.settings.tabs[t.id]}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        {USE_CUSTOM_WINDOW_CONTROLS && <WindowControls closeOnly />}
      </header>

      <main
        ref={mainRef}
        className="min-h-0 flex-1 overflow-y-auto px-6 py-6 sm:px-7 [scrollbar-width:thin] [scrollbar-color:var(--border)_transparent]"
      >
        <div className="mx-auto w-full max-w-160">
          <div key={active} className="kite-settings-section">
            {ActiveSection && <ActiveSection />}
          </div>
        </div>
      </main>

      <Toaster position="bottom-right" />
    </div>
  );
}
