import { createContext, useContext } from "react";
import type { SettingsTab } from "@/modules/settings/openSettingsWindow";

type SettingsNavigationContextValue = {
  setActiveTab: (tab: SettingsTab) => void;
};

export const SettingsNavigationContext =
  createContext<SettingsNavigationContextValue | null>(null);

export function useSettingsNavigation(): SettingsNavigationContextValue {
  const ctx = useContext(SettingsNavigationContext);
  if (!ctx) {
    throw new Error(
      "useSettingsNavigation must be used within a SettingsNavigationContext provider",
    );
  }
  return ctx;
}
