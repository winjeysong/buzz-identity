import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  Copy,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  Pencil,
  Plus,
  Radio,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import appIcon from "../src-tauri/icons/128x128.png";
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
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const invoke = window.__TAURI__?.core?.invoke;

function automaticName(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function formatCreated(timestamp) {
  return new Date(timestamp).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function summaryOf(identity) {
  return {
    id: identity.id,
    name: identity.name,
    createdAt: identity.createdAt,
  };
}

function KeyCard({ icon: Icon, label, value, copied, onCopy, privateKey = false }) {
  return (
    <section className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              "grid size-9 place-items-center rounded-xl",
              privateKey ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700",
            )}
          >
            <Icon className="size-[18px]" />
          </span>
          <div>
            <h2 className="text-sm font-semibold">{label}</h2>
            <p className="text-xs text-muted-foreground">
              {privateKey ? "请勿发送给任何人" : "可发送给 Buzz 管理员"}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={onCopy} aria-label={`复制${label}`}>
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? "已复制" : "复制"}
        </Button>
      </div>
      <code className="block select-text break-all rounded-xl bg-muted px-4 py-3 font-mono text-[13px] leading-6 text-foreground">
        {value}
      </code>
    </section>
  );
}

export default function App() {
  const [identities, setIdentities] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState(null);
  const [newName, setNewName] = useState("");
  const [renamingId, setRenamingId] = useState("");
  const [renameName, setRenameName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [copied, setCopied] = useState("");
  const [error, setError] = useState("");
  const [isBooting, setIsBooting] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const selectionRequest = useRef(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!invoke) {
        setError("请在 Artpal Buzz Identity 客户端中运行。");
        setIsBooting(false);
        return;
      }
      try {
        const values = await invoke("list_identities");
        if (cancelled) return;
        setIdentities(values);
        if (values.length > 0) await selectIdentity(values[0].id);
      } catch (reason) {
        if (!cancelled) setError(String(reason));
      } finally {
        if (!cancelled) setIsBooting(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function selectIdentity(id) {
    const request = ++selectionRequest.current;
    setSelectedId(id);
    setIsLoadingDetail(true);
    setError("");
    try {
      const value = await invoke("get_identity", { id });
      if (selectionRequest.current === request) setDetail(value);
    } catch (reason) {
      if (selectionRequest.current === request) setError(String(reason));
    } finally {
      if (selectionRequest.current === request) setIsLoadingDetail(false);
    }
  }

  function showCreate() {
    selectionRequest.current += 1;
    setSelectedId("");
    setDetail(null);
    setIsLoadingDetail(false);
    setError("");
  }

  async function createIdentity(event) {
    event.preventDefault();
    if (!invoke || isCreating) return;
    setIsCreating(true);
    setError("");
    try {
      const created = await invoke("generate_identity", {
        name: newName.trim() || automaticName(),
      });
      setIdentities((current) => [summaryOf(created), ...current]);
      setSelectedId(created.id);
      setDetail(created);
      setNewName("");
    } catch (reason) {
      setError(String(reason));
    } finally {
      setIsCreating(false);
    }
  }

  function startRename(identity) {
    setRenamingId(identity.id);
    setRenameName(identity.name);
  }

  async function saveRename(event, id) {
    event.preventDefault();
    const name = renameName.trim();
    if (!name) return;
    try {
      const renamed = await invoke("rename_identity", { id, name });
      setIdentities((current) =>
        current.map((identity) => (identity.id === id ? renamed : identity)),
      );
      setDetail((current) => (current?.id === id ? { ...current, name: renamed.name } : current));
      setRenamingId("");
      setError("");
    } catch (reason) {
      setError(String(reason));
    }
  }

  async function deleteIdentity() {
    if (!deleteTarget || isDeleting) return;
    setIsDeleting(true);
    try {
      await invoke("delete_identity", { id: deleteTarget.id });
      const remaining = identities.filter((identity) => identity.id !== deleteTarget.id);
      setIdentities(remaining);
      if (selectedId === deleteTarget.id) {
        showCreate();
        if (remaining.length > 0) await selectIdentity(remaining[0].id);
      }
      setDeleteTarget(null);
      setError("");
    } catch (reason) {
      setError(String(reason));
    } finally {
      setIsDeleting(false);
    }
  }

  async function copyKey(value, kind) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      window.setTimeout(() => setCopied((current) => (current === kind ? "" : current)), 1600);
    } catch {
      setError("复制失败，请手动选择密钥复制。");
    }
  }

  return (
    <div className="flex h-screen min-h-[560px] bg-background text-foreground">
      <aside className="flex w-[clamp(260px,28vw,320px)] shrink-0 flex-col border-r bg-sidebar">
        <header className="flex h-[76px] items-center gap-3 border-b px-5">
          <img src={appIcon} alt="" className="size-10 rounded-xl shadow-sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">Artpal Buzz Identity</p>
            <p className="text-xs text-muted-foreground">本地身份管理</p>
          </div>
          <Button size="icon" onClick={showCreate} aria-label="创建身份" title="创建身份">
            <Plus className="size-[18px]" />
          </Button>
        </header>

        <div className="flex items-center justify-between px-5 pb-2 pt-5">
          <span className="text-xs font-medium text-muted-foreground">身份记录</span>
          <span className="text-xs tabular-nums text-muted-foreground">{identities.length}</span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
          {identities.length === 0 && !isBooting ? (
            <p className="px-2 py-8 text-center text-xs leading-5 text-muted-foreground">
              尚未创建身份
            </p>
          ) : null}

          <div className="space-y-1">
            {identities.map((identity) => (
              <div
                key={identity.id}
                className={cn(
                  "group flex items-center rounded-xl p-1 transition-colors",
                  selectedId === identity.id ? "bg-sidebar-accent" : "hover:bg-muted/70",
                )}
              >
                {renamingId === identity.id ? (
                  <form
                    className="flex min-w-0 flex-1 items-center gap-1"
                    onSubmit={(event) => saveRename(event, identity.id)}
                  >
                    <Input
                      autoFocus
                      maxLength={80}
                      value={renameName}
                      onChange={(event) => setRenameName(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Escape") setRenamingId("");
                      }}
                      className="h-9 min-w-0 bg-white"
                      aria-label="身份名称"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-8"
                      type="submit"
                      aria-label="保存重命名"
                    >
                      <Check className="size-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-8"
                      onClick={() => setRenamingId("")}
                      aria-label="取消重命名"
                    >
                      <X className="size-4" />
                    </Button>
                  </form>
                ) : (
                  <>
                    <button
                      type="button"
                      className="min-w-0 flex-1 rounded-lg px-2 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => selectIdentity(identity.id)}
                    >
                      <span className="block truncate text-sm font-medium">{identity.name}</span>
                      <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                        {formatCreated(identity.createdAt)}
                      </span>
                    </button>
                    <div className="flex opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-8"
                        onClick={() => startRename(identity)}
                        aria-label={`重命名 ${identity.name}`}
                        title="重命名"
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-8 text-muted-foreground hover:text-destructive"
                        onClick={() => setDeleteTarget(identity)}
                        aria-label={`删除 ${identity.name}`}
                        title="删除"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        <footer className="flex items-center gap-2 border-t px-5 py-4 text-xs text-muted-foreground">
          <ShieldCheck className="size-4 text-emerald-600" />
          密钥仅保存在当前设备
        </footer>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto">
        {error ? (
          <div className="sticky top-0 z-20 flex items-center gap-2 border-b border-red-200 bg-red-50 px-6 py-3 text-sm text-red-700">
            <AlertCircle className="size-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate">{error}</span>
            <button type="button" onClick={() => setError("")} aria-label="关闭错误提示">
              <X className="size-4" />
            </button>
          </div>
        ) : null}

        {isBooting || isLoadingDetail ? (
          <div className="grid h-full place-items-center text-muted-foreground">
            <LoaderCircle className="size-6 animate-spin" />
          </div>
        ) : detail ? (
          <div className="mx-auto w-full max-w-[920px] px-[clamp(28px,5vw,72px)] py-[clamp(32px,5vh,56px)]">
            <div className="mb-8 flex items-start justify-between gap-6">
              <div className="min-w-0">
                <p className="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-emerald-700">
                  身份密钥
                </p>
                <h1 className="truncate text-[clamp(1.75rem,3vw,2.25rem)] font-semibold tracking-tight">
                  {detail.name}
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  创建于 {formatCreated(detail.createdAt)}
                </p>
              </div>
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-emerald-100 text-emerald-700">
                <KeyRound className="size-5" />
              </span>
            </div>

            <div className="space-y-4">
              <KeyCard
                icon={Radio}
                label="公钥"
                value={detail.publicKey}
                copied={copied === "public"}
                onCopy={() => copyKey(detail.publicKey, "public")}
              />
              <KeyCard
                icon={LockKeyhole}
                label="私钥"
                value={detail.privateKey}
                copied={copied === "private"}
                onCopy={() => copyKey(detail.privateKey, "private")}
                privateKey
              />
            </div>

            <p className="mt-5 flex items-start gap-2 text-xs leading-5 text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" />
              只需把公钥交给管理员。私钥代表你的身份，泄露后应立即删除并重新生成。
            </p>
          </div>
        ) : (
          <div className="grid h-full min-h-[520px] place-items-center px-8">
            <section className="w-full max-w-[420px] text-center">
              <img src={appIcon} alt="" className="mx-auto size-20 rounded-[22px] shadow-sm" />
              <h1 className="mt-6 text-2xl font-semibold tracking-tight">创建 Buzz 身份</h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                密钥将在本机安全生成并自动保存。
              </p>
              <form className="mt-7 space-y-3 text-left" onSubmit={createIdentity}>
                <Input
                  maxLength={80}
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                  placeholder="身份名称（可选）"
                  aria-label="身份名称"
                />
                <Button className="w-full" type="submit" disabled={!invoke || isCreating}>
                  {isCreating ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : (
                    <Plus className="size-4" />
                  )}
                  {isCreating ? "正在生成" : "生成新身份"}
                </Button>
              </form>
              <p className="mt-3 text-xs text-muted-foreground">
                留空时使用当前时间作为记录名称
              </p>
            </section>
          </div>
        )}
      </main>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除这个身份？</AlertDialogTitle>
            <AlertDialogDescription>
              “{deleteTarget?.name}”的公钥和私钥将从当前设备永久删除，此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button variant="outline">取消</Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button variant="destructive" onClick={deleteIdentity} disabled={isDeleting}>
                {isDeleting ? <LoaderCircle className="size-4 animate-spin" /> : null}
                删除身份
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
