"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { ProductShell } from "@/components/product-shell";
import { Check, Filter, MessageCircleMore, Search, SendHorizontal } from "@/components/icons";
import { apiData, loadWorkspace } from "@/lib/client-api";

type Message = { id: string; direction: "inbound" | "outbound"; status: string; content: Record<string, unknown>; created_at: string };
type Contact = { id: string; wa_id: string; display_name: string | null; consent_status: string };
type Note = { id: string; body: string; author_id: string | null; created_at: string };
type Member = { user_id: string; role: string; display_name: string };
type Team = { id: string; name: string; capacity: number };
type SavedReply = { id: string; shortcut: string; title: string; body: string };
type SlaPolicy = { id: string; name: string; first_response_minutes: number; resolution_minutes: number };
type Conversation = { id: string; channel_id: string; contact_id: string; status: string; ownership: string; ownership_generation: number; assigned_user_id: string | null; team_id: string | null; last_message_at: string | null; created_at: string; contacts: Contact | Contact[]; messages: Message[]; conversation_notes: Note[] };
type InboxData = { conversations: Conversation[]; members: Member[]; teams: Team[]; savedReplies: SavedReply[]; slaPolicy: SlaPolicy | null };

function contactOf(conversation: Conversation) { return Array.isArray(conversation.contacts) ? conversation.contacts[0] : conversation.contacts; }
function messageText(message?: Message) { if (!message) return "No message preview"; const text = message.content?.text; return typeof text === "string" && text ? text : `[${String(message.content?.type ?? "message")}]`; }
function initials(value: string) { return value.split(/\s+/).filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "WA"; }

