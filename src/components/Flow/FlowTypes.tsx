import { Node, Edge } from '@xyflow/react';
import Start from './Nodes/Start';
import End from './Nodes/End';
// Define the node type to match initialNodes
export interface FlowNode extends Node {
  id: string;
  position: { x: number; y: number };
  data: { label: string; [key: string]: any };
}

export const nodeTypes = {
  Start,
  End,
}

// Initial data
export const initialNodes: FlowNode[] = [
  { id: '1', position: { x: 0, y: 0 }, data: { label: '1' } , type: 'Start' },
  { id: '2', position: { x: 0, y: 100 }, data: { label: '2' }, type: 'End' },
];

export const initialEdges: Edge[] = [{ 
  id: 'e1-2', 
  source: '1', 
  sourceHandle: 'bottom',
  target: '2',
  targetHandle: 'top'
}]; 