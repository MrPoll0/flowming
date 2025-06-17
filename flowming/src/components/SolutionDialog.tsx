import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useEffect } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  Edge,
} from "@xyflow/react";
import { FlowNode } from "@/components/Flow/FlowTypes";
import { nodeTypes } from "@/components/Flow/FlowTypes";
import "@xyflow/react/dist/style.css";
import Flowline from "@/components/Flow/Edges/Flowline";
import { VariablesProvider, useVariables } from "@/context/VariablesContext";
import { Variable } from "@/models/Variable";

const edgeTypes = {
  default: Flowline,
};

interface SolutionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nodes: FlowNode[];
  edges: Edge[];
  title: string;
}

// Helper component to set up context and render flow
const SolutionFlow: React.FC<{ nodes: FlowNode[]; edges: Edge[] }> = ({ nodes, edges }) => {
  const { setVariables } = useVariables();

  // Populate variables context once
  useEffect(() => {
    const vars: Variable[] = [];
    const nameToType: Record<string,string> = {};
    nodes.forEach((n) => {
      if (n.type === "DeclareVariable") {
        if (Array.isArray(n.data?.variables)) {
          (n.data.variables as any[]).forEach((v) => {
            const typeStr = String(v.type).toLowerCase();
            const allowed = ["integer", "string", "float", "boolean"];
            const varType = (allowed.includes(typeStr) ? typeStr : "integer") as any;
            vars.push(new Variable(`${n.id}-${v.name}`, varType, v.name, n.id));
            nameToType[v.name] = varType;
          });
        } else if (n.data?.variableName && n.data?.variableType) {
          const typeStr = String(n.data.variableType).toLowerCase();
          const allowed = ["integer", "string", "float", "boolean"];
          const varType = (allowed.includes(typeStr) ? typeStr : "integer") as any;
          vars.push(new Variable(`${n.id}-${n.data.variableName}`, varType, n.data.variableName, n.id));
          nameToType[n.data.variableName] = varType;
        }
      }
    });
    // Inject variable objects into Input nodes
    nodes.forEach((n) => {
      if (n.type === "Input" && n.data?.variableName) {
        const t = nameToType[n.data.variableName] ?? "integer";
        n.data.variable = {
          id: `${n.id}-${n.data.variableName}`,
          type: t,
          name: n.data.variableName,
          nodeId: "",
        } as any;
      }
    });
    setVariables(vars);
  }, [nodes, setVariables]);

  return (
    <ReactFlowProvider>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        nodesDraggable={false}
        nodesConnectable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        <Controls />
      </ReactFlow>
    </ReactFlowProvider>
  );
};

const SolutionDialog: React.FC<SolutionDialogProps> = ({
  open,
  onOpenChange,
  nodes,
  edges,
  title,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Solution: {title}</DialogTitle>
        </DialogHeader>
        <div className="w-full h-full border rounded-md flex-grow">
          <VariablesProvider>
            <SolutionFlow nodes={nodes} edges={edges} />
          </VariablesProvider>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SolutionDialog; 