"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { featureKeys } from "@passion-fruit/contracts";
import { Brand } from "@/components/brand";
import { Bell, Check, ChevronDown, LayoutDashboard, LockKeyhole, Mail, Plus, Search, Settings2, SlidersHorizontal, UserRoundPlus, UsersRound, X } from "@/components/icons";

const labels: Record<(typeof featureKeys)[number], string> = {
  shared_inbox: "Shared inbox", manual_messages: "Manual messages", contacts: "Contacts", campaigns: "Campaigns", schedules: "Schedules", workflows: "Workflows", ai_assist: "AI assist", ai_auto_reply: "AI auto-reply", analytics: "Analytics", commerce: "Commerce",
};

type Tenant = {
  id: string; name: string; status: string; ownerEmail: string;
  features: Array<{ key: string; enabled: boolean; limits: Record<string, unknown> }>;
  channels: Array<{ id: string; status: string }>;
  usage: { outboundMessages: number; contacts: number };
};

function initials(name: string) { return name.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "PF"; }
function slugify(name: string) { return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50); }

export default function AdminPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [accessMethod, setAccessMethod] = useState("invite");
  const [busy, setBusy] = useState(true);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const response = await fetch("/api/v1/admin/tenants", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error?.message ?? "Unable to load customers");
      setTenants(body.data);
      setSelectedId((current) => current || body.data[0]?.id || "");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Unable to load customers"); }
    finally { setBusy(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);
  const current = tenants.find((tenant) => tenant.id === selectedId) ?? tenants[0];
  useEffect(() => {
    if (!current) return;
    setEnabled(Object.fromEntries(featureKeys.map((key) => [key, current.features.find((feature) => feature.key === key)?.enabled ?? false])));
  }, [current]);
  const filtered = useMemo(() => tenants.filter((tenant) => `${tenant.name} ${tenant.ownerEmail}`.toLowerCase().includes(search.toLowerCase())), [search, tenants]);
  const activeChannels = tenants.flatMap((tenant) => tenant.channels).filter((channel) => channel.status === "active").length;
  const outbound = tenants.reduce((sum, tenant) => sum + tenant.usage.outboundMessages, 0);

  async function saveFeatures() {
    if (!current) return;
    setBusy(true); setNotice("");
    try {
      const response = await fetch(`/api/v1/admin/tenants/${current.id}/features`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ features: featureKeys.map((key) => ({ key, enabled: Boolean(enabled[key]), limits: current.features.find((feature) => feature.key === key)?.limits ?? {} })) }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error?.message ?? "Unable to save access");
      setNotice("Feature access saved."); await load();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Unable to save access"); }
    finally { setBusy(false); }
  }

  async function createTenant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setNotice("");
    const values = new FormData(event.currentTarget);
    const name = String(values.get("name"));
    try {
      const payload = { name, slug: slugify(name), ownerEmail: String(values.get("ownerEmail")), accessMethod, ...(accessMethod === "temporary_password" ? { temporaryPassword: String(values.get("temporaryPassword")) } : {}), features: ["shared_inbox", "manual_messages", "contacts"] };
      const response = await fetch("/api/v1/admin/tenants", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error?.message ?? "Unable to create workspace");
      setShowCreate(false); setNotice("Customer workspace created."); await load(); setSelectedId(body.data.tenantId);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Unable to create workspace"); }
    finally { setBusy(false); }
  }

  return <div className="admin-layout"><aside className="admin-sidebar"><Brand/><nav><a className="active"><LayoutDashboard size={18}/><span>Customers</span></a><a><UsersRound size={18}/><span>Platform users</span></a><a><SlidersHorizontal size={18}/><span>Feature bundles</span></a><a><Settings2 size={18}/><span>Platform settings</span></a></nav><div className="admin-profile"><span className="avatar small">PF</span><div><strong>Platform admin</strong><small>Live workspace</small></div></div></aside><main className="admin-main"><header><div><p className="breadcrumb">Passion Fruit / Super admin</p><h1>Customers</h1></div><div><button className="icon-button" aria-label="Notifications"><Bell size={18}/></button><button className="button button-dark" onClick={() => setShowCreate(true)}><Plus size={16}/>Add customer</button></div></header>{notice && <p className="admin-notice" role="status">{notice}</p>}<section className="admin-stats"><article><span>Active workspaces</span><strong>{tenants.filter((tenant) => tenant.status === "active").length}</strong><small>{tenants.length} total workspaces</small></article><article><span>Connected numbers</span><strong>{activeChannels}</strong><small>Active official channels</small></article><article><span>Outbound messages</span><strong>{outbound}</strong><small>Recorded across workspaces</small></article></section><div className="admin-content"><section className="customer-table panel"><div className="table-toolbar"><div><span className="eyebrow">Customer accounts</span><h2>{busy ? "Loading…" : `${filtered.length} workspace${filtered.length === 1 ? "" : "s"}`}</h2></div><label className="table-search"><Search size={16}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search"/></label></div>{filtered.map((tenant, index) => <button className={`customer-row ${current?.id === tenant.id ? "active" : ""}`} onClick={() => setSelectedId(tenant.id)} key={tenant.id}><span className={`avatar tone-${index % 4}`}>{initials(tenant.name)}</span><div><strong>{tenant.name}</strong><small>{tenant.ownerEmail}</small></div><span className={`status ${tenant.status}`}>{tenant.status}</span><span><strong>{tenant.features.filter((feature) => feature.enabled).length}</strong><small>features</small></span><span><strong>{tenant.usage.outboundMessages}</strong><small>messages</small></span><ChevronDown size={17}/></button>)}{!busy && filtered.length === 0 && <div className="empty-admin">No customer workspaces found.</div>}</section>{current ? <aside className="feature-editor panel"><div className="editor-title"><div><span className="avatar tone-0">{initials(current.name)}</span><div><h2>{current.name}</h2><p>{current.ownerEmail}</p></div></div><button className="icon-button" aria-label="Workspace settings"><Settings2 size={17}/></button></div><div className="feature-heading"><span>Feature access</span><small>{Object.values(enabled).filter(Boolean).length} enabled</small></div><div className="feature-toggles">{featureKeys.map((key) => <label key={key}><span><strong>{labels[key]}</strong><small>{key.startsWith("ai_") ? "Usage and cost controlled" : "Workspace module"}</small></span><input type="checkbox" checked={Boolean(enabled[key])} onChange={(event) => setEnabled((state) => ({ ...state, [key]: event.target.checked }))}/></label>)}</div><button className="button button-dark full" disabled={busy} onClick={() => void saveFeatures()}><Check size={16}/>{busy ? "Saving…" : "Save access"}</button></aside> : <aside className="feature-editor panel"><p>Create the first customer workspace to manage feature access.</p></aside>}</div></main>{showCreate && <div className="drawer-backdrop" onClick={() => setShowCreate(false)}><aside className="create-drawer" onClick={(event) => event.stopPropagation()}><header><div><span className="soft-icon tone-0"><UserRoundPlus size={20}/></span><div><h2>Add customer</h2><p>Create an isolated customer workspace.</p></div></div><button className="icon-button" onClick={() => setShowCreate(false)}><X size={18}/></button></header><form onSubmit={createTenant}><label>Business name<input name="name" required minLength={2} placeholder="Business name"/></label><label>Owner email<span className="input-icon"><Mail size={16}/><input name="ownerEmail" type="email" required placeholder="owner@company.com"/></span></label><label>Access method<select value={accessMethod} onChange={(event) => setAccessMethod(event.target.value)}><option value="invite">Email invitation</option><option value="temporary_password">Temporary password</option></select></label>{accessMethod === "temporary_password" && <label>Temporary password<input name="temporaryPassword" type="password" minLength={12} required autoComplete="new-password"/></label>}<div className="security-note"><LockKeyhole size={18}/><p>{accessMethod === "invite" ? "The owner receives an expiring invitation and creates their password." : "The owner must change the temporary password after first sign-in."}</p></div><button className="button button-dark full" disabled={busy}>{busy ? "Creating…" : "Create workspace"}</button></form></aside></div>}</div>;
}
