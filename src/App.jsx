import { useState } from "react";
import { Bot, KeyRound, Settings } from "lucide-react";
import appIcon from "../src-tauri/icons/128x128.png";
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
          <button
            key={key}
            type="button"
            onClick={() => setPage(key)}
            aria-label={label}
            title={label}
            className={cn(
              "flex w-[52px] flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
              page === key
                ? "bg-sidebar-accent text-foreground"
                : "text-muted-foreground hover:bg-muted/70",
            )}
          >
            <Icon className="size-[18px]" />
            {label}
          </button>
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
