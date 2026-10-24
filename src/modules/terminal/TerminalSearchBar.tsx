import { useMessages } from "@/modules/i18n";
import {
  clearLeafSearch,
  focusSlot,
  onLeafSearchResults,
  searchLeaf,
} from "@/modules/terminal/lib/rendererPool";
import { useTerminalSearchStore } from "@/modules/terminal/lib/terminalSearchStore";
import { buildSearchDecorationColors } from "@/modules/terminal/lib/searchColors";
import { readTerminalTokens } from "@/styles/tokens";
import {
  ArrowDown01Icon,
  ArrowUp01Icon,
  Cancel01Icon,
  CaseSensitiveIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useCallback, useEffect, useRef } from "react";

const SEARCH_DEBOUNCE_MS = 120;

/**
 * In-buffer search bar for one pane. Rendered by the focused pane only; the
 * query lives in the global search store so it survives pane switches, while
 * highlights are cleared and re-run per pane (each pane owns its xterm addon).
 */
export function TerminalSearchBar({ leafId }: { leafId: number }) {
  const messages = useMessages();
  const t = messages.mainShell.terminalSearch;
  const query = useTerminalSearchStore((s) => s.query);
  const caseSensitive = useTerminalSearchStore((s) => s.caseSensitive);
  const resultIndex = useTerminalSearchStore((s) => s.resultIndex);
  const resultCount = useTerminalSearchStore((s) => s.resultCount);
  const setQuery = useTerminalSearchStore((s) => s.setQuery);
  const setCaseSensitive = useTerminalSearchStore((s) => s.setCaseSensitive);
  const setResults = useTerminalSearchStore((s) => s.setResults);
  const closeSearch = useTerminalSearchStore((s) => s.closeSearch);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    input.select();
  }, []);

  useEffect(
    () =>
      onLeafSearchResults((eventLeafId, event) => {
        if (eventLeafId !== leafId) return;
        setResults(event.resultIndex, event.resultCount);
      }),
    [leafId, setResults],
  );

  const runSearch = useCallback(
    (direction: 1 | -1, incremental: boolean) => {
      if (!query) {
        clearLeafSearch(leafId);
        setResults(0, 0);
        return;
      }
      const tokens = readTerminalTokens();
      const decorations = buildSearchDecorationColors(
        tokens.selection,
        tokens.background,
      );
      searchLeaf(leafId, query, {
        direction,
        caseSensitive,
        incremental,
        decorations: decorations ?? undefined,
      });
    },
    [leafId, query, caseSensitive, setResults],
  );

  // Debounced incremental search so typing extends the active match instead
  // of jumping between matches on every keystroke. runSearch changes identity
  // only when the searched inputs change, so result updates never re-arm it.
  useEffect(() => {
    if (!query) return;
    const timer = window.setTimeout(() => {
      runSearch(1, true);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query, runSearch]);

  // Leaving the pane (or closing the bar) drops this pane's highlights.
  useEffect(() => {
    return () => {
      clearLeafSearch(leafId);
    };
  }, [leafId]);

  const close = () => {
    closeSearch();
    focusSlot(leafId);
  };

  return (
    <div
      data-kite-terminal-search
      data-state="open"
      data-side="bottom"
      className="kite-popover-motion absolute end-2 top-2 z-10 flex items-center gap-1 rounded-lg border border-border/70 bg-popover p-1 ps-2 shadow-lg"
    >
      <input
        ref={inputRef}
        value={query}
        placeholder={t.placeholder}
        spellCheck={false}
        aria-label={t.placeholder}
        className="h-6 w-40 bg-transparent text-[12px] text-foreground outline-none placeholder:text-muted-foreground"
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            close();
            return;
          }
          if (e.key === "Enter") {
            e.preventDefault();
            runSearch(e.shiftKey ? -1 : 1, false);
          }
        }}
      />
      {query && (
        <span className="min-w-10 text-center text-[11px] tabular-nums text-muted-foreground">
          {resultCount === 0
            ? t.noMatch
            : resultIndex === -1
              ? t.matchesOverLimit(resultCount)
              : t.matches(resultIndex + 1, resultCount)}
        </span>
      )}
      <SearchBarButton
        label={t.caseSensitive}
        active={caseSensitive}
        onClick={() => setCaseSensitive(!caseSensitive)}
      >
        <HugeiconsIcon icon={CaseSensitiveIcon} size={13} strokeWidth={1.75} />
      </SearchBarButton>
      <SearchBarButton label={t.previous} onClick={() => runSearch(-1, false)}>
        <HugeiconsIcon icon={ArrowUp01Icon} size={13} strokeWidth={1.75} />
      </SearchBarButton>
      <SearchBarButton label={t.next} onClick={() => runSearch(1, false)}>
        <HugeiconsIcon icon={ArrowDown01Icon} size={13} strokeWidth={1.75} />
      </SearchBarButton>
      <SearchBarButton label={t.close} onClick={close}>
        <HugeiconsIcon icon={Cancel01Icon} size={13} strokeWidth={1.75} />
      </SearchBarButton>
    </div>
  );
}

function SearchBarButton({
  label,
  active = false,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active || undefined}
      onClick={onClick}
      className={
        active
          ? "grid size-6 place-items-center rounded-md bg-accent text-accent-foreground transition-[color,background-color] duration-[var(--dur-instant)] ease-[var(--ease-soft)]"
          : "grid size-6 place-items-center rounded-md text-muted-foreground transition-[color,background-color] duration-[var(--dur-instant)] ease-[var(--ease-soft)] hover:bg-accent hover:text-foreground"
      }
    >
      {children}
    </button>
  );
}
