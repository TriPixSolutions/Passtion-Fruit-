"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brand } from "./brand";
import {
  Bell, Bot, ChartNoAxesCombined, ContactRound, LayoutDashboard, Megaphone,
  MessageCircleMore, Search, Settings2, ShoppingBag, UsersRound, Workflow,
} from "./icons";

const items = [
  ["Overview", "/app", LayoutDashboard],
  ["Inbox", "/app/inbox", MessageCircleMore],
  ["Campaigns", "/app/campaigns", Megaphone],
  ["Workflows", "/app/workflows", Workflow],
  ["AI agents", "/app/agents", Bot],
  ["Contacts", "/app/contacts", ContactRound],
  ["Commerce", "/app/commerce", ShoppingBag],
  ["Analytics", "/app/reports", ChartNoAxesCombined],
  ["Team", "/app/team", UsersRound],
];

export function ProductShell({ children, title, action }: { children: React.ReactNode; title: string; action?: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="product-layout">
      <aside className="sidebar">
        <Brand />
        <nav aria-label="Workspace navigation">
          {items.map(([label, href, Icon]) => {
            const active = href === "/app" ? pathname === href : pathname.startsWith(href as string);
            return <Link key={href as string} className={active ? "active" : ""} href={href as string}><Icon size={18}/><span>{label as string}</span></Link>;
          })}
        </nav>
        <div className="sidebar-bottom">
          <Link href="/app/settings"><Settings2 size={18}/>Settings</Link>
          <div className="workspace-card"><span className="avatar small">SL</span><div><strong>Serein Labs</strong><small>Pilot workspace</small></div></div>
        </div>
      </aside>
      <main className="product-main">
        <header className="product-topbar">
          <div><p className="breadcrumb">Serein Labs / Workspace</p><h1>{title}</h1></div>
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