export default function InboxPage() {
  const [tenantId, setTenantId] = useState("");
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [savedReplies, setSavedReplies] = useState<SavedReply[]>([]);
  const [slaPolicy, setSlaPolicy] = useState<SlaPolicy | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [liveSends, setLiveSends] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [queue, setQueue] = useState("open");
  const [search, setSearch] = useState("");
  const [note, setNote] = useState("");

  const loadInbox = useCallback(async (workspaceId: string, signal?: AbortSignal) => {
    const result = await apiData<InboxData>(`/api/v1/inbox?tenantId=${encodeURIComponent(workspaceId)}`, { signal });
    setConversations(result.conversations); setMembers(result.members); setTeams(result.teams); setSavedReplies(result.savedReplies); setSlaPolicy(result.slaPolicy);
    setActiveId((current) => current && result.conversations.some((row) => row.id === current) ? current : result.conversations[0]?.id ?? null);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const [workspace, healthResponse] = await Promise.all([
          loadWorkspace(controller.signal),
          fetch("/api/health", { cache: "no-store", signal: controller.signal }),
        ]);
        if (!workspace.workspace) throw new Error("No active workspace is available");
        const health = await healthResponse.json() as { checks?: { liveSends?: boolean } };
        setTenantId(workspace.workspace.id);
        setLiveSends(Boolean(health.checks?.liveSends));
        await loadInbox(workspace.workspace.id, controller.signal);
      } catch (loadError) {
        if (loadError instanceof Error && loadError.name === "AbortError") return;
        setError(loadError instanceof Error ? loadError.message : "Inbox data could not be loaded");
      }
    }
    void load();
    return () => controller.abort();
  }, [loadInbox]);

  const active = useMemo(() => conversations?.find((conversation) => conversation.id === activeId) ?? null, [activeId, conversations]);
  const openCount = conversations?.filter((conversation) => conversation.status === "open").length ?? 0;
  const unassignedCount = conversations?.filter((conversation) => !conversation.assigned_user_id).length ?? 0;
  const visibleConversations = useMemo(() => (conversations ?? []).filter((conversation) => {
    const contact = contactOf(conversation); const haystack = `${contact?.display_name ?? ""} ${contact?.wa_id ?? ""} ${messageText(conversation.messages?.[0])}`.toLowerCase();
    const queueMatch = queue === "all" || (queue === "open" && !["resolved", "spam", "blocked"].includes(conversation.status)) || (queue === "unassigned" && !conversation.assigned_user_id);
    return queueMatch && haystack.includes(search.trim().toLowerCase());
  }), [conversations, queue, search]);
  const slaState = useMemo(() => {
    if (!active || !slaPolicy) return null;
    const ordered=[...(active.messages??[])].sort((a,b)=>new Date(a.created_at).getTime()-new Date(b.created_at).getTime());
    const pendingInbound=[...ordered].reverse().find((message,index,rows)=>message.direction==="inbound"&&!rows.slice(0,index).some((later)=>later.direction==="outbound"));
    if (!pendingInbound) return { label:"Response complete", tone:"met", detail:`${slaPolicy.name} · first response met` };
    const dueAt=new Date(new Date(pendingInbound.created_at).getTime()+slaPolicy.first_response_minutes*60_000);
    const remaining=Math.ceil((dueAt.getTime()-Date.now())/60_000);
    return { label:remaining<0?"Response overdue":`Respond in ${remaining} min`, tone:remaining<0?"breached":"due", detail:`Due ${dueAt.toLocaleString()}` };
  },[active,slaPolicy]);

  async function updateConversation(changes: Record<string, unknown>) {
    if (!active || !tenantId) return;
    setError("");
    try {
      await apiData(`/api/v1/inbox/${active.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ tenantId, ...changes }) });
      await loadInbox(tenantId); setNotice("Conversation updated.");
    } catch (updateError) { setError(updateError instanceof Error ? updateError.message : "Conversation could not be updated"); }
  }

  async function addNote(event: FormEvent) {
    event.preventDefault(); if (!active || !tenantId || !note.trim()) return;
    try {
      await apiData(`/api/v1/inbox/${active.id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tenantId, body: note.trim() }) });
      setNote(""); await loadInbox(tenantId); setNotice("Private note added.");
    } catch (noteError) { setError(noteError instanceof Error ? noteError.message : "Note could not be added"); }
  }

  async function sendReply(event: FormEvent) {
    event.preventDefault();
    if (!active || !tenantId || !reply.trim() || !liveSends) return;
    setSending(true); setError(""); setNotice("");
    try {
      await apiData<{ messageId: string }>("/api/v1/messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, channelId: active.channel_id, contactId: active.contact_id, conversationId: active.id, idempotencyKey: crypto.randomUUID(), origin: "manual", content: { type: "text", text: reply.trim() }, expectedOwnershipGeneration: active.ownership_generation, expiresAt: new Date(Date.now() + 15 * 60_000).toISOString() }),
      });
      setReply(""); setNotice("Reply queued for the official WhatsApp channel.");
      await loadInbox(tenantId);
    } catch (sendError) { setError(sendError instanceof Error ? sendError.message : "Reply could not be queued"); }
    finally { setSending(false); }
  }

  return <ProductShell title="Inbox"><div className="inbox-layout"><aside className="conversation-list"><div className="inbox-search"><Search size={17}/><input value={search} onChange={(event)=>setSearch(event.target.value)} placeholder="Search conversations"/><button aria-label="Filter conversations"><Filter size={16}/></button></div><div className="inbox-tabs"><button className={queue==="open"?"active":""} onClick={()=>setQueue("open")}>Open <span>{openCount}</span></button><button className={queue==="all"?"active":""} onClick={()=>setQueue("all")}>All <span>{conversations?.length??0}</span></button><button className={queue==="unassigned"?"active":""} onClick={()=>setQueue("unassigned")}>Unassigned <span>{unassignedCount}</span></button></div>{conversations===null&&!error&&<div className="panel"><p>Loading live inbox…</p></div>}{conversations?.length===0&&<div className="panel"><strong>No conversations yet</strong><p>Incoming messages from the connected Meta number will appear here.</p></div>}{visibleConversations.map((conversation,index)=>{const contact=contactOf(conversation);const name=contact?.display_name||contact?.wa_id||"WhatsApp contact";const latest=conversation.messages?.[0];return <button key={conversation.id} className={`conversation-row ${activeId===conversation.id?"active":""}`} onClick={()=>setActiveId(conversation.id)}><span className={`avatar tone-${index%4}`}>{initials(name)}</span><div><span><strong>{name}</strong><time>{conversation.last_message_at?new Date(conversation.last_message_at).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}):""}</time></span><p>{messageText(latest)}</p><small>{conversation.status} · {conversation.ownership}</small></div></button>})}</aside>{active?<><section className="chat-panel"><header><div><span className="avatar tone-0">{initials(contactOf(active)?.display_name||contactOf(active)?.wa_id||"WA")}</span><div><h2>{contactOf(active)?.display_name||contactOf(active)?.wa_id||"WhatsApp contact"}</h2><p>Official WhatsApp channel</p></div></div><select className="inbox-status" value={active.status} onChange={(event)=>void updateConversation({status:event.target.value})}>{["new","open","pending","waiting_customer","waiting_internal","escalated","resolved","spam"].map((status)=><option key={status} value={status}>{status.replaceAll("_"," ")}</option>)}</select></header><div className="chat-history"><div className="date-chip">Conversation history</div>{[...(active.messages??[])].reverse().map((message)=><div key={message.id} className={`message ${message.direction==="inbound"?"incoming":"outgoing"}`}><p>{messageText(message)}</p><small>{new Date(message.created_at).toLocaleString()}{message.direction==="outbound"&&<><Check size={13}/>{message.status}</>}</small></div>)}</div><form className="composer" onSubmit={sendReply}><div className="composer-mode"><button type="button" className="active"><MessageCircleMore size={15}/>Reply</button>{savedReplies.length>0&&<select aria-label="Insert saved reply" defaultValue="" onChange={(event)=>{const item=savedReplies.find((saved)=>saved.id===event.target.value);if(item)setReply(item.body);event.target.value=""}}><option value="">Saved reply…</option>{savedReplies.map((saved)=><option key={saved.id} value={saved.id}>{saved.shortcut} · {saved.title}</option>)}</select>}</div><textarea value={reply} onChange={(event)=>setReply(event.target.value)} placeholder="Write a reply…" maxLength={4096}/>{error&&<p className="form-error">{error}</p>}{notice&&<p className="form-success">{notice}</p>}<div><small>{liveSends?"Messages use the official Meta Cloud API.":"Live sending is locked until the permanent Meta credential is activated."}</small><button className="button button-dark small" type="submit" disabled={!liveSends||sending||!reply.trim()}><SendHorizontal size={16}/>{sending?"Queueing…":"Send"}</button></div></form></section><aside className="contact-panel"><span className="avatar large tone-0">{initials(contactOf(active)?.display_name||contactOf(active)?.wa_id||"WA")}</span><h3>{contactOf(active)?.display_name||"WhatsApp contact"}</h3><p>{contactOf(active)?.wa_id}</p>{slaState&&<div className={`sla-badge ${slaState.tone}`}><strong>{slaState.label}</strong><small>{slaState.detail}</small></div>}<dl><div><dt>Consent</dt><dd>{contactOf(active)?.consent_status}</dd></div></dl><label className="inbox-field">Assigned agent<select value={active.assigned_user_id??""} onChange={(event)=>void updateConversation({assignedUserId:event.target.value||null,ownership:"human"})}><option value="">Unassigned</option>{members.map((member)=><option key={member.user_id} value={member.user_id}>{member.display_name}</option>)}</select></label><label className="inbox-field">Team<select value={active.team_id??""} onChange={(event)=>void updateConversation({teamId:event.target.value||null})}><option value="">No team</option>{teams.map((team)=><option key={team.id} value={team.id}>{team.name}</option>)}</select></label><section className="private-notes"><h4>Private notes</h4>{[...(active.conversation_notes??[])].reverse().map((entry)=><article key={entry.id}><p>{entry.body}</p><small>{new Date(entry.created_at).toLocaleString()}</small></article>)}<form onSubmit={addNote}><textarea value={note} onChange={(event)=>setNote(event.target.value)} placeholder="Add an internal note" maxLength={4000}/><button className="button small" disabled={!note.trim()}>Add note</button></form></section></aside></>:<section className="chat-panel"><div className="chat-history"><div className="ai-note"><MessageCircleMore size={18}/><div><strong>Your shared inbox is ready</strong><p>Incoming WhatsApp conversations are stored here automatically.</p></div></div></div></section>}</div></ProductShell>;
}
