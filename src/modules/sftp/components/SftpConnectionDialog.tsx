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
import { parseSshCommand } from "@/modules/sftp/lib/sshCommand";
import type {
  SftpAuthMethod,
  SftpConnectResult,
  SftpProfile,
  SftpProfileTemplate,
  SftpProfileSaveRequest,
} from "@/modules/sftp/lib/types";
import { useEffect, useState } from "react";

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
  const [selectedProfileId, setSelectedProfileId] = useState("new");
  const [selectedTemplateId, setSelectedTemplateId] = useState("none");
  const [sshConfigTemplates, setSshConfigTemplates] = useState<
    SftpProfileTemplate[]
  >([]);
  const [sshCommand, setSshCommand] = useState("");
  const [name, setName] = useState("Production");
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

  useEffect(() => {
    if (!open) return;
    void sftpApi
      .profiles()
      .then(onProfilesChange)
      .catch(() => {});
    void sftpApi
      .sshConfigTemplates()
      .then(setSshConfigTemplates)
      .catch(() => setSshConfigTemplates([]));
  }, [open, onProfilesChange]);

  const applyTemplate = (template: SftpProfileTemplate) => {
    setSelectedProfileId("new");
    setPendingHostKey(null);
    setError(null);
    setName(template.name);
    setHost(template.host);
    setPort(template.port);
    setUsername(template.username);
    setAuthMethod(template.authMethod);
    setPrivateKeyPath(template.privateKeyPath ?? "");
    setRemotePath(template.defaultRemotePath);
    setTrustedHostKey(null);
  };

  const fillProfile = (id: string) => {
    setSelectedProfileId(id);
    setSelectedTemplateId("none");
    setPendingHostKey(null);
    setError(null);
    if (id === "new") return;
    const profile = profiles.find((item) => item.id === id);
    if (!profile) return;
    setName(profile.name);
    setHost(profile.host);
    setPort(profile.port);
    setUsername(profile.username);
    setAuthMethod(profile.authMethod);
    setPrivateKeyPath(profile.privateKeyPath ?? "");
    setRemotePath(profile.defaultRemotePath);
    setTrustedHostKey(profile.trustedHostKey ?? null);
  };

  const fillTemplate = (id: string) => {
    setSelectedTemplateId(id);
    const index = Number(id.replace(/^template-/, ""));
    const template = sshConfigTemplates[index];
    if (template) applyTemplate(template);
  };

  const applySshCommand = () => {
    const parsed = parseSshCommand(sshCommand);
    if (!parsed) {
      setError(messages.sshCommandInvalid);
      return;
    }
    setSelectedTemplateId("none");
    applyTemplate(parsed);
  };

  const saveAndConnect = async (acceptHostKey = false) => {
    setBusy(true);
    setError(null);
    try {
      const input: SftpProfileSaveRequest = {
        id: selectedProfileId === "new" ? null : selectedProfileId,
        name,
        host,
        port,
        username,
        authMethod,
        privateKeyPath: privateKeyPath || null,
        defaultRemotePath: remotePath,
        trustedHostKey,
        password: password || null,
        passphrase: passphrase || null,
      };
      const saved = await sftpApi.saveProfile(input);
      const nextProfiles = await sftpApi.profiles();
      onProfilesChange(nextProfiles);
      setSelectedProfileId(saved.id);
      const result = await sftpApi.connect(saved.id, acceptHostKey);
      if (result.status === "hostKeyRequired") {
        setPendingHostKey(result);
        return;
      }
      onConnected(result);
      setPassword("");
      setPassphrase("");
      onOpenChange(false);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl rounded-xl">
        <DialogHeader>
          <DialogTitle>{messages.connectionTitle}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>{messages.profile}</Label>
              <Select value={selectedProfileId} onValueChange={fillProfile}>
                <SelectTrigger className="w-full rounded-md">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">{messages.newProfile}</SelectItem>
                  {profiles.map((profile) => (
                    <SelectItem key={profile.id} value={profile.id}>
                      {profile.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>{messages.sshConfigTemplate}</Label>
              <Select value={selectedTemplateId} onValueChange={fillTemplate}>
                <SelectTrigger className="w-full rounded-md">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    {messages.noSshConfigTemplates}
                  </SelectItem>
                  {sshConfigTemplates.map((template, index) => (
                    <SelectItem
                      key={`${template.name}-${template.host}-${index}`}
                      value={`template-${index}`}
                    >
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-[1fr_auto] items-end gap-2">
            <Field
              label={messages.sshCommand}
              value={sshCommand}
              onChange={setSshCommand}
              placeholder={messages.sshCommandPlaceholder}
            />
            <Button
              type="button"
              variant="secondary"
              onClick={applySshCommand}
            >
              {messages.applySshCommand}
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label={messages.name} value={name} onChange={setName} />
            <Field label={messages.host} value={host} onChange={setHost} />
            <Field
              label={messages.port}
              value={String(port)}
              onChange={(value) => setPort(Number(value) || 22)}
            />
            <Field
              label={messages.username}
              value={username}
              onChange={setUsername}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>{messages.auth}</Label>
              <Select
                value={authMethod}
                onValueChange={(value) =>
                  setAuthMethod(value as SftpAuthMethod)
                }
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
            <Field
              label={messages.remotePath}
              value={remotePath}
              onChange={setRemotePath}
            />
          </div>

          {authMethod === "password" ? (
            <Field
              label={messages.password}
              value={password}
              onChange={setPassword}
              type="password"
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
              />
            </div>
          )}

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
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {messages.cancel}
          </Button>
          {pendingHostKey ? (
            <Button disabled={busy} onClick={() => void saveAndConnect(true)}>
              {messages.trustAndConnect}
            </Button>
          ) : (
            <Button disabled={busy} onClick={() => void saveAndConnect(false)}>
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
