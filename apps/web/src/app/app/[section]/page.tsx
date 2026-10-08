import { ProductShell } from "@/components/product-shell";
import { LiveModuleCards } from "@/components/live-module-cards";
import { Bot, Boxes, ChartNoAxesCombined, ContactRound, Plus, Settings2, ShoppingBag, UsersRound } from "@/components/icons";

const config: Record<string,{title:string;copy:string;icon:typeof Bot;items:string[]}>= {
  agents:{title:"AI agents",copy:"Give each agent one clear role, approved knowledge and a safe handoff rule.",icon:Bot,items:["Product details agent","Lead qualification agent","Follow-up agent"]},
  contacts:{title:"Contacts",copy:"Customer context, preferences and consent history in one organised record.",icon:ContactRound,items:["Meera Nair","Aarav Raj","Sara Khan"]},
  commerce:{title:"Commerce",copy:"Bring order and product context into customer conversations.",icon:ShoppingBag,items:["Store connection","Product catalogue","Order events"]},
  reports:{title:"Analytics",copy:"Understand delivery, response time and automation outcomes clearly.",icon:ChartNoAxesCombined,items:["Conversation report","Campaign report","AI usage"]},
  team:{title:"Team",copy:"Set roles, ownership and working hours for the people helping customers.",icon:UsersRound,items:["Amina Yusuf","Rahul Menon","Nisha Thomas"]},
  settings:{title:"Settings",copy:"Manage workspace preferences, connected channels and data controls.",icon:Settings2,items:["Workspace details","WhatsApp channel","Data & privacy"]},
};
export default async function SectionPage({params}:{params:Promise<{section:string}>}){const {section}=await params;const page=config[section]??{title:"Workspace",copy:"This module is part of the Passion Fruit product plan.",icon:Boxes,items:["Module overview"]};const Icon=page.icon;return <ProductShell title={page.title} action={<button className="button button-dark"><Plus size={16}/>Add new</button>}><section className="module-intro panel"><span className="soft-icon tone-0"><Icon size={22}/></span><div><span className="eyebrow">{page.title}</span><h2>{page.copy}</h2></div></section><LiveModuleCards section={section} fallback={page.items}/></ProductShell>}
