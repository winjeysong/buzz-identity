import { useState } from "react";
import { Bot, KeyRound, Settings } from "lucide-react";
import appIcon from "../src-tauri/icons/128x128.png";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import ForksPage from "@/pages/ForksPage";
import IdentitiesPage from "@/pages/IdentitiesPage";
import SettingsPage from "@/pages/SettingsPage";

const NAV_ITEMS = [
  { key: "identities", label: "身份", icon: KeyRound },
  { key: "forks", label: "分身", icon: Bot },
  { key: "settings", label: "设置", icon: Settings },
];

export default function App() {
  const [page, setPage] = useState("forks");

  return (
    <div className="flex h-screen min-h-[560px] bg-background text-foreground">
      <nav className="flex w-[68px] shrink-0 flex-col items-center gap-1 border-r bg-sidebar py-4">
        <img src={appIcon} alt="" className="mb-3 size-10 rounded-xl shadow-sm" />
        {NAV_ITEMS.map(({ key, label, icon: Icon }) => (
          <Button
            key={key}
            variant="ghost"
            onClick={() => setPage(key)}
            aria-label={label}
            title={label}
            className={cn(
              "w-13 h-13 flex-col gap-1 rounded-xl py-2 text-xs",
              page === key
                ? "bg-sidebar-accent text-foreground"
                : "text-muted-foreground hover:bg-muted/70",
            )}
          >
            <Icon className="size-5" />
            <span className="text-xs">{label}</span>
          </Button>
        ))}
      </nav>

      <div className="min-w-0 flex-1">
        {page === "identities" ? <IdentitiesPage /> : null}
        {page === "forks" ? <ForksPage /> : null}
        {page === "settings" ? <SettingsPage /> : null}
      </div>
    </div>
  );
}
