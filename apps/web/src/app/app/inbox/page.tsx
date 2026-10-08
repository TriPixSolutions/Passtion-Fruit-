"use client";

import { useEffect, useMemo, useState } from "react";
import { ProductShell } from "@/components/product-shell";
import { Check, Filter, MessageCircleMore, Search, SendHorizontal } from "@/components/icons";

type Message = { id: string; direction: "inbound" | "outbound"; content: Record<string, unknown>; created_at: string };
type Contact = { id: string; wa_id: string; display_name: string | null; consent_status: string };
type Conversation = { id: string; status: string; ownership: string; last_message_at: string | null; contacts: Contact | Contact[]; messages: Message[] };

function contactOf(conversation: Conversation) { return Array.isArray(conversation.contacts) ? conversation.contacts[0] : conversation.contacts; }
function messageText(message?: Message) { if (!message) return "No message preview"; const text = message.content?.text; return typeof text === "string" && text ? text : `[${String(message.content?.type ?? "message")}]`; }
function initials(value: string) { return value.split(/\s+/).filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "WA"; }

export default function InboxPage() {
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [reply, setReply] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const workspaceResponse = await fetch("/api/v1/workspace", { cache: "no-store", signal: controller.signal });
        const workspacePayload = await workspaceResponse.json() as { data?: { workspace: { id: string } | null } };
        const tenantId = workspacePayload.data?.workspace?.id;
        if (!workspaceResponse.ok || !tenantId) throw new Error("No active workspace is available");
        const inboxResponse = await fetch(`/api/v1/inbox?tenantId=${encodeURIComponent(tenantId)}`, { cache: "no-store", signal: controller.signal });
        const inboxPayload = await inboxResponse.json() as { data?: Conversation[] };
        if (!inboxResponse.ok) throw new Error("Inbox data could not be loaded");
        const rows = inboxPayload.data ?? [];
        setConversations(rows);
        setActiveId(rows[0]?.id ?? null);
      } catch (loadError) {
        if (loadError instanceof Error && loadError.name === "AbortError") return;
        setError(loadError instanceof Error ? loadError.message : "Inbox data could not be loaded");
      }
    }
    void load();
    return () => controller.abort();
  }, []);

  const active = useMemo(() => conversations?.find((conversation) => conversation.id === activeId) ?? null, [activeId, conversations]);
  const openCount = conversations?.filter((conversation) => conversation.status === "open").length ?? 0;
  return <ProductShell title="Inbox"><div className="inbox-layout"><aside className="conversation-list"><div className="inbox-search"><Search size={17}/><input placeholder="Search conversations"/><button aria-label="Filter conversations"><Filter size={16}/></button></div><div className="inbox-tabs"><button className="active">Open <span>{openCount}</span></button><button>Mine <span>0</span></button><button>Unassigned <span>0</span></button></div>{error&&<div className="panel"><p>{error}</p></div>}{conversations===null&&!error&&<div className="panel"><p>Loading live inbox…</p></div>}{conversations?.length===0&&<div className="panel"><strong>No conversations yet</strong><p>Incoming messages from the connected Meta test number will appear here.</p></div>}{conversations?.map((conversation,index)=>{const contact=contactOf(conversation);const name=contact?.display_name||contact?.wa_id||"WhatsApp contact";const latest=conversation.messages?.[0];return <button key={conversation.id} className={`conversation-row ${activeId===conversation.id?"active":""}`} onClick={()=>setActiveId(conversation.id)}><span className={`avatar tone-${index%4}`}>{initials(name)}</span><div><span><strong>{name}</strong><time>{conversation.last_message_at?new Date(conversation.last_message_at).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}):""}</time></span><p>{messageText(latest)}</p><small>{conversation.ownership}</small></div></button>})}</aside>{active?<><section className="chat-panel"><header><div><span className="avatar tone-0">{initials(contactOf(active)?.display_name||contactOf(active)?.wa_id||"WA")}</span><div><h2>{contactOf(active)?.display_name||contactOf(active)?.wa_id||"WhatsApp contact"}</h2><p>Official WhatsApp channel</p></div></div><div><button className="button button-dark small">{active.status}</button></div></header><div className="chat-history"><div className="date-chip">Conversation history</div>{[...(active.messages??[])].reverse().map((message)=><div key={message.id} className={`message ${message.direction==="inbound"?"incoming":"outgoing"}`}><p>{messageText(message)}</p><small>{new Date(message.created_at).toLocaleString()}{message.direction==="outbound"&&<Check size={13}/>}</small></div>)}</div><form className="composer" onSubmit={(event)=>event.preventDefault()}><div className="composer-mode"><button type="button" className="active"><MessageCircleMore size={15}/>Reply</button></div><textarea value={reply} onChange={(event)=>setReply(event.target.value)} placeholder="Write a reply…"/><div><small>Live sending remains locked during pilot verification.</small><button className="button button-dark small" type="submit" disabled><SendHorizontal size={16}/>Send</button></div></form></section><aside className="contact-panel"><span className="avatar large tone-0">{initials(contactOf(active)?.display_name||contactOf(active)?.wa_id||"WA")}</span><h3>{contactOf(active)?.display_name||"WhatsApp contact"}</h3><p>{contactOf(active)?.wa_id}</p><dl><div><dt>Conversation</dt><dd>{active.status}</dd></div><div><dt>Owner</dt><dd>{active.ownership}</dd></div><div><dt>Consent</dt><dd>{contactOf(active)?.consent_status}</dd></div></dl></aside></>:<section className="chat-panel"><div className="chat-history"><div className="ai-note"><MessageCircleMore size={18}/><div><strong>Your shared inbox is ready</strong><p>The Meta channel is connected. Send an inbound message to the test number after adding an approved recipient to begin the live receive test.</p></div></div></div></section>}</div></ProductShell>;
}
