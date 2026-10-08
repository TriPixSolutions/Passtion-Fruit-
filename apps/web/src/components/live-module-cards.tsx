"use client";

import { useEffect, useState } from "react";

type Card = { id: string; title: string; detail: string; status: string };
type WorkspacePayload = {
  data?: {
    workspace: { id: string; name: string; role: string } | null;
    features: Array<{ key: string }>;
    channels: Array<{ id: string; display_name: string; status: string }>;
  };
};

function initials(value: string) {
  return value.split(/\s+/).filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "PF";
}

export function LiveModuleCards({ section, fallback }: { section: string; fallback: string[] }) {
  const [cards, setCards] = useState<Card[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        if (!["agents", "contacts", "settings"].includes(section)) {
          setCards(fallback.map((title, index) => ({ id: title, title, detail: "Open this item to view its full configuration and recent activity.", status: index === 1 ? "Review" : "Active" })));
          return;
        }
        const workspaceResponse = await fetch("/api/v1/workspace", { cache: "no-store", signal: controller.signal });
        if (!workspaceResponse.ok) throw new Error("Workspace data could not be loaded");
        const workspacePayload = await workspaceResponse.json() as WorkspacePayload;
        const workspace = workspacePayload.data?.workspace;
        if (!workspace) throw new Error("No active workspace is assigned to this account");

        if (section === "settings") {
          const channels = workspacePayload.data?.channels ?? [];
          setCards([
            { id: "workspace", title: workspace.name, detail: `Your role: ${workspace.role}`, status: "Active" },
            ...(channels.length ? channels.map((channel) => ({ id: channel.id, title: channel.display_name, detail: "Official Meta WhatsApp channel", status: channel.status })) : [{ id: "channel", title: "WhatsApp channel", detail: "No channel connected", status: "Setup" }]),
            { id: "features", title: "Enabled modules", detail: `${workspacePayload.data?.features.length ?? 0} workspace features enabled`, status: "Active" },
          ]);
          return;
        }

        const response = await fetch(`/api/v1/${section}?tenantId=${encodeURIComponent(workspace.id)}`, { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error(`${section === "agents" ? "Agent" : "Contact"} data could not be loaded`);
        const payload = await response.json() as { data?: Array<Record<string, unknown>> };
        const records = payload.data ?? [];
        setCards(records.map((record) => section === "agents" ? {
          id: String(record.id),
          title: String(record.name ?? "Unnamed agent"),
          detail: String(record.purpose ?? "No purpose configured"),
          status: String(record.mode ?? "draft").replaceAll("_", " "),
        } : {
          id: String(record.id),
          title: String(record.display_name ?? record.phone_e164 ?? record.wa_id ?? "Unnamed contact"),
          detail: String(record.phone_e164 ?? record.wa_id ?? "WhatsApp contact"),
          status: String(record.consent_status ?? "unknown").replaceAll("_", " "),
        }));
      } catch (loadError) {
        if (loadError instanceof Error && loadError.name === "AbortError") return;
        setError(loadError instanceof Error ? loadError.message : "Module data could not be loaded");
      }
    }
    void load();
    return () => controller.abort();
  }, [fallback, section]);

  if (error) return <section className="panel module-intro"><div><span className="eyebrow">Connection issue</span><h2>{error}</h2></div></section>;
  if (cards === null) return <section className="panel module-intro"><div><span className="eyebrow">Loading</span><h2>Preparing live workspace data…</h2></div></section>;
  if (cards.length === 0) return <section className="panel module-intro"><div><span className="eyebrow">Ready to configure</span><h2>No {section === "agents" ? "AI agents" : "contacts"} have been added yet.</h2></div></section>;

  return <section className="module-cards">{cards.map((card, index) => <article className="panel" key={card.id}><div className="module-card-head"><span className={`avatar tone-${index % 4}`}>{initials(card.title)}</span><span className={`status ${card.status.toLowerCase() === "review" ? "review" : "running"}`}>{card.status}</span></div><h3>{card.title}</h3><p>{card.detail}</p><button className="button button-outline small">View details</button></article>)}</section>;
}
