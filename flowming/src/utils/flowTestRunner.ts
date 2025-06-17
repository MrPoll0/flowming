import { FlowNode } from "@/components/Flow/FlowTypes";
import { Edge } from "@xyflow/react";
import { NodeProcessor } from "@/components/Flow/Nodes/NodeTypes";
import { DeclareVariableProcessor } from "@/components/Flow/Nodes/DeclareVariable";
import { AssignVariableProcessor } from "@/components/Flow/Nodes/AssignVariable";
import { ConditionalProcessor } from "@/components/Flow/Nodes/Conditional";
import { InputProcessor } from "@/components/Flow/Nodes/Input";
import { OutputProcessor } from "@/components/Flow/Nodes/Output";
import { ValuedVariable } from "@/models/ValuedVariable";
import { VariableType } from "@/models/Variable";
import { decisionEdgeLabels } from "@/components/Flow/Nodes/Conditional";

/**
 * Very small subset of ReactFlowInstance used by NodeProcessors
 */
class SimpleReactFlow {
  private nodesMap: Map<string, FlowNode>;
  private edges: Edge[];

  constructor(nodes: FlowNode[], edges: Edge[]) {
    // Deep clone to avoid mutating original diagram
    this.nodesMap = new Map(nodes.map((n) => [n.id, JSON.parse(JSON.stringify(n))]));
    this.edges = edges.map((e) => ({ ...e }));
  }

  /* ReactFlowInstance-like helpers used by processors */
  getNode(id: string) {
    return this.nodesMap.get(id);
  }

  getNodes() {
    return Array.from(this.nodesMap.values());
  }

  getEdges() {
    return this.edges;
  }

  /** updateNodeData merges new data into existing node.data */
  updateNodeData(id: string, partial: any) {
    const n = this.nodesMap.get(id);
    if (!n) return;
    n.data = { ...n.data, ...partial };
    this.nodesMap.set(id, n);
  }

  /** Dummy implementations for compatibility */
  addNodes(_node: FlowNode | FlowNode[]) {
    // No-op for test evaluation
  }

  /** Returns connections like ReactFlowInstance.getNodeConnections */
  getNodeConnections({ nodeId }: { nodeId: string }): any {
    return this.edges
      .filter((e) => e.source === nodeId || e.target === nodeId)
      .map((e) => ({ edgeId: e.id, source: e.source, target: e.target }));
  }

  /** Update edge data */
  updateEdgeData(edgeId: string, data: any) {
    const edge = this.edges.find((e) => e.id === edgeId);
    if (edge) edge.data = { ...edge.data, ...data };
  }
}

function getNodeProcessor(
  rf: SimpleReactFlow,
  valuedVariables: ValuedVariable<VariableType>[],
  node: FlowNode,
  showInputDialog: (title: string, variableType: string) => Promise<string | null>,
  addOutput: (node: FlowNode, value: any) => void
): NodeProcessor | null {
  switch (node.type) {
    case "DeclareVariable":
      // getNodeVariables not needed for evaluation, pass dummy
      return new DeclareVariableProcessor(rf as any, node.id, valuedVariables, () => []);
    case "AssignVariable":
      return new AssignVariableProcessor(rf as any, node.id, valuedVariables, node.data.expression);
    case "Conditional":
      return new ConditionalProcessor(rf as any, node.id);
    case "Input":
      return new InputProcessor(rf as any, node.id, showInputDialog as any);
    case "Output":
      return new OutputProcessor(rf as any, node.id, addOutput as any);
    default:
      return null;
  }
}

export interface FlowTestResult {
  outputs: string[];
}

/**
 * Executes the flow diagram with the provided inputs and returns outputs.
 */
export async function runFlowTest(
  nodes: FlowNode[],
  edges: Edge[],
  inputValues: string[]
): Promise<FlowTestResult> {
  const rf = new SimpleReactFlow(nodes, edges);
  const outputs: string[] = [];
  let inputCursor = 0;

  const showInputDialog = async () => {
    const val = inputValues[inputCursor] ?? "";
    inputCursor++;
    return val;
  };

  const addOutput = (_node: FlowNode, value: any) => {
    outputs.push(String(value));
  };

  // Find start node
  const startNode = rf.getNodes().find((n) => n.type === "Start");
  if (!startNode) {
    throw new Error("No Start node in diagram");
  }

  // Traverse sequentially similar to original executor but synchronously
  // TODO: refactor
  let current: FlowNode | null = startNode;
  let safetyCounter = 0;
  const maxSteps = 1000;

  while (current && safetyCounter < maxSteps) {
    safetyCounter++;

    // Prepare current valued variables from node.data
    const existingVV = Array.isArray((current!.data as any).currentValuedVariables)
      ? (current!.data as any).currentValuedVariables.map((v: any) => ValuedVariable.fromObject(v))
      : [];

    const processor = getNodeProcessor(rf, existingVV, current!, showInputDialog, addOutput);
    let processorResult: any = null;
    let valuedVariables: ValuedVariable<VariableType>[] = [];

    if (processor) {
      processorResult = await processor.process();
      if (current!.type === "Conditional") {
        if (processorResult && typeof processorResult === "object" && "valuedVariables" in processorResult) {
          valuedVariables = processorResult.valuedVariables;
        }
      } else if (Array.isArray(processorResult)) {
        valuedVariables = processorResult;
      }
    }

    // Store variables in current node for future reference (if needed)
    if (valuedVariables.length > 0) {
      rf.updateNodeData(current!.id, {
        currentValuedVariables: valuedVariables.map((v) => v.toObject()),
      });
    }

    // Determine next node
    let nextNodeId: string | null = null;
    if (current!.type === "Conditional") {
      const condResult = processorResult?.result ?? false;
      const labelWanted = condResult ? decisionEdgeLabels[1] : decisionEdgeLabels[0];
      const outEdges = edges.filter((e) => e.source === current!.id);
      const edgeMatch = outEdges.find((e) => (e.data?.conditionalLabel ?? "") === labelWanted) || outEdges[0];
      nextNodeId = edgeMatch?.target ?? null;
    } else {
      const outEdge = edges.find((e) => e.source === current!.id);
      nextNodeId = outEdge?.target ?? null;
    }

    if (!nextNodeId) break;

    const nextNode = rf.getNode(nextNodeId);

    // The valuedVariables from the current node must be passed to the next node.
    if (nextNode) {
      let varsToPass = valuedVariables;
      // If the processor didn't return any variables, carry over the existing ones
      if (varsToPass.length === 0 && existingVV.length > 0) {
        varsToPass = existingVV;
      }
      
      if (varsToPass.length > 0) {
        rf.updateNodeData(nextNode.id, {
            currentValuedVariables: varsToPass.map((v) => v.toObject()),
        });
      }
    }

    current = nextNode ?? null;
  }

  if (safetyCounter >= maxSteps) {
    throw new Error("Execution exceeded maximum steps (possible infinite loop).");
  }

  return { outputs };
} 