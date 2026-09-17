import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import {
  AlertCircle,
  Bot,
  Check,
  CircleCheck,
  CircleDot,
  Copy,
  Cpu,
  FolderOpen,
  GitBranch,
  LoaderCircle,
  Play,
  Plus,
  Pencil,
  Radio,
  RefreshCw,
  ScrollText,
  ShieldAlert,
  Square,
  Trash2,
  X,
} from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Save } from "lucide-react";

const invoke = window.__TAURI__?.core?.invoke;

const STATE_LABELS = {
  draft: { text: "草稿", tone: "bg-muted text-muted-foreground" },
  ready: { text: "就绪", tone: "bg-secondary text-secondary-foreground" },
  running: { text: "运行中", tone: "bg-primary/10 text-primary dark:text-sidebar-primary" },
  stopped: { text: "已停止", tone: "bg-muted text-muted-foreground" },
};

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

function emptyGitSource() {
  return { type: "git", label: "", repoPath: "", commit: "HEAD", include: [], exclude: [] };
}

function emptyFolderSource() {
  return { type: "folder", label: "", path: "", include: [] };
}

function SourceEditor({ source, onChange, onRemove, onBrowse }) {
  const pathKey = source.type === "git" ? "repoPath" : "path";
  const pathLabel = source.type === "git" ? "Git 仓库目录" : "本地目录";
  const pathButton = (
    <Button
      type="button"
      variant="outline"
      className="h-9 w-full min-w-0 justify-between px-3 font-normal"
      onClick={onBrowse}
      aria-label={`选择${pathLabel}`}
      title={source[pathKey] || `选择${pathLabel}`}
    >
      <span className={cn("min-w-0 flex-1 truncate text-left", !source[pathKey] && "text-muted-foreground")}>
        {source[pathKey] || `选择${pathLabel}`}
      </span>
      <FolderOpen className="size-4 shrink-0 text-muted-foreground" />
    </Button>
  );
  return (
    <div className="rounded-xl border bg-muted/30 p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="grid size-7 place-items-center rounded-lg bg-card text-muted-foreground shadow-sm">
          {source.type === "git" ? <GitBranch className="size-3.5" /> : <FolderOpen className="size-3.5" />}
        </span>
        <Input
          value={source.label}
          onChange={(event) => onChange({ ...source, label: event.target.value })}
          placeholder="来源名称（引用中显示）"
          className="h-8 flex-1 bg-card"
        />
        <Button type="button" size="icon" variant="ghost" className="size-8" onClick={onRemove} aria-label="移除来源">
          <X className="size-3.5" />
        </Button>
      </div>
      {source.type === "git" ? (
        <div className="grid grid-cols-[minmax(0,1fr)_150px] gap-2">
          {pathButton}
          <Input
            value={source.commit ?? ""}
            onChange={(event) => onChange({ ...source, commit: event.target.value })}
            placeholder="分支或 commit（默认 HEAD）"
            className="h-9"
          />
        </div>
      ) : (
        pathButton
      )}
    </div>
  );
}

