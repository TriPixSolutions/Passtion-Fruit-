import { ProductShell } from "@/components/product-shell";
import { Plus } from "@/components/icons";
import { WorkflowCanvas } from "@/components/workflow-canvas";
export default function AppWorkflows(){return <ProductShell title="Workflows" action={<button className="button button-dark"><Plus size={16}/>New workflow</button>}><WorkflowCanvas/></ProductShell>}
