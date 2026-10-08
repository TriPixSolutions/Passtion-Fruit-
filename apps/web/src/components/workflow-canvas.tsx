"use client";

import { useState } from "react";
import { Bot, Check, Clock3, ContactRound, Ellipsis, MessageCircleMore, Plus, SendHorizontal, Sparkles, UsersRound, X } from "./icons";

type NodeKey = "trigger" | "agent" | "wait" | "human" | "send";
const nodeInfo: Record<NodeKey, { title:string; subtitle:string; icon: typeof Bot; x:number; y:number; tone:string }> = {
  trigger:{ title:"New message", subtitle:"WhatsApp · Incoming", icon:MessageCircleMore, x:5, y:10, tone:"mint" },
  agent:{ title:"Product details agent", subtitle:"Answer from knowledge", icon:Sparkles, x:38, y:10, tone:"lime" },
  wait:{ title:"Wait for reply", subtitle:"Up to 20 minutes", icon:Clock3, x:38, y:55, tone:"blue" },
  human:{ title:"Assign to sales", subtitle:"Round robin · Team", icon:UsersRound, x:71, y:8, tone:"violet" },
  send:{ title:"Follow-up message", subtitle:"Approved template", icon:SendHorizontal, x:71, y:58, tone:"amber" },
};

export function WorkflowCanvas({ compact = false }: { compact?: boolean }) {
  const [selected, setSelected] = useState<NodeKey>("agent");
  const [published, setPublished] = useState(false);
  const selectedNode = nodeInfo[selected];
  return (
    <div className={`workflow-editor ${compact ? "compact" : ""}`}>
      {!compact && <aside className="node-library"><span className="eyebrow">Node library</span><h3>Build with blocks</h3>{[["Triggers",MessageCircleMore],["Messages",SendHorizontal],["AI agents",Bot],["Contacts",ContactRound],["Team",UsersRound],["Delays",Clock3]].map(([name,Icon])=><button key={name as string}><Icon size={17}/>{name as string}<Plus size={15}/></button>)}</aside>}
      <div className="canvas-wrap">
        <div className="canvas-toolbar"><div><span className="status-dot"/>Lead follow-up</div>{!compact && <div><span className="saved-state"><Check size={14}/>Saved</span><button className="button button-dark small" onClick={()=>setPublished(true)}>{published ? "Published" : "Publish"}</button></div>}</div>
        <div className="canvas" aria-label="Workflow canvas">
          <svg className="edges" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <path d="M31 16 C34 16 35 16 38 16"/><path d="M64 16 C67 16 68 15 71 15"/><path d="M51 22 C51 34 51 44 51 55"/><path d="M64 61 C68 61 68 64 71 64"/>
          </svg>
          {(Object.entries(nodeInfo) as [NodeKey, typeof selectedNode][]).map(([key,node])=>{const Icon=node.icon; return <button key={key} onClick={()=>setSelected(key)} className={`flow-node ${node.tone} ${selected===key ? "selected" : ""}`} style={{left:`${node.x}%`,top:`${node.y}%`}}><span className="node-icon"><Icon size={18}/></span><span><strong>{node.title}</strong><small>{node.subtitle}</small></span><Ellipsis size={17}/><i className="connector left"/><i className="connector right"/></button>})}
          <button className="canvas-add" aria-label="Add workflow node"><Plus size={20}/></button>
        </div>
      </div>
      {!compact && <aside className="inspector"><div className="inspector-head"><div><span className="eyebrow">Selected node</span><h3>{selectedNode.title}</h3></div><button className="icon-button" aria-label="Close settings"><X size={17}/></button></div><label>Instruction<textarea defaultValue="Answer using the published product catalogue. If unsure, hand the conversation to sales." /></label><label>Knowledge source<select defaultValue="catalogue"><option value="catalogue">Product catalogue</option><option>Support answers</option></select></label><label className="toggle-row"><span><strong>Human fallback</strong><small>Assign when confidence is low</small></span><input type="checkbox" defaultChecked /></label><button className="button button-outline full">Test this node</button></aside>}
    </div>
  );
}
