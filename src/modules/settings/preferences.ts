import { create } from "zustand";
import { coerceAppLanguage, type AppLanguage } from "@/modules/i18n/locale";
import {
  DEFAULT_PREFERENCES,
  loadPreferences,
  onPreferencesChange,
  type Preferences,
} from "./store";

type State = Preferences & {
  hydrated: boolean;
  /** Subscribe & hydrate. Idempotent — safe to call from multiple windows. */
  init: () => Promise<void>;
};

let initPromise: Promise<void> | null = null;

const FAST_BG_KIND_KEY = "terax-ui-bg-kind-shadow";
const FAST_BG_IMAGE_ID_KEY = "terax-ui-bg-image-shadow";
const FAST_LANGUAGE_KEY = "terax-ui-language-shadow";

function mirrorBgFastPath(
  kind: Preferences["backgroundKind"],
  imageId: Preferences["backgroundImageId"],
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(FAST_BG_KIND_KEY, kind);
    if (imageId) window.localStorage.setItem(FAST_BG_IMAGE_ID_KEY, imageId);
    else window.localStorage.removeItem(FAST_BG_IMAGE_ID_KEY);
  } catch {
    /* ignore */
  }
}

export function readBgFastPath(): {
  active: boolean;
  imageId: string | null;
} {
  if (typeof window === "undefined") return { active: false, imageId: null };
  try {
    const kind = window.localStorage.getItem(FAST_BG_KIND_KEY);
    const imageId = window.localStorage.getItem(FAST_BG_IMAGE_ID_KEY);
    return { active: kind === "image" && !!imageId, imageId };
  } catch {
    return { active: false, imageId: null };
  }
}

function mirrorLanguageFastPath(language: Preferences["appLanguage"]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(FAST_LANGUAGE_KEY, language);
  } catch {
    /* ignore */
  }
}

export function readLanguageFastPath(): AppLanguage {
  if (typeof window === "undefined") return DEFAULT_PREFERENCES.appLanguage;
  try {
    return coerceAppLanguage(window.localStorage.getItem(FAST_LANGUAGE_KEY));
  } catch {
    return DEFAULT_PREFERENCES.appLanguage;
  }
}

export const usePreferencesStore = create<State>((set) => ({
  ...DEFAULT_PREFERENCES,
  appLanguage: readLanguageFastPath(),
  hydrated: false,
  init: () => {
    if (initPromise) return initPromise;
    initPromise = (async () => {
      try {
        const prefs = await loadPreferences();
        set({ ...prefs, hydrated: true });
        mirrorBgFastPath(prefs.backgroundKind, prefs.backgroundImageId);
        mirrorLanguageFastPath(prefs.appLanguage);
        void onPreferencesChange((key, value) => {
          set({ [key]: value } as Partial<State>);
          if (key === "backgroundKind" || key === "backgroundImageId") {
            const s = usePreferencesStore.getState();
            mirrorBgFastPath(s.backgroundKind, s.backgroundImageId);
          }
          if (key === "appLanguage") {
            mirrorLanguageFastPath(coerceAppLanguage(value));
          }
        });
      } catch (e) {
        initPromise = null;
        throw e;
      }
    })();
    return initPromise;
  },
}));
