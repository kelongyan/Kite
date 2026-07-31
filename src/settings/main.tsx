import "../styles/globals.css";

import { USE_CUSTOM_WINDOW_CONTROLS } from "@/lib/platform";
import { ThemeProvider } from "@/modules/theme";
import { getCurrentWindow } from "@tauri-apps/api/window";
import ReactDOM from "react-dom/client";
import { SettingsApp } from "./SettingsApp";

if (USE_CUSTOM_WINDOW_CONTROLS) {
  document.documentElement.dataset.chrome = "borderless";
}

ReactDOM.createRoot(
  document.getElementById("settings-root") as HTMLElement,
).render(
  <ThemeProvider>
    <SettingsApp />
  </ThemeProvider>,
);

const showWindow = () => {
  return getCurrentWindow().show();
};
setTimeout(() => {
  void showWindow().catch((error) => {
    console.error("settings show failed, retrying:", error);
    setTimeout(() => {
      void showWindow().catch((retryError) =>
        console.error("settings show retry failed:", retryError),
      );
    }, 450);
  });
}, 50);
