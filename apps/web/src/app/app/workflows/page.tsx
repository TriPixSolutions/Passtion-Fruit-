"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { ProductShell } from "@/components/product-shell";
import { Check, MessageCircleMore, Plus, Workflow, X } from "@/components/icons";
import { apiData, loadWorkspace } from "@/lib/client-api";

type Flow={id:string;name:string;status:string;active_version:number|null;updated_at:string;workflow_versions:Array<{version:number;graph:Record<string,unknown>;published_at:string|null}>};

export default function AppWorkflows(){
  const [tenantId,setTenantId]=useState("");const [flows,setFlows]=useState<Flow[]|null>(null);const [open,setOpen]=useState(false);const [name,setName]=useState("");const [reply,setReply]=useState("Thanks for your message. A team member will reply shortly.");const [busy,setBusy]=useState(false);const [publishing,setPublishing]=useState("");const [error,setError]=useState("");const [notice,setNotice]=useState("");
  const load=useCallback(async(signal?:AbortSignal)=>{const workspace=await loadWorkspace(signal);if(!workspace.workspace)throw new Error("No active workspace is available");setTenantId(workspace.workspace.id);setFlows(await apiData<Flow[]>(`/api/v1/workflows?tenantId=${workspace.workspace.id}`,{signal}));},[]);
  useEffect(()=>{const controller=new AbortController();load(controller.signal).catch(value=>{if(value instanceof Error&&value.name!=="AbortError")setError(value.message)});return()=>controller.abort()},[load]);

  async function create(event:FormEvent){event.preventDefault();setBusy(true);setError("");setNotice("");try{await apiData("/api/v1/workflows",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({tenantId,name,graph:{nodes:[{id:"incoming",type:"trigger",config:{event:"message.received"}},{id:"reply",type:"message",config:{content:{type:"text",text:reply}}}],edges:[{source:"incoming",target:"reply"}]}})});setOpen(false);setName("");setNotice("Workflow draft created. Publish it when the reply is ready.");await load();}catch(value){setError(value instanceof Error?value.message:"Workflow could not be created")}finally{setBusy(false)}}

  async function publish(flow:Flow){
    const version=flow.workflow_versions?.[0]?.version??1;
    if(!window.confirm(`Publish version ${version} of “${flow.name}”? New inbound messages can trigger it immediately.`))return;
    setPublishing(flow.id);setError("");setNotice("");
    try{await apiData(`/api/v1/workflows/${flow.id}/publish`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({version})});setNotice(`${flow.name} is active for new inbound messages.`);await load();}
    catch(value){setError(value instanceof Error?value.message:"Workflow could not be published")}finally{setPublishing("")}
  }

  return <ProductShell title="Workflows" action={<button className="button button-dark" onClick={()=>setOpen(true)}><Plus size={16}/>New workflow</button>}>
    {error&&<p className="form-error">{error}</p>}{notice&&<p className="form-success">{notice}</p>}
    <section className="module-intro panel"><span className="soft-icon tone-0"><Workflow size={22}/></span><div><span className="eyebrow">No-code automation</span><h2>Published workflows execute from real inbound WhatsApp events.</h2></div></section>
    <section className="module-cards">{flows===null?<article className="panel"><p>Loading workflows…</p></article>:flows.length===0?<article className="panel"><h3>No workflows yet</h3><p>Create a safe draft with an incoming-message trigger and a reply node.</p></article>:flows.map((flow,index)=><article className="panel" key={flow.id}><div className="module-card-head"><span className={`avatar tone-${index%4}`}><Workflow size={16}/></span><span className={`status ${flow.status}`}>{flow.status}</span></div><h3>{flow.name}</h3><p>Version {flow.workflow_versions?.[0]?.version??1} · Updated {new Date(flow.updated_at).toLocaleString()}</p>{flow.status==="active"?<button className="button button-outline small" disabled><Check size={14}/>Active</button>:<button className="button button-outline small" onClick={()=>publish(flow)} disabled={Boolean(publishing)}>{publishing===flow.id?"Publishing…":"Review and publish"}</button>}</article>)}</section>
    {open&&<div className="modal-backdrop"><div className="modal"><div className="panel-head"><div><span className="eyebrow">Versioned draft</span><h2>Create workflow</h2></div><button className="icon-button" onClick={()=>setOpen(false)} aria-label="Close"><X size={16}/></button></div><form onSubmit={create}><label>Workflow name<input required minLength={2} maxLength={100} value={name} onChange={event=>setName(event.target.value)}/></label><label>Reply for new inbound messages<textarea required maxLength={4096} value={reply} onChange={event=>setReply(event.target.value)}/></label><div className="security-note"><MessageCircleMore size={17}/><p>The draft cannot send messages until you publish it. Every run and reply uses a durable idempotency key.</p></div><button className="button button-dark full" disabled={busy}>{busy?"Creating…":"Create workflow draft"}</button></form></div></div>}
  </ProductShell>;
}
