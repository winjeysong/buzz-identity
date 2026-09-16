import { useEffect, useState } from "react";
import { CheckCircle2, Container, LoaderCircle, RefreshCw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const invoke = window.__TAURI__?.core?.invoke;

export default function SettingsPage() {
  const [docker, setDocker] = useState(null);
  const [checking, setChecking] = useState(true);

  async function probe() {
    if (!invoke) return;
    setChecking(true);
    try {
      setDocker(await invoke("docker_probe"));
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    probe();
  }, []);

  return (
    <div className="mx-auto w-full max-w-[760px] px-[clamp(28px,5vw,72px)] py-[clamp(32px,5vh,56px)]">
      <h1 className="text-2xl font-semibold tracking-tight">设置</h1>
      <p className="mt-1 text-sm text-muted-foreground">运行环境与依赖状态。</p>

      <section className="mt-8 rounded-2xl border bg-card p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground">
            <Container className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold">Docker</h2>
              {checking ? (
                <LoaderCircle className="size-4 animate-spin text-muted-foreground" />
              ) : docker?.available ? (
                <span className="flex items-center gap-1 text-xs font-medium text-emerald-700">
                  <CheckCircle2 className="size-3.5" /> 可用
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs font-medium text-amber-700">
                  <XCircle className="size-3.5" /> 不可用
                </span>
              )}
            </div>
            {checking ? (
              <p className="mt-1 text-xs text-muted-foreground">正在检测…</p>
            ) : docker?.available ? (
              <p className="mt-1 text-xs text-muted-foreground">Docker {docker.version}</p>
            ) : (
              <div className="mt-1 space-y-1 text-xs leading-5 text-muted-foreground">
                <p>分身在 Docker 容器中运行。请安装并启动 Docker Desktop 后重新检测。</p>
                {docker?.message ? <p className="break-all">{docker.message}</p> : null}
              </div>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={probe} disabled={checking}>
            <RefreshCw className="size-3.5" /> 重新检测
          </Button>
        </div>
      </section>
    </div>
  );
}
