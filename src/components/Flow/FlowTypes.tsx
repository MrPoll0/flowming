import { Node, Edge } from '@xyflow/react';

// Define the node type to match initialNodes
export interface FlowNode extends Node {
  id: string;
  position: { x: number; y: number };
  data: { label: string; [key: string]: any };
  type?: string;
}

// Initial data
export const initialNodes: FlowNode[] = [
  { id: '1', position: { x: 0, y: 0 }, data: { label: '1' } },
  { id: '2', position: { x: 0, y: 100 }, data: { label: '2' } },
];

export const initialEdges: Edge[] = [{ id: 'e1-2', source: '1', target: '2' }]; 