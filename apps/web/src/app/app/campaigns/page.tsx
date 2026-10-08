"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { ProductShell } from "@/components/product-shell";
import { CalendarClock, Plus, SendHorizontal, X } from "@/components/icons";
import { apiData, loadWorkspace, type WorkspaceData } from "@/lib/client-api";

type Campaign={id:string;name:string;status:string;channel_id:string;template:{name?:string;language?:string};scheduled_at:string|null;created_at:string;updated_at:string};

export default function CampaignsPage(){
  const [workspace,setWorkspace]=useState<WorkspaceData|null>(null);
  const [campaigns,setCampaigns]=useState<Campaign[]|null>(null);
  const [open,setOpen]=useState(false);
  const [busy,setBusy]=useState(false);
  const [actionId,setActionId]=useState("");
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [name,setName]=useState("");
  const [template,setTemplate]=useState("hello_world");
  const [language,setLanguage]=useState("en_US");
  const [scheduled,setScheduled]=useState("");

  const load=useCallback(async(signal?:AbortSignal)=>{
    const ws=await loadWorkspace(signal);
    if(!ws.workspace)throw new Error("No active workspace is available");
    setWorkspace(ws);
    setCampaigns(await apiData<Campaign[]>(`/api/v1/campaigns?tenantId=${ws.workspace.id}`,{signal}));
  },[]);
  useEffect(()=>{const controller=new AbortController();load(controller.signal).catch(value=>{if(value instanceof Error&&value.name!=="AbortError")setError(value.message)});return()=>controller.abort()},[load]);

  const counts=useMemo(()=>({draft:campaigns?.filter(row=>row.status==="draft").length??0,active:campaigns?.filter(row=>["scheduled","running"].includes(row.status)).length??0,completed:campaigns?.filter(row=>row.status==="completed").length??0}),[campaigns]);

  async function create(event:FormEvent){
    event.preventDefault();if(!workspace?.workspace||!workspace.channels[0])return;setBusy(true);setError("");setNotice("");
    try{await apiData("/api/v1/campaigns",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({tenantId:workspace.workspace.id,name,channelId:workspace.channels[0].id,template:{type:"template",name:template,language},audienceFilter:{},...(scheduled?{scheduledAt:new Date(scheduled).toISOString()}:{})})});setOpen(false);setName("");setScheduled("");setNotice(scheduled?"Campaign scheduled. The worker will launch it at the selected time.":"Campaign draft created.");await load();}
    catch(value){setError(value instanceof Error?value.message:"Campaign could not be created")}finally{setBusy(false)}
  }

  async function launch(campaign:Campaign){
    if(!window.confirm(`Launch “${campaign.name}” for every opted-in contact in this workspace?`))return;
    setActionId(campaign.id);setError("");setNotice("");
    try{const result=await apiData<{recipientCount:number}>(`/api/v1/campaigns/${campaign.id}/launch`,{method:"POST"});setNotice(`Campaign launched for ${result.recipientCount} opted-in contact${result.recipientCount===1?"":"s"}.`);await load();}
    catch(value){setError(value instanceof Error?value.message:"Campaign could not be launched")}finally{setActionId("")}
  }

  const channelReady=Boolean(workspace?.channels.some(channel=>channel.status==="active"));
  return <ProductShell title="Campaigns" action={<button className="button button-dark" onClick={()=>setOpen(true)} disabled={!channelReady}><Plus size={16}/>New campaign</button>}>
    <section className="metric-grid compact-metrics"><article className="summary-card"><span>Drafts</span><strong>{counts.draft}</strong><small>Ready for approval</small></article><article className="summary-card"><span>Active</span><strong>{counts.active}</strong><small>Scheduled or sending</small></article><article className="summary-card"><span>Completed</span><strong>{counts.completed}</strong><small>Finished runs</small></article></section>
    {error&&<p className="form-error">{error}</p>}{notice&&<p className="form-success">{notice}</p>}
    <section className="panel data-panel"><div className="table-toolbar"><div><span className="eyebrow">Official WhatsApp</span><h2>Campaign drafts and runs</h2></div></div>
      {campaigns===null?<p className="muted">Loading campaigns…</p>:campaigns.length===0?<div className="empty-state"><CalendarClock size={22}/><h3>No campaigns yet</h3><p>Create a campaign using an approved Meta template. Only opted-in contacts are eligible.</p></div>:<div className="data-table"><div className="data-row header"><span>Campaign</span><span>Status</span><span>Template</span><span>Language</span><span>Schedule</span><span>Action</span></div>{campaigns.map((row,index)=><div className="data-row" key={row.id}><span><i className={`campaign-icon tone-${index%4}`}><CalendarClock size={17}/></i><strong>{row.name}</strong><small>Updated {new Date(row.updated_at).toLocaleString()}</small></span><span><b className={`status ${row.status}`}>{row.status}</b></span><span>{row.template?.name??"—"}</span><span>{row.template?.language??"—"}</span><span>{row.scheduled_at?new Date(row.scheduled_at).toLocaleString():"Manual launch"}</span><span>{row.status==="draft"?<button className="button button-outline small" onClick={()=>launch(row)} disabled={Boolean(actionId)}><SendHorizontal size={14}/>{actionId===row.id?"Launching…":"Launch"}</button>:<small>{row.status==="scheduled"?"Automatic":"—"}</small>}</span></div>)}</div>}
    </section>
    {open&&<div className="modal-backdrop"><div className="modal"><div className="panel-head"><div><span className="eyebrow">Approved template</span><h2>Create campaign</h2></div><button className="icon-button" onClick={()=>setOpen(false)} aria-label="Close"><X size={16}/></button></div><form onSubmit={create}><label>Campaign name<input required minLength={2} maxLength={120} value={name} onChange={event=>setName(event.target.value)}/></label><label>Meta template name<input required value={template} onChange={event=>setTemplate(event.target.value)}/></label><label>Language code<input required value={language} onChange={event=>setLanguage(event.target.value)}/></label><label>Schedule (optional)<input type="datetime-local" value={scheduled} onChange={event=>setScheduled(event.target.value)}/></label><small>Only contacts with recorded opt-in consent are included. Draft campaigns require a separate launch confirmation.</small><button className="button button-dark full" disabled={busy}>{busy?"Creating…":scheduled?"Schedule campaign":"Create draft"}</button></form></div></div>}
  </ProductShell>;
}
