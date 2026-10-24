import { Button } from "@/components/ui/button";
import { useMessages } from "@/modules/i18n";
import { GithubIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { getName, getVersion } from "@tauri-apps/api/app";
import { openUrl } from "@tauri-apps/plugin-opener";
import { arch, platform } from "@tauri-apps/plugin-os";
import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import { SectionHeader } from "../components/SectionHeader";

const REPO_URL = "https://github.com/kelongyan/Kite";

type UpdateState =
  | { phase: "idle" }
  | { phase: "checking" }
  | { phase: "upToDate" }
  | { phase: "available"; latest: string; releasesPage: string }
  | { phase: "failed" };

const PLATFORM_LABEL: Record<string, string> = {
  macos: "macOS",
  windows: "Windows",
  linux: "Linux",
  ios: "iOS",
  android: "Android",
  freebsd: "FreeBSD",
};

export function AboutSection() {
  const messages = useMessages();
  const aboutMessages = messages.settings.about;
  const [version, setVersion] = useState("");
  const [name, setName] = useState("Kite");
  const [build, setBuild] = useState("");
  const [update, setUpdate] = useState<UpdateState>({ phase: "idle" });

  useEffect(() => {
    void getVersion().then(setVersion);
    void getName().then(setName);
    try {
      const p = platform();
      const a = arch();
      const platformLabel = PLATFORM_LABEL[p] ?? p;
      setBuild(`${platformLabel} · ${a}`);
    } catch {
      setBuild("");
    }
  }, []);

  const checkForUpdate = async () => {
    setUpdate({ phase: "checking" });
    try {
      const result = await invoke<{
        latest: string | null;
        releases_page: string;
      }>("check_for_update");
      setUpdate(
        result.latest
          ? {
              phase: "available",
              latest: result.latest,
              releasesPage: result.releases_page,
            }
          : { phase: "upToDate" },
      );
    } catch {
      setUpdate({ phase: "failed" });
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <SectionHeader title={aboutMessages.title} />

      <div className="flex items-center gap-4 rounded-xl border border-border/60 bg-card/60 p-4">
        <img src="/logo.png" alt="" className="size-12" draggable={false} />
        <div className="flex min-w-0 flex-col">
          <span className="text-[15px] font-semibold tracking-tight">
            {name}
          </span>
          <span className="mt-1 font-mono text-[11px] text-muted-foreground select-text">
            v{version || "—"}
          </span>
        </div>
      </div>

      <dl className="grid grid-cols-[110px_1fr] gap-y-2.5 text-[12px]">
        <dt className="text-muted-foreground">{aboutMessages.build}</dt>
        <dd className="font-mono text-[11.5px] select-text">
          {build || "—"}
        </dd>

        <dt className="text-muted-foreground">{aboutMessages.bundleId}</dt>
        <dd className="font-mono text-[11.5px] select-text">app.kelongyan.kite</dd>

        <dt className="text-muted-foreground">{aboutMessages.license}</dt>
        <dd>Apache 2.0</dd>

        <dt className="text-muted-foreground">{aboutMessages.sourceCode}</dt>
        <dd>
          <button
            type="button"
            onClick={() => void openUrl(REPO_URL)}
            className="inline-flex items-center gap-1.5 rounded-md text-[12px] underline-offset-2 hover:text-foreground hover:underline"
          >
            <HugeiconsIcon icon={GithubIcon} size={12} strokeWidth={1.75} />
            github.com/kelongyan/Kite
          </button>
        </dd>
      </dl>

      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => void openUrl(REPO_URL)}
          className="gap-1.5"
        >
          <HugeiconsIcon icon={GithubIcon} size={12} strokeWidth={1.75} />
          {aboutMessages.actions.viewOnGitHub}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void openUrl(`${REPO_URL}/issues/new`)}
        >
          {aboutMessages.actions.reportIssue}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={update.phase === "checking"}
          onClick={() => void checkForUpdate()}
        >
          {update.phase === "checking"
            ? aboutMessages.update.checking
            : aboutMessages.update.check}
        </Button>
        <div
          className="kite-reveal flex items-center gap-2"
          data-state={
            update.phase === "upToDate" ||
            update.phase === "available" ||
            update.phase === "failed"
              ? "open"
              : "closed"
          }
        >
          <div>
            {update.phase === "upToDate" ? (
              <span className="text-[12px] text-muted-foreground">
                {aboutMessages.update.upToDate}
              </span>
            ) : update.phase === "available" ? (
              <span className="flex items-center gap-2 text-[12px]">
                <span className="text-foreground">
                  {aboutMessages.update.available(update.latest)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void openUrl(update.releasesPage)}
                >
                  {aboutMessages.update.goToDownload}
                </Button>
              </span>
            ) : update.phase === "failed" ? (
              <span className="text-[12px] text-destructive">
                {aboutMessages.update.failed}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
