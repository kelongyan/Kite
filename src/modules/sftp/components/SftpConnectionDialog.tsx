import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMessages } from "@/modules/i18n";
import { sftpApi } from "@/modules/sftp/lib/api";
import type {
  SftpAuthMethod,
  SftpConnectResult,
  SftpProfile,
  SftpProfileSaveRequest,
} from "@/modules/sftp/lib/types";
import { useEffect, useRef, useState } from "react";

type Phase =
  | "form"       // filling in connection details
  | "savePrompt"; // connected — ask whether to save

type Props = {
  open: boolean;
  profiles: SftpProfile[];
  onOpenChange: (open: boolean) => void;
  onProfilesChange: (profiles: SftpProfile[]) => void;
  onConnected: (
    result: Extract<SftpConnectResult, { status: "connected" }>,
  ) => void;
};

export function SftpConnectionDialog({
  open,
  profiles,
  onOpenChange,
  onProfilesChange,
  onConnected,
}: Props) {
  const messages = useMessages().workspace.sftp;

  // ── form state ────────────────────────────────────────────────
  const [selectedProfileId, setSelectedProfileId] = useState("new");
  const [host, setHost] = useState("");
  const [port, setPort] = useState(22);
  const [username, setUsername] = useState("");
  const [authMethod, setAuthMethod] = useState<SftpAuthMethod>("password");
  const [privateKeyPath, setPrivateKeyPath] = useState("");
  const [password, setPassword] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [remotePath, setRemotePath] = useState("/home");
  const [trustedHostKey, setTrustedHostKey] = useState<string | null>(null);
  const [pendingHostKey, setPendingHostKey] = useState<Extract<
    SftpConnectResult,
    { status: "hostKeyRequired" }
  > | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── save-prompt state (after successful new connection) ───────
  const [phase, setPhase] = useState<Phase>("form");
  const [connectedResult, setConnectedResult] = useState<Extract<
    SftpConnectResult,
    { status: "connected" }
  > | null>(null);
  const [tempProfileId, setTempProfileId] = useState<string | null>(null);
  const [saveName, setSaveName] = useState("");
  const saveNameRef = useRef<HTMLInputElement>(null);

  // Reload profiles whenever the dialog opens
  useEffect(() => {
    if (!open) return;
    void sftpApi
      .profiles()
      .then(onProfilesChange)
      .catch(() => {});
  }, [open, onProfilesChange]);

  // Focus save-name input when save prompt appears
  useEffect(() => {
    if (phase === "savePrompt") {
      setTimeout(() => saveNameRef.current?.focus(), 50);
    }
  }, [phase]);

  const resetForm = () => {
    setSelectedProfileId("new");
    setHost("");
    setPort(22);
    setUsername("");
    setAuthMethod("password");
    setPrivateKeyPath("");
    setPassword("");
    setPassphrase("");
    setRemotePath("/home");
    setTrustedHostKey(null);
    setPendingHostKey(null);
    setError(null);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setPhase("form");
      setConnectedResult(null);
      setTempProfileId(null);
      setSaveName("");
      resetForm();
    }
    onOpenChange(next);
  };

  // Fill the form from a saved profile
  const fillProfile = (id: string) => {
    setSelectedProfileId(id);
    setPendingHostKey(null);
    setError(null);
    if (id === "new") {
      resetForm();
      return;
    }
    const profile = profiles.find((item) => item.id === id);
    if (!profile) return;
    setHost(profile.host);
    setPort(profile.port);
    setUsername(profile.username);
    setAuthMethod(profile.authMethod);
    setPrivateKeyPath(profile.privateKeyPath ?? "");
    setRemotePath(profile.defaultRemotePath);
    setTrustedHostKey(profile.trustedHostKey ?? null);
    // Password is stored in keyring — leave field empty (placeholder shows "Saved")
    setPassword("");
    setPassphrase("");
  };

  // Auto-derive a sensible remote path when username changes
  const handleUsernameChange = (value: string) => {
    setUsername(value);
    // Only update remotePath if it still looks auto-generated
    const trimmed = value.trim();
    if (trimmed === "root") {
      setRemotePath("/root");
    } else if (trimmed) {
      setRemotePath(`/home/${trimmed}`);
    } else {
      setRemotePath("/home");
    }
  };

  const connectWithProfileId = async (profileId: string, acceptHostKey: boolean) => {
    const result = await sftpApi.connect(profileId, acceptHostKey);
    if (result.status === "hostKeyRequired") {
      setPendingHostKey(result);
      return null;
    }
    return result;
  };

  const connectAndMaybeSave = async (acceptHostKey = false) => {
    setBusy(true);
    setError(null);
    try {
      const isNewConnection = selectedProfileId === "new";

      const input: SftpProfileSaveRequest = {
        // For existing profiles use their id so we update in-place.
        // For new connections, pass null to generate a fresh id.
        id: isNewConnection ? null : selectedProfileId,
        // Use existing profile name or derive from host.
        name: (() => {
          if (!isNewConnection) {
            return profiles.find((p) => p.id === selectedProfileId)?.name ?? host;
          }
          return host;
        })(),
        host,
        port,
        username,
        authMethod,
        privateKeyPath: privateKeyPath || null,
        defaultRemotePath: remotePath,
        trustedHostKey,
        // Pass null password for existing profiles (keeps keyring entry intact).
        password: password || null,
        passphrase: passphrase || null,
      };

      const saved = await sftpApi.saveProfile(input);
      const nextProfiles = await sftpApi.profiles();
      onProfilesChange(nextProfiles);

      const result = await connectWithProfileId(saved.id, acceptHostKey);
      if (!result) return; // host key prompt shown — wait for user action

      // Success
      if (isNewConnection) {
        // New connection: ask whether to save before closing
        setTempProfileId(saved.id);
        setSaveName(host);
        setConnectedResult(result);
        setPhase("savePrompt");
      } else {
        // Reconnecting to existing saved profile — just close
        onConnected(result);
        setPassword("");
        setPassphrase("");
        onOpenChange(false);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleSaveAndClose = async () => {
    if (!connectedResult || !tempProfileId) return;
    setBusy(true);
    setError(null);
    try {
      // Update the profile with the user-chosen name
      const existing = profiles.find((p) => p.id === tempProfileId);
      if (existing) {
        await sftpApi.saveProfile({
          id: tempProfileId,
          name: saveName.trim() || host,
          host: existing.host,
          port: existing.port,
          username: existing.username,
          authMethod: existing.authMethod,
          privateKeyPath: existing.privateKeyPath ?? null,
          defaultRemotePath: existing.defaultRemotePath,
          trustedHostKey: existing.trustedHostKey ?? null,
          password: null,
          passphrase: null,
        });
        const nextProfiles = await sftpApi.profiles();
        onProfilesChange(nextProfiles);
      }
      onConnected(connectedResult);
      handleOpenChange(false);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleDontSave = async () => {
    if (!connectedResult) return;
    // Delete the temporary profile that was created to enable the connection
    if (tempProfileId) {
      void sftpApi.deleteProfile(tempProfileId).catch(() => {});
      const nextProfiles = await sftpApi.profiles().catch(() => profiles);
      onProfilesChange(nextProfiles);
    }
    onConnected(connectedResult);
    handleOpenChange(false);
  };

  // ── save prompt phase ─────────────────────────────────────────
  if (phase === "savePrompt") {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-sm rounded-xl">
          <DialogHeader>
            <DialogTitle>{messages.connectionTitle}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <p className="text-sm text-muted-foreground">
              {messages.saveServerPrompt}
            </p>
            <div className="grid gap-1.5">
              <Label>{messages.serverName}</Label>
              <Input
                ref={saveNameRef}
                value={saveName}
                onChange={(e) => setSaveName(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleSaveAndClose();
                }}
                className="rounded-md"
              />
            </div>
            {error ? (
              <div className="text-sm text-destructive">{error}</div>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => void handleDontSave()}
            >
              {messages.dontSave}
            </Button>
            <Button disabled={busy} onClick={() => void handleSaveAndClose()}>
              {messages.saveAndClose}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // ── connection form phase ─────────────────────────────────────
  const hasSavedPassword = selectedProfileId !== "new" && !password;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-xl rounded-xl">
        <DialogHeader>
          <DialogTitle>{messages.connectionTitle}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3">
          {/* Saved servers dropdown */}
          <div className="grid gap-1.5">
            <Label>{messages.savedServers}</Label>
            <Select value={selectedProfileId} onValueChange={fillProfile}>
              <SelectTrigger className="w-full rounded-md">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">{messages.newConnection}</SelectItem>
                {profiles.map((profile) => (
                  <SelectItem key={profile.id} value={profile.id}>
                    {profile.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Host + Port */}
          <div className="grid grid-cols-2 gap-3">
            <Field label={messages.host} value={host} onChange={setHost} />
            <Field
              label={messages.port}
              value={String(port)}
              onChange={(value) => setPort(Number(value) || 22)}
            />
          </div>

          {/* Username + Remote path */}
          <div className="grid grid-cols-2 gap-3">
            <Field
              label={messages.username}
              value={username}
              onChange={handleUsernameChange}
            />
            <Field
              label={messages.remotePath}
              value={remotePath}
              onChange={setRemotePath}
            />
          </div>

          {/* Auth method */}
          <div className="grid gap-1.5">
            <Label>{messages.auth}</Label>
            <Select
              value={authMethod}
              onValueChange={(value) => setAuthMethod(value as SftpAuthMethod)}
            >
              <SelectTrigger className="w-full rounded-md">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="password">{messages.password}</SelectItem>
                <SelectItem value="privateKey">
                  {messages.privateKey}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Credentials */}
          {authMethod === "password" ? (
            <Field
              label={messages.password}
              value={password}
              onChange={setPassword}
              type="password"
              placeholder={hasSavedPassword ? messages.savedPassword : undefined}
            />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Field
                label={messages.privateKeyPath}
                value={privateKeyPath}
                onChange={setPrivateKeyPath}
              />
              <Field
                label={messages.passphrase}
                value={passphrase}
                onChange={setPassphrase}
                type="password"
                placeholder={hasSavedPassword ? messages.savedPassword : undefined}
              />
            </div>
          )}

          {/* Host key trust banner */}
          {pendingHostKey ? (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
              <div className="font-medium">
                {pendingHostKey.changed
                  ? messages.hostKeyChanged
                  : messages.trustHostKey}
              </div>
              <div className="mt-1 break-all font-mono text-xs text-muted-foreground">
                {pendingHostKey.fingerprint}
              </div>
            </div>
          ) : null}

          {error ? (
            <div className="text-sm text-destructive">{error}</div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => handleOpenChange(false)}>
            {messages.cancel}
          </Button>
          {pendingHostKey ? (
            <Button
              disabled={busy}
              onClick={() => void connectAndMaybeSave(true)}
            >
              {messages.trustAndConnect}
            </Button>
          ) : (
            <Button
              disabled={busy}
              onClick={() => void connectAndMaybeSave(false)}
            >
              {messages.connect}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      <Input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.currentTarget.value)}
        className="rounded-md"
      />
    </div>
  );
}
