import { Node, Edge } from '@xyflow/react';
import Start from './Nodes/Start';
import End from './Nodes/End';
import DeclareVariable from './Nodes/DeclareVariable';
import AssignVariable from './Nodes/AssignVariable';
import Conditional from './Nodes/Conditional';
import Flowline from './Edges/Flowline';
import Input from './Nodes/Input';
import Output from './Nodes/Output';
// Define the node type to match initialNodes
export interface FlowNode extends Node {
  id: string;
  position: { x: number; y: number };
  data: { 
    label: string; 
    visualId?: string; // For user-friendly sequential numbering
    [key: string]: any; 
  };
}

export const nodeTypes = {
  Start,
  End,
  DeclareVariable,
  AssignVariable,
  Conditional,
  Input,
  Output
}

export const edgeTypes = {
  Flowline,
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
  targetHandle: 'top',
  data: { label: 'double click me to edit' },
}]; 