export default function ForksPage() {
  const [forks, setForks] = useState([]);
  const [identities, setIdentities] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [logs, setLogs] = useState("");
  const [isBooting, setIsBooting] = useState(true);

  const [draft, setDraft] = useState(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    if (!invoke) {
      setError("请在 Artpal Buzz Identity 客户端中运行。");
      setIsBooting(false);
      return;
    }
    try {
      const [forkList, identityList] = await Promise.all([
        invoke("list_forks"),
        invoke("list_identities"),
      ]);
      setForks(forkList);
      setIdentities(identityList);
      setError("");
    } catch (reason) {
      setError(String(reason));
    } finally {
      setIsBooting(false);
    }
  }

  function startCreate() {
    setCreating(true);
    setEditingId("");
    setSelectedId("");
    setError("");
    setNotice("");
    setLogs("");
    setDraft({
      name: "",
      identityId: identities[0]?.id ?? "",
      domain: "",
      knowledgeSources: [emptyGitSource()],
      model: { provider: "deepseek", model: "deepseek-flash", baseUrl: "https://api.deepseek.com/v1" },
      buzz: { relayUrl: "https://buzz.artpalstudio.com", homeChannel: "" },
      modelKey: "",
    });
  }

  async function startEdit(fork) {
    if (!invoke || busy) return;
    setBusy("load-edit");
    setError("");
    setNotice("");
    setLogs("");
    try {
      const config = await invoke("get_fork", { id: fork.id });
      setDraft({
        name: config.name,
        identityId: config.identityId,
        domain: config.domain ?? "",
        knowledgeSources: config.knowledgeSources,
        model: config.model,
        buzz: config.buzz,
        modelKey: "",
        hasModelKey: fork.hasModelKey,
      });
      setEditingId(fork.id);
      setCreating(true);
    } catch (reason) {
      setError(String(reason));
    } finally {
      setBusy("");
    }
  }

  async function chooseSourceDirectory(index, type) {
    try {
      const path = await open({
        directory: true,
        multiple: false,
        title: type === "git" ? "选择 Git 仓库目录" : "选择本地目录",
      });
      if (typeof path !== "string") return;
      setDraft((current) => {
        if (!current?.knowledgeSources[index] || current.knowledgeSources[index].type !== type) return current;
        const knowledgeSources = [...current.knowledgeSources];
        knowledgeSources[index] = {
          ...knowledgeSources[index],
          [type === "git" ? "repoPath" : "path"]: path,
        };
        return { ...current, knowledgeSources };
      });
      setError("");
    } catch (reason) {
      setError(`无法选择目录：${String(reason)}`);
    }
  }

  async function submitFork(event) {
    event.preventDefault();
    if (!invoke || busy) return;
    const updating = Boolean(editingId);
    setBusy(updating ? "update" : "create");
    setError("");
    try {
      const payload = {
        ...draft,
        domain: draft.domain.trim() || null,
        knowledgeSources: draft.knowledgeSources
          .filter((source) => (source.type === "git" ? source.repoPath : source.path).trim())
          .map((source) => ({ ...source, label: source.label.trim() || source.repoPath || source.path })),
      };
      const saved = await invoke(updating ? "update_fork" : "create_fork", updating ? { id: editingId, draft: payload } : { draft: payload });
      setCreating(false);
      setEditingId("");
      setDraft(null);
      await load();
      setSelectedId(saved.id);
      setNotice(updating ? "配置与 Buzz Profile 已同步。更新知识来源后请重新构建。" : "分身已创建。下一步：构建知识快照。");
    } catch (reason) {
      setError(String(reason));
    } finally {
      setBusy("");
    }
  }

  async function runAction(key, action, message) {
    if (!invoke || busy) return;
    setBusy(key);
    setError("");
    setNotice("");
    try {
      const result = await action();
      await load();
      if (message) setNotice(typeof message === "function" ? message(result) : message);
    } catch (reason) {
      setError(String(reason));
    } finally {
      setBusy("");
    }
  }

  async function removeFork() {
    if (!deleteTarget) return;
    await runAction("delete", () => invoke("delete_fork", { id: deleteTarget.id }), "分身已删除。");
    setDeleteTarget(null);
    setSelectedId("");
    setLogs("");
  }

  const selected = forks.find((fork) => fork.id === selectedId) ?? null;

  return (
    <div className="flex h-full min-h-0">
      <aside className="flex w-[clamp(260px,28vw,320px)] shrink-0 flex-col border-r bg-sidebar">
        <header className="flex h-[76px] items-center gap-3 border-b px-5">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">我的分身</p>
            <p className="text-xs tabular-nums text-muted-foreground">{forks.length} 个分身</p>
          </div>
          <Button
            size="icon"
            onClick={startCreate}
            disabled={isBooting || identities.length === 0}
            aria-label="创建分身"
            title={identities.length === 0 ? "请先创建身份" : "创建分身"}
          >
            <Plus className="size-[18px]" />
          </Button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 pt-3">
          {forks.length === 0 && !isBooting ? (
            <p className="px-2 py-8 text-center text-xs leading-5 text-muted-foreground">
              尚未创建分身
              <br />
              {identities.length === 0 ? "请先在身份 Tab 创建身份" : "点击右上角 + 开始"}
            </p>
          ) : null}
          <div className="space-y-1">
            {forks.map((fork) => {
              const label = STATE_LABELS[fork.state] ?? STATE_LABELS.draft;
              return (
                <Button
                  key={fork.id}
                  variant="ghost"
                  onClick={() => {
                    setSelectedId(fork.id);
                    setCreating(false);
                    setEditingId("");
                    setLogs("");
                    setNotice("");
                    setError("");
                  }}
                  className={cn(
                    "block h-auto w-full rounded-xl px-3 py-2.5 text-left",
                    selectedId === fork.id ? "bg-sidebar-accent" : "hover:bg-muted/70",
                  )}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-sm font-medium">{fork.name}</span>
                    <Badge className={cn("shrink-0 border-0 px-2 text-[10px]", label.tone)}>
                      {label.text}
                    </Badge>
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                    {formatCreated(fork.createdAt)}
                    {fork.hasModelKey ? "" : " · 未设置模型 Key"}
                  </span>
                </Button>
              );
            })}
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {error ? (
          <div className="flex items-center gap-2 border-b border-destructive/30 bg-destructive/10 px-6 py-3 text-sm text-destructive">
            <AlertCircle className="size-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate">{error}</span>
            <Button variant="ghost" size="icon" className="size-6" onClick={() => setError("")} aria-label="关闭错误提示">
              <X className="size-4" />
            </Button>
          </div>
        ) : null}
        {notice ? (
          <div className="flex items-center gap-2 border-b border-primary/20 bg-primary/10 px-6 py-3 text-sm text-foreground">
            <span className="min-w-0 flex-1 truncate">{notice}</span>
            <Button variant="ghost" size="icon" className="size-6" onClick={() => setNotice("")} aria-label="关闭提示">
              <X className="size-4" />
            </Button>
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto">
          {isBooting ? (
            <div className="grid h-full place-items-center text-muted-foreground">
              <LoaderCircle className="size-6 animate-spin" />
            </div>
          ) : creating && draft ? (
            <form
              className="mx-auto w-full max-w-[920px] px-[clamp(28px,5vw,72px)] py-[clamp(32px,5vh,56px)]"
              onSubmit={submitFork}
            >
              <div className="mb-8 flex items-start justify-between gap-6">
                <div className="min-w-0">
                  <p className="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-primary dark:text-sidebar-primary">分身</p>
                  <h1 className="text-[clamp(1.75rem,3vw,2.25rem)] font-semibold tracking-tight">{editingId ? "编辑分身" : "创建分身"}</h1>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {editingId ? "更新身份、知识来源、模型与 Buzz 连接配置。" : "使用身份连接 Buzz，并从指定的 Git 仓库与本地目录获取知识。"}
                  </p>
                </div>
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary dark:text-sidebar-primary">
                  <Bot className="size-5" />
                </span>
              </div>

              <div className="space-y-4">
                <Card className="gap-0 rounded-2xl py-5">
                  <CardHeader className="mb-4 flex items-center gap-2.5 px-5">
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary dark:text-sidebar-primary">
                      <Bot className="size-[18px]" />
                    </span>
                    <div className="space-y-1">
                      <CardTitle className="text-sm">基本信息</CardTitle>
                      <CardDescription className="text-xs">为分身命名并选择它使用的身份</CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent className="px-5">
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      value={draft.name}
                      onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                      placeholder="分身名称（如：我的架构助手）"
                      maxLength={80}
                      aria-label="分身名称"
                    />
                    <Select
                      value={draft.identityId}
                      onValueChange={(identityId) => setDraft({ ...draft, identityId })}
                    >
                      <SelectTrigger className="w-full" aria-label="选择身份">
                        <SelectValue placeholder="选择身份…" />
                      </SelectTrigger>
                      <SelectContent>
                        {identities.map((identity) => (
                          <SelectItem key={identity.id} value={identity.id}>{identity.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Input
                    className="mt-3"
                    value={draft.domain}
                    onChange={(event) => setDraft({ ...draft, domain: event.target.value })}
                    placeholder="知识域描述（可选，如：Artpal 前端问题）"
                    aria-label="知识域描述"
                  />
                  </CardContent>
                </Card>

                <Card className="gap-0 rounded-2xl py-5">
                  <CardHeader className="mb-4 flex items-center gap-2.5 px-5">
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary dark:text-sidebar-primary">
                      <GitBranch className="size-[18px]" />
                    </span>
                    <div className="space-y-1">
                      <CardTitle className="text-sm">知识来源</CardTitle>
                      <CardDescription className="text-xs">选择要引用的本机仓库或目录</CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent className="px-5">
                  <div className="mb-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setDraft({ ...draft, knowledgeSources: [...draft.knowledgeSources, emptyGitSource()] })
                      }
                    >
                      <GitBranch className="size-3.5" /> Git 仓库
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setDraft({ ...draft, knowledgeSources: [...draft.knowledgeSources, emptyFolderSource()] })
                      }
                    >
                      <FolderOpen className="size-3.5" /> 本地目录
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {draft.knowledgeSources.map((source, index) => (
                      <SourceEditor
                        key={index}
                        source={source}
                        onBrowse={() => chooseSourceDirectory(index, source.type)}
                        onChange={(next) => {
                          const list = [...draft.knowledgeSources];
                          list[index] = next;
                          setDraft({ ...draft, knowledgeSources: list });
                        }}
                        onRemove={() => {
                          setDraft({
                            ...draft,
                            knowledgeSources: draft.knowledgeSources.filter((_, position) => position !== index),
                          });
                        }}
                      />
                    ))}
                  </div>
                  </CardContent>
                </Card>

                <Card className="gap-0 rounded-2xl py-5">
                  <CardHeader className="mb-4 flex items-center gap-2.5 px-5">
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary dark:text-sidebar-primary">
                      <Cpu className="size-[18px]" />
                    </span>
                    <div className="space-y-1">
                      <CardTitle className="text-sm">模型</CardTitle>
                      <CardDescription className="text-xs">配置分身使用的模型与凭据</CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent className="px-5">
                  <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
                    <Input
                      value={draft.model.provider}
                      onChange={(event) =>
                        setDraft({ ...draft, model: { ...draft.model, provider: event.target.value } })
                      }
                      placeholder="Provider"
                      aria-label="模型 Provider"
                    />
                    <Input
                      value={draft.model.model}
                      onChange={(event) =>
                        setDraft({ ...draft, model: { ...draft.model, model: event.target.value } })
                      }
                      placeholder="模型 ID"
                      aria-label="模型 ID"
                    />
                    <Input
                      value={draft.model.baseUrl ?? ""}
                      onChange={(event) =>
                        setDraft({ ...draft, model: { ...draft.model, baseUrl: event.target.value } })
                      }
                      placeholder="Base URL（可选）"
                      aria-label="模型 Base URL"
                    />
                  </div>
                  <Input
                    className="mt-3"
                    type="password"
                    value={draft.modelKey}
                    onChange={(event) => setDraft({ ...draft, modelKey: event.target.value })}
                    placeholder={editingId && draft.hasModelKey ? "已保存模型 API Key；留空不修改" : "模型 API Key（保存在系统凭据存储）"}
                    aria-label="模型 API Key"
                  />
                  </CardContent>
                </Card>

                <Card className="gap-0 rounded-2xl py-5">
                  <CardHeader className="mb-4 flex items-center gap-2.5 px-5">
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary dark:text-sidebar-primary">
                      <Radio className="size-[18px]" />
                    </span>
                    <div className="space-y-1">
                      <CardTitle className="text-sm">Buzz 连接</CardTitle>
                      <CardDescription className="text-xs">设置 Relay 与默认频道</CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent className="px-5">
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      value={draft.buzz.relayUrl}
                      onChange={(event) =>
                        setDraft({ ...draft, buzz: { ...draft.buzz, relayUrl: event.target.value } })
                      }
                      placeholder="Relay URL"
                      aria-label="Buzz Relay URL"
                    />
                    <Input
                      value={draft.buzz.homeChannel}
                      onChange={(event) =>
                        setDraft({ ...draft, buzz: { ...draft.buzz, homeChannel: event.target.value } })
                      }
                      placeholder="Home 频道 ID"
                      aria-label="Buzz Home 频道 ID"
                    />
                  </div>
                  </CardContent>
                </Card>

                <div className="flex items-center gap-3 pt-2">
                  <Button type="submit" disabled={busy === "create" || busy === "update" || !draft.identityId}>
                    {busy === "create" || busy === "update" ? (
                      <LoaderCircle className="size-4 animate-spin" />
                    ) : (
                      editingId ? <Save className="size-4" /> : <Plus className="size-4" />
                    )}
                    {editingId ? "保存配置" : "创建分身"}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => { setCreating(false); setEditingId(""); setDraft(null); }}>
                    取消
                  </Button>
                </div>
              </div>
            </form>
          ) : selected ? (
            <ForkDetail
              key={selected.id}
              fork={selected}
              busy={busy}
              logs={logs}
              onBuild={() =>
                runAction("build", () => invoke("build_fork_snapshot", { id: selected.id }), (result) =>
                  `知识快照已生成：${result.fileCount} 个文件。`,
                )
              }
              onStart={() =>
                runAction("start", () => invoke("start_fork", { id: selected.id }), "容器已启动，Buzz 连接中。")
              }
              onStop={() => runAction("stop", () => invoke("stop_fork", { id: selected.id }), "容器已停止。")}
              onLogs={() =>
                runAction("logs", async () => setLogs(await invoke("fork_logs", { id: selected.id, tail: 200 })))
              }
              onEdit={() => startEdit(selected)}
              onDelete={() => setDeleteTarget(selected)}
            />
          ) : (
            <div className="grid h-full min-h-[520px] place-items-center px-8">
              <section className="w-full max-w-[420px] text-center">
                <span className="mx-auto grid size-20 place-items-center rounded-2xl bg-primary/10 text-primary dark:text-sidebar-primary">
                  <Bot className="size-9" />
                </span>
                <h1 className="mt-6 text-2xl font-semibold tracking-tight">创建你的分身</h1>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  绑定身份与知识来源，本机 Docker 运行，<br />
                  同事即可在 Buzz 中 @ 它提问。
                </p>
                <Button className="mt-7" onClick={startCreate} disabled={identities.length === 0}>
                  <Plus className="size-4" />
                  {identities.length === 0 ? "请先创建身份" : "新建分身"}
                </Button>
              </section>
            </div>
          )}
        </div>
      </div>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除这个分身？</AlertDialogTitle>
            <AlertDialogDescription>
              “{deleteTarget?.name}”的配置、知识快照、容器与凭据将从当前设备永久删除，此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button variant="outline">取消</Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button variant="destructive" onClick={removeFork} disabled={busy === "delete"}>
                {busy === "delete" ? <LoaderCircle className="size-4 animate-spin" /> : null}
                删除分身
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ForkDetail({ fork, busy, logs, onBuild, onStart, onStop, onLogs, onEdit, onDelete }) {
  const label = STATE_LABELS[fork.state] ?? STATE_LABELS.draft;
  const [connection, setConnection] = useState(null);
  const [publicKey, setPublicKey] = useState("");
  const [copied, setCopied] = useState(false);

  async function refresh() {
    if (!invoke) return;
    try {
      const [state, key] = await Promise.all([
        invoke("fork_connection_state", { id: fork.id }),
        invoke("fork_identity_public_key", { id: fork.id }),
      ]);
      setConnection(state);
      setPublicKey(key);
    } catch {
      setConnection(null);
    }
  }

  useEffect(() => {
    refresh();
  }, [fork.id, fork.state]);

  async function copyPublicKey() {
    try {
      await navigator.clipboard.writeText(publicKey);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  const connectionError = `${connection?.errorCode ?? ""} ${connection?.errorMessage ?? ""}`.toLowerCase();
  const membershipBlocked =
    connection?.needsAttention ||
    connectionError.includes("membership") ||
    connectionError.includes("member");
  const profileMissing = connectionError.includes("no profile");

  return (
    <div className="mx-auto w-full max-w-[920px] px-[clamp(28px,5vw,72px)] py-[clamp(32px,5vh,56px)]">
      <div className="mb-8 flex items-start justify-between gap-6">
        <div className="min-w-0">
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-primary dark:text-sidebar-primary">分身</p>
          <h1 className="truncate text-[clamp(1.75rem,3vw,2.25rem)] font-semibold tracking-tight">{fork.name}</h1>
          <p className="mt-2 text-sm text-muted-foreground">创建于 {formatCreated(fork.createdAt)}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary dark:text-sidebar-primary">
            <Bot className="size-5" />
          </span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={onEdit} disabled={Boolean(busy)}>
              <Pencil className="size-3.5" />
              编辑配置
            </Button>
            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={onDelete} disabled={Boolean(busy)}>
              <Trash2 className="size-3.5" />
              删除
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <Card className="gap-0 rounded-2xl py-5">
          <CardHeader className="mb-4 flex items-center gap-2.5 px-5">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary dark:text-sidebar-primary">
              <Play className="size-[18px]" />
            </span>
            <div className="min-w-0 flex-1 space-y-1">
              <CardTitle className="text-sm">运行与维护</CardTitle>
              <CardDescription className="text-xs">构建知识快照后即可启动分身</CardDescription>
            </div>
            <CardAction className="shrink-0">
              <Badge className={cn("border-0 text-[11px]", label.tone)}>{label.text}</Badge>
            </CardAction>
          </CardHeader>
          <CardContent className="px-5">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={onBuild} disabled={Boolean(busy)}>
              {busy === "build" ? <LoaderCircle className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              构建知识
            </Button>
            {fork.state === "running" ? (
              <Button variant="outline" onClick={onStop} disabled={Boolean(busy)}>
                {busy === "stop" ? <LoaderCircle className="size-4 animate-spin" /> : <Square className="size-4" />}
                停止
              </Button>
            ) : (
              <Button onClick={onStart} disabled={Boolean(busy) || fork.state === "draft"}>
                {busy === "start" ? <LoaderCircle className="size-4 animate-spin" /> : <Play className="size-4" />}
                启动
              </Button>
            )}
            <Button variant="ghost" onClick={onLogs} disabled={Boolean(busy)} className="ml-auto">
              {busy === "logs" ? <LoaderCircle className="size-4 animate-spin" /> : <ScrollText className="size-4" />}
              查看日志
            </Button>
          </div>
          </CardContent>
        </Card>

        <Card className="gap-0 rounded-2xl py-5">
          <CardHeader className="mb-4 flex items-center gap-2.5 px-5">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary dark:text-sidebar-primary">
              <Radio className="size-[18px]" />
            </span>
            <div className="min-w-0 flex-1 space-y-1">
              <CardTitle className="text-sm">Buzz 连接</CardTitle>
              <CardDescription className="text-xs">查看分身与 Relay 的连接状态</CardDescription>
            </div>
            <CardAction className="shrink-0">
              <Button size="sm" variant="ghost" className="px-2" onClick={refresh}>
                <RefreshCw className="size-3.5" /> 刷新
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="px-5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>连接状态</span>
            {connection ? <ConnectionBadge state={connection.state} /> : <span>读取中…</span>}
          </div>

          {membershipBlocked || profileMissing ? (
            <div className="mt-4 rounded-xl border border-primary/20 bg-primary/10 p-4">
              <div className="flex items-start gap-2.5">
                <ShieldAlert className="mt-0.5 size-4 shrink-0 text-primary dark:text-sidebar-primary" />
                <div className="min-w-0 flex-1 space-y-2 text-sm leading-6 text-foreground">
                  <p className="font-medium">
                    {profileMissing ? "该身份尚未设置 Buzz Profile。" : "该身份还不是 Relay 工作区成员，无法接收消息。"}
                  </p>
                  <p className="text-xs">
                    {profileMissing
                      ? "下次启动时会自动使用分身名称和知识域描述创建 Profile；已有 Profile 不会被覆盖。"
                      : "请把下面的公钥发给 Buzz 管理员，在 Relay 工作区中把它添加为成员，然后重新启动分身。"}
                  </p>
                  {publicKey ? (
                    <div className="flex items-center gap-2">
                      <code className="block min-w-0 flex-1 select-text break-all rounded-lg bg-card/80 px-3 py-2 font-mono text-[11px] leading-5">
                        {publicKey}
                      </code>
                      <Button size="sm" variant="outline" className="shrink-0 bg-card" onClick={copyPublicKey}>
                        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                        {copied ? "已复制" : "复制"}
                      </Button>
                    </div>
                  ) : null}
                  {connection?.errorMessage ? (
                    <p className="break-all text-[11px] text-muted-foreground">{connection.errorMessage}</p>
                  ) : null}
                </div>
              </div>
            </div>
          ) : connection?.errorMessage ? (
            <p className="mt-3 break-all text-xs text-muted-foreground">{connection.errorMessage}</p>
          ) : null}
          </CardContent>
        </Card>

        {logs ? (
          <Card className="gap-0 rounded-2xl py-5">
            <CardHeader className="mb-4 flex items-center gap-2.5 px-5">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary dark:text-sidebar-primary">
                <ScrollText className="size-[18px]" />
              </span>
              <div className="space-y-1">
                <CardTitle className="text-sm">运行日志</CardTitle>
                <CardDescription className="text-xs">最近 200 行容器日志</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="px-5">
              <pre className="max-h-[420px] overflow-auto rounded-xl bg-muted px-4 py-3 text-xs leading-5">
                {logs}
              </pre>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

function ConnectionBadge({ state }) {
  const map = {
    connected: { text: "已连接", tone: "bg-primary/10 text-primary dark:text-sidebar-primary", icon: CircleCheck },
    connecting: { text: "连接中", tone: "bg-secondary text-secondary-foreground", icon: LoaderCircle },
    starting: { text: "启动中", tone: "bg-secondary text-secondary-foreground", icon: LoaderCircle },
    not_running: { text: "未运行", tone: "bg-muted text-muted-foreground", icon: CircleDot },
    error: { text: "连接异常", tone: "bg-destructive/10 text-destructive", icon: AlertCircle },
  };
  const entry = map[state] ?? { text: state, tone: "bg-muted text-muted-foreground", icon: CircleDot };
  const Icon = entry.icon;
  return (
    <Badge className={cn("border-0 px-2.5 text-[11px]", entry.tone)}>
      <Icon className={cn("size-3", state === "connecting" || state === "starting" ? "animate-spin" : "")} />
      {entry.text}
    </Badge>
  );
}
