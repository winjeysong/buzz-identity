import { useEffect, useState } from "react";
import {
  AlertCircle,
  Bot,
  Check,
  CircleCheck,
  CircleDot,
  Copy,
  FolderOpen,
  GitBranch,
  LoaderCircle,
  Play,
  Plus,
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const invoke = window.__TAURI__?.core?.invoke;

const STATE_LABELS = {
  draft: { text: "草稿", tone: "bg-muted text-muted-foreground" },
  ready: { text: "就绪", tone: "bg-sky-50 text-sky-700" },
  running: { text: "运行中", tone: "bg-emerald-50 text-emerald-700" },
  stopped: { text: "已停止", tone: "bg-amber-50 text-amber-700" },
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

function SourceEditor({ source, onChange, onRemove }) {
  const input = (key, placeholder, className) => (
    <Input
      value={source[key] ?? ""}
      onChange={(event) => onChange({ ...source, [key]: event.target.value })}
      placeholder={placeholder}
      className={cn("h-9", className)}
    />
  );
  return (
    <div className="rounded-xl border bg-muted/30 p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="grid size-7 place-items-center rounded-lg bg-white text-muted-foreground shadow-sm">
          {source.type === "git" ? <GitBranch className="size-3.5" /> : <FolderOpen className="size-3.5" />}
        </span>
        <Input
          value={source.label}
          onChange={(event) => onChange({ ...source, label: event.target.value })}
          placeholder="来源名称（引用中显示）"
          className="h-8 flex-1 bg-white"
        />
        <Button size="icon" variant="ghost" className="size-8" onClick={onRemove} aria-label="移除来源">
          <X className="size-3.5" />
        </Button>
      </div>
      {source.type === "git" ? (
        <div className="grid grid-cols-[1fr_150px] gap-2">
          {input("repoPath", "Git 仓库绝对路径")}
          {input("commit", "分支或 commit（默认 HEAD）")}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2">{input("path", "目录绝对路径")}</div>
      )}
    </div>
  );
}

export default function ForksPage() {
  const [forks, setForks] = useState([]);
  const [identities, setIdentities] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [creating, setCreating] = useState(false);
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

  async function submitCreate(event) {
    event.preventDefault();
    if (!invoke || busy) return;
    setBusy("create");
    setError("");
    try {
      const payload = {
        ...draft,
        domain: draft.domain.trim() || null,
        knowledgeSources: draft.knowledgeSources
          .filter((source) => (source.type === "git" ? source.repoPath : source.path).trim())
          .map((source) => ({ ...source, label: source.label.trim() || source.repoPath || source.path })),
      };
      const created = await invoke("create_fork", { draft: payload });
      setCreating(false);
      setDraft(null);
      await load();
      setSelectedId(created.id);
      setNotice("分身已创建。下一步：构建知识快照。");
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
      <aside className="flex w-[clamp(240px,24vw,300px)] shrink-0 flex-col border-r">
        <div className="flex items-center justify-between px-5 pb-2 pt-5">
          <span className="text-xs font-medium text-muted-foreground">我的分身</span>
          <span className="text-xs tabular-nums text-muted-foreground">{forks.length}</span>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
          {forks.length === 0 && !isBooting ? (
            <p className="px-2 py-8 text-center text-xs leading-5 text-muted-foreground">
              尚未创建分身
              <br />
              点击右上角 + 开始
            </p>
          ) : null}
          <div className="space-y-1">
            {forks.map((fork) => {
              const label = STATE_LABELS[fork.state] ?? STATE_LABELS.draft;
              return (
                <button
                  key={fork.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(fork.id);
                    setCreating(false);
                    setLogs("");
                    setNotice("");
                    setError("");
                  }}
                  className={cn(
                    "block w-full rounded-xl px-3 py-2.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                    selectedId === fork.id ? "bg-sidebar-accent" : "hover:bg-muted/70",
                  )}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-sm font-medium">{fork.name}</span>
                    <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium", label.tone)}>
                      {label.text}
                    </span>
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                    {formatCreated(fork.createdAt)}
                    {fork.hasModelKey ? "" : " · 未设置模型 Key"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {error ? (
          <div className="flex items-center gap-2 border-b border-red-200 bg-red-50 px-6 py-3 text-sm text-red-700">
            <AlertCircle className="size-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate">{error}</span>
            <button type="button" onClick={() => setError("")} aria-label="关闭错误提示">
              <X className="size-4" />
            </button>
          </div>
        ) : null}
        {notice ? (
          <div className="flex items-center gap-2 border-b border-emerald-200 bg-emerald-50 px-6 py-3 text-sm text-emerald-700">
            <span className="min-w-0 flex-1 truncate">{notice}</span>
            <button type="button" onClick={() => setNotice("")} aria-label="关闭提示">
              <X className="size-4" />
            </button>
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto">
          {isBooting ? (
            <div className="grid h-full place-items-center text-muted-foreground">
              <LoaderCircle className="size-6 animate-spin" />
            </div>
          ) : creating && draft ? (
            <form className="mx-auto w-full max-w-[760px] px-8 py-10" onSubmit={submitCreate}>
              <h1 className="text-2xl font-semibold tracking-tight">创建分身</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                分身使用你的身份连接 Buzz，知识来自你指定的 Git 仓库与本地目录。
              </p>

              <div className="mt-8 space-y-6">
                <section className="space-y-3">
                  <h2 className="text-sm font-semibold">基本信息</h2>
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      value={draft.name}
                      onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                      placeholder="分身名称（如：我的架构助手）"
                      maxLength={80}
                    />
                    <select
                      value={draft.identityId}
                      onChange={(event) => setDraft({ ...draft, identityId: event.target.value })}
                      className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <option value="">选择身份…</option>
                      {identities.map((identity) => (
                        <option key={identity.id} value={identity.id}>
                          {identity.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Input
                    value={draft.domain}
                    onChange={(event) => setDraft({ ...draft, domain: event.target.value })}
                    placeholder="知识域描述（可选，如：Artpal 前端问题）"
                  />
                </section>

                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold">知识来源</h2>
                    <div className="flex gap-2">
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
                  </div>
                  <div className="space-y-2">
                    {draft.knowledgeSources.map((source, index) => (
                      <SourceEditor
                        key={index}
                        source={source}
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
                </section>

                <section className="space-y-3">
                  <h2 className="text-sm font-semibold">模型</h2>
                  <div className="grid grid-cols-3 gap-3">
                    <Input
                      value={draft.model.provider}
                      onChange={(event) =>
                        setDraft({ ...draft, model: { ...draft.model, provider: event.target.value } })
                      }
                      placeholder="Provider"
                    />
                    <Input
                      value={draft.model.model}
                      onChange={(event) =>
                        setDraft({ ...draft, model: { ...draft.model, model: event.target.value } })
                      }
                      placeholder="模型 ID"
                    />
                    <Input
                      value={draft.model.baseUrl ?? ""}
                      onChange={(event) =>
                        setDraft({ ...draft, model: { ...draft.model, baseUrl: event.target.value } })
                      }
                      placeholder="Base URL（可选）"
                    />
                  </div>
                  <Input
                    type="password"
                    value={draft.modelKey}
                    onChange={(event) => setDraft({ ...draft, modelKey: event.target.value })}
                    placeholder="模型 API Key（保存在系统凭据存储）"
                  />
                </section>

                <section className="space-y-3">
                  <h2 className="text-sm font-semibold">Buzz</h2>
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      value={draft.buzz.relayUrl}
                      onChange={(event) =>
                        setDraft({ ...draft, buzz: { ...draft.buzz, relayUrl: event.target.value } })
                      }
                      placeholder="Relay URL"
                    />
                    <Input
                      value={draft.buzz.homeChannel}
                      onChange={(event) =>
                        setDraft({ ...draft, buzz: { ...draft.buzz, homeChannel: event.target.value } })
                      }
                      placeholder="Home 频道 ID"
                    />
                  </div>
                </section>

                <div className="flex items-center gap-3 pt-2">
                  <Button type="submit" disabled={busy === "create" || !draft.identityId}>
                    {busy === "create" ? (
                      <LoaderCircle className="size-4 animate-spin" />
                    ) : (
                      <Plus className="size-4" />
                    )}
                    创建分身
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setCreating(false)}>
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
              onDelete={() => setDeleteTarget(selected)}
            />
          ) : (
            <div className="grid h-full min-h-[520px] place-items-center px-8">
              <section className="w-full max-w-[420px] text-center">
                <span className="mx-auto grid size-20 place-items-center rounded-[22px] bg-emerald-50 text-emerald-700">
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

function ForkDetail({ fork, busy, logs, onBuild, onStart, onStop, onLogs, onDelete }) {
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

  const membershipBlocked =
    connection?.needsAttention ||
    (connection?.errorCode ?? "").includes("membership") ||
    (connection?.errorMessage ?? "").includes("membership_required");

  return (
    <div className="mx-auto w-full max-w-[920px] px-[clamp(28px,5vw,72px)] py-[clamp(32px,5vh,56px)]">
      <div className="mb-8 flex items-start justify-between gap-6">
        <div className="min-w-0">
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-emerald-700">分身</p>
          <h1 className="truncate text-[clamp(1.75rem,3vw,2.25rem)] font-semibold tracking-tight">{fork.name}</h1>
          <p className="mt-2 text-sm text-muted-foreground">创建于 {formatCreated(fork.createdAt)}</p>
        </div>
        <span className={cn("rounded-full px-3 py-1 text-xs font-medium", label.tone)}>{label.text}</span>
      </div>

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
        <Button variant="outline" onClick={onLogs} disabled={Boolean(busy)}>
          {busy === "logs" ? <LoaderCircle className="size-4 animate-spin" /> : <ScrollText className="size-4" />}
          查看日志
        </Button>
        <Button variant="ghost" className="text-muted-foreground hover:text-destructive" onClick={onDelete}>
          <Trash2 className="size-4" />
          删除
        </Button>
      </div>

      <section className="mt-6 rounded-2xl border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">Buzz 连接</span>
          {connection ? <ConnectionBadge state={connection.state} /> : null}
          <Button size="sm" variant="ghost" className="ml-auto h-7 px-2 text-xs" onClick={refresh}>
            <RefreshCw className="size-3.5" /> 刷新
          </Button>
        </div>

        {membershipBlocked ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-start gap-2.5">
              <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-700" />
              <div className="min-w-0 flex-1 space-y-2 text-sm leading-6 text-amber-900">
                <p className="font-medium">该身份还不是 Relay 工作区成员，无法接收消息。</p>
                <p className="text-xs">
                  请把下面的公钥发给 Buzz 管理员，在 Relay 工作区中把它添加为成员，然后重新启动分身。
                </p>
                {publicKey ? (
                  <div className="flex items-center gap-2">
                    <code className="block min-w-0 flex-1 select-text break-all rounded-lg bg-white/80 px-3 py-2 font-mono text-[11px] leading-5">
                      {publicKey}
                    </code>
                    <Button size="sm" variant="outline" className="shrink-0 bg-white" onClick={copyPublicKey}>
                      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                      {copied ? "已复制" : "复制"}
                    </Button>
                  </div>
                ) : null}
                {connection?.errorMessage ? (
                  <p className="break-all text-[11px] text-amber-700/80">{connection.errorMessage}</p>
                ) : null}
              </div>
            </div>
          </div>
        ) : connection?.errorMessage ? (
          <p className="mt-3 break-all text-xs text-muted-foreground">{connection.errorMessage}</p>
        ) : null}
      </section>

      {logs ? (
        <pre className="mt-6 max-h-[420px] overflow-auto rounded-2xl border bg-muted/40 p-4 text-xs leading-5">
          {logs}
        </pre>
      ) : null}
    </div>
  );
}

function ConnectionBadge({ state }) {
  const map = {
    connected: { text: "已连接", tone: "bg-emerald-50 text-emerald-700", icon: CircleCheck },
    connecting: { text: "连接中", tone: "bg-sky-50 text-sky-700", icon: LoaderCircle },
    starting: { text: "启动中", tone: "bg-sky-50 text-sky-700", icon: LoaderCircle },
    not_running: { text: "未运行", tone: "bg-muted text-muted-foreground", icon: CircleDot },
    error: { text: "连接异常", tone: "bg-red-50 text-red-700", icon: AlertCircle },
  };
  const entry = map[state] ?? { text: state, tone: "bg-muted text-muted-foreground", icon: CircleDot };
  const Icon = entry.icon;
  return (
    <span className={cn("flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium", entry.tone)}>
      <Icon className={cn("size-3", state === "connecting" || state === "starting" ? "animate-spin" : "")} />
      {entry.text}
    </span>
  );
}
