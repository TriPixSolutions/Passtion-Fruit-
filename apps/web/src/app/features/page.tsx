import { CTA, Footer, MarketingHeader, PageIntro } from "@/components/marketing";
import { Bot, CalendarClock, ChartNoAxesCombined, ContactRound, Megaphone, MessageCircleMore, ShoppingBag, Workflow } from "@/components/icons";
import type { LucideIcon } from "lucide-react";

const groups: [LucideIcon, string, string, string[]][] = [
  [MessageCircleMore,"A shared inbox that stays human","Assign conversations, leave private notes, use saved replies and see the complete customer history in one place.",["Ownership and routing","Internal notes","Live delivery states"]],
  [Workflow,"Workflows your whole team can read","Build automation from connected blocks, publish versions safely and see exactly where every run is waiting.",["Visual builder","Version history","Error recovery"]],
  [Bot,"AI agents with a clear job","Give each agent a focused role, approved knowledge and a simple rule for when to bring in a person.",["Details agent","Lead qualification","Human fallback"]],
  [Megaphone,"Campaigns with control built in","Create a defined audience, preview exclusions and cost, then pause or resume without losing recipient progress.",["Audience snapshots","Template validation","Recipient results"]],
  [ContactRound,"Customer context that builds itself","Create a useful contact profile from each conversation, while keeping permission and opt-out evidence close.",["Automatic contact creation","Tags and custom fields","Consent history"]],
  [ChartNoAxesCombined,"Reports that explain the result","Understand delivery, response time, campaign outcomes and AI use through clear metric definitions.",["Inbox performance","Delivery analytics","Cost visibility"]],
];

export default function FeaturesPage(){return <><MarketingHeader/><main><PageIntro eyebrow="Product" title="Everything your team needs. Nothing they have to decode." copy="Passion Fruit keeps daily WhatsApp work simple on the surface and dependable underneath."/><section className="feature-list container">{groups.map(([Icon,title,copy,bullets],i)=><article key={title as string} className="feature-row"><div className={`feature-visual visual-${i%3}`}><span><Icon size={34}/></span>{i===0&&<div className="chat-sample"><i/><p>Hi! Can I get an update on my order?</p><p className="reply">Of course — it is out for delivery today.</p></div>}{i===1&&<div className="mini-flow"><b>New lead</b><em/><b>AI details</b><em/><b>Sales team</b></div>}{i>1&&<div className="visual-orbit"><i/><i/><i/></div>}</div><div><span className="eyebrow">0{i+1}</span><h2>{title as string}</h2><p>{copy as string}</p><ul>{(bullets as string[]).map(b=><li key={b}>{b}</li>)}</ul></div></article>)}</section><CTA/></main><Footer/></>}
