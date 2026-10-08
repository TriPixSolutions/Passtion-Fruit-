"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Brand } from "./brand";
import {
  Bell, Bot, ChartNoAxesCombined, ContactRound, LayoutDashboard, Megaphone,
  MessageCircleMore, Search, Settings2, ShoppingBag, UsersRound, Workflow,
} from "./icons";

type WorkspaceResponse = {
  data?: {
    workspace: { id: string; name: string; slug: string; role: string } | null;
    features: Array<{ key: string }>;
    channels: Array<{ id: string; display_name: string; status: string }>;
    platformAdmin: boolean;
  };
};

const items = [
  { label: "Overview", href: "/app", icon: LayoutDashboard },
  { label: "Inbox", href: "/app/inbox", icon: MessageCircleMore, feature: "shared_inbox" },
  { label: "Campaigns", href: "/app/campaigns", icon: Megaphone, feature: "campaigns" },
  { label: "Workflows", href: "/app/workflows", icon: Workflow, feature: "workflows" },
  { label: "AI agents", href: "/app/agents", icon: Bot, feature: "ai_assist" },
  { label: "Contacts", href: "/app/contacts", icon: ContactRound, feature: "contacts" },
  { label: "Commerce", href: "/app/commerce", icon: ShoppingBag, feature: "commerce" },
  { label: "Analytics", href: "/app/reports", icon: ChartNoAxesCombined, feature: "analytics" },
  { label: "Team", href: "/app/team", icon: UsersRound },
] as const;

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "PF";
}

export function ProductShell({ children, title, action }: { children: React.ReactNode; title: string; action?: React.ReactNode }) {
  const pathname = usePathname();
  const [workspace, setWorkspace] = useState<WorkspaceResponse["data"]>();
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/v1/workspace", { cache: "no-store", signal: controller.signal })
      .then((response) => response.ok ? response.json() as Promise<WorkspaceResponse> : Promise.reject(new Error("Workspace request failed")))
      .then((payload) => setWorkspace(payload.data))
      .catch((error) => { if (error instanceof Error && error.name !== "AbortError") setWorkspace(undefined); });
    return () => controller.abort();
  }, []);
  const featureKeys = useMemo(() => new Set(workspace?.features.map((feature) => feature.key) ?? []), [workspace]);
  const workspaceName = workspace?.workspace?.name ?? "Workspace";
  const visibleItems = items.filter((item) => !("feature" in item) || featureKeys.size === 0 || featureKeys.has(item.feature));
  return (
    <div className="product-layout">
      <aside className="sidebar">
        <Brand />
        <nav aria-label="Workspace navigation">
          {visibleItems.map(({ label, href, icon: Icon }) => {
            const active = href === "/app" ? pathname === href : pathname.startsWith(href);
            return <Link key={href} className={active ? "active" : ""} href={href}><Icon size={18}/><span>{label}</span></Link>;
          })}
        </nav>
        <div className="sidebar-bottom">
          <Link href="/app/settings"><Settings2 size={18}/>Settings</Link>
          <div className="workspace-card"><span className="avatar small">{initials(workspaceName)}</span><div><strong>{workspaceName}</strong><small>{workspace?.workspace?.role ?? "Loading workspace…"}</small></div></div>
        </div>
      </aside>
      <main className="product-main">
        <header className="product-topbar">
          <div><p className="breadcrumb">{workspaceName} / Workspace</p><h1>{title}</h1></div>
          <div className="topbar-actions"><button className="icon-button" aria-label="Search"><Search size={19}/></button><button className="icon-button" aria-label="Notifications"><Bell size={19}/><i/></button>{action}</div>
        </header>
        {children}
      </main>
    </div>
  );
}

export function StatCard({ label, value, change, tone = "green", bars = 12 }: { label: string; value: string; change: string; tone?: "green"|"blue"|"amber"|"violet"; bars?: number }) {
  return <article className="stat-card"><div className="stat-head"><span>{label}</span><span className={`trend ${change.startsWith("+") ? "up" : ""}`}>{change}</span></div><strong>{value}</strong><div className={`micro-bars ${tone}`}>{Array.from({length: bars}).map((_,i)=><i key={i} style={{height:`${28 + ((i*17)%56)}%`}} />)}</div></article>;
}
