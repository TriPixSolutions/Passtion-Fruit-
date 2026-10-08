import Link from "next/link";
import { CTA, Footer, MarketingHeader } from "@/components/marketing";
import { ArrowUpRight, Bot, Check, ContactRound, MessageCircleMore, ShieldCheck, Sparkles, Workflow, Zap } from "@/components/icons";
import { WorkflowCanvas } from "@/components/workflow-canvas";
import { AuthEntryRedirect } from "@/components/auth-entry-redirect";
import type { LucideIcon } from "lucide-react";

const features: [LucideIcon, string, string][] = [
  [MessageCircleMore, "Shared inbox", "Give every conversation an owner, context and a clear next step."],
  [Workflow, "Visual workflows", "Connect triggers, AI decisions, messages and human handoffs."],
  [Bot, "Focused AI agents", "Use specialist agents for details, qualification and follow-up."],
  [ContactRound, "Living customer profiles", "Turn each new message into organised, permission-aware context."],
];

export default function HomePage() {
  return <>
    <AuthEntryRedirect />
    <MarketingHeader />
    <main>
      <section className="hero container">
        <div className="hero-glow" />
        <span className="hero-pill"><Sparkles size={14}/> Official WhatsApp automation</span>
        <h1>WhatsApp work,<br/><em>without the noise.</em></h1>
        <p>Conversations, campaigns and intelligent follow-ups—organised in one remarkably simple workspace.</p>
        <div className="hero-actions"><Link className="button button-dark" href="/demo">Book a demo</Link><Link className="button button-ghost" href="/app">Explore the dashboard</Link></div>
        <DashboardPreview />
      </section>

      <section className="statement container"><span className="eyebrow">Designed for clarity</span><h2>Every message has context.<br/>Every next step has an owner.</h2><p>People, automation and customer history stay together—without making the work feel complicated.</p></section>

      <section className="feature-grid container">
        {features.map(([Icon,title,copy],i)=><article key={title as string} className={i===0 ? "feature-card featured" : "feature-card"}><span className="feature-icon"><Icon size={20}/></span><div><h3>{title as string}</h3><p>{copy as string}</p></div><ArrowUpRight size={18}/></article>)}
      </section>

      <section className="split-section container">
        <div className="split-copy"><span className="eyebrow">Automation that reads clearly</span><h2>Build the journey as simply as you explain it.</h2><p>Start with a message, decide what happens next, bring in the right AI agent and hand over to a person at the exact moment it matters.</p><ul><li><Check size={16}/>Reusable blocks</li><li><Check size={16}/>Safe human handoff</li><li><Check size={16}/>Visible run history</li></ul><Link className="text-link strong" href="/workflows">See how workflows work <ArrowUpRight size={16}/></Link></div>
        <div className="workflow-showcase"><WorkflowCanvas compact /></div>
      </section>

      <section className="trust-row container"><article><ShieldCheck/><strong>Official by design</strong><span>Built around Meta’s approved business messaging platform.</span></article><article><Zap/><strong>Ready for the real work</strong><span>Durable schedules, retries and clear delivery states.</span></article><article><Sparkles/><strong>AI with boundaries</strong><span>Knowledge, cost and human takeover stay under your control.</span></article></section>
      <CTA />
    </main>
    <Footer />
  </>;
}

function DashboardPreview() {
  return <div className="hero-dashboard">
    <aside><div className="mini-logo">PF</div>{["Overview","Inbox","Campaigns","Workflows","AI agents","Contacts"].map((x,i)=><span className={i===0?"selected":""} key={x}>{x}</span>)}</aside>
    <div className="preview-main"><div className="preview-top"><span>Good morning, Amina</span><div><i/><i/></div></div><div className="preview-stats"><article><small>Open conversations</small><strong>48</strong><div className="preview-bars"/></article><article><small>Automation handled</small><strong>72%</strong><div className="preview-bars coral"/></article><article><small>New leads</small><strong>19</strong><div className="preview-bars blue"/></article></div><div className="preview-bottom"><article><div className="preview-title"><span>Conversation volume</span><small>Last 7 days</small></div><div className="line-chart"><svg viewBox="0 0 500 160"><defs><linearGradient id="fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#71ca9d" stopOpacity=".38"/><stop offset="1" stopColor="#71ca9d" stopOpacity="0"/></linearGradient></defs><path className="area" d="M0 125 C60 120 80 90 130 100 S220 35 270 70 S360 115 410 46 S470 55 500 25 L500 160 L0 160Z"/><path d="M0 125 C60 120 80 90 130 100 S220 35 270 70 S360 115 410 46 S470 55 500 25"/></svg></div></article><article className="queue"><div className="preview-title"><span>Inbox queue</span><small>Live</small></div>{[["AR","Aarav Raj","Order update"],["MN","Meera Nair","Needs a person"],["RK","Riya Khan","Product question"]].map(x=><div className="queue-row" key={x[1]}><span className="avatar tiny">{x[0]}</span><div><strong>{x[1]}</strong><small>{x[2]}</small></div><i/></div>)}</article></div></div>
  </div>;
}
