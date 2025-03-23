import React, { useRef, useState, useEffect, useContext } from 'react';
import { 
  ReactFlow, 
  Controls, 
  Background, 
  BackgroundVariant, 
  useReactFlow,
  useNodesState,
  useEdgesState,
  Node, 
  Panel,
  MarkerType,
  addEdge,
  Edge
} from '@xyflow/react';
import { SelectedNodeContext } from '../../context/SelectedNodeContext';
import { FlowNode, initialNodes, initialEdges, nodeTypes } from './FlowTypes';
import { NodeBlock } from '../Toolbar/ToolbarTypes';

const FlowContent: React.FC = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, _setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const { setSelectedNode } = useContext(SelectedNodeContext);
  
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const reactFlowInstance = useReactFlow();

  // Handle node selection
  const onNodeClick = (_: React.MouseEvent, node: Node) => {
    console.log('Node clicked:', node);
    setSelectedNode(node as FlowNode);
  };

  // Clear selection when clicking on the canvas
  const onPaneClick = () => {
    setSelectedNode(null);
  };

  // Initialize ReactFlow when the component mounts
  useEffect(() => {
    if (reactFlowInstance) {
      reactFlowInstance.fitView();
    }
  }, [reactFlowInstance]);

  // Add direct event listeners to the ReactFlow pane
  useEffect(() => {
    const paneEl = reactFlowWrapper.current?.querySelector('.react-flow__pane');
    if (!paneEl) return;

    const handleDirectDragOver = (e: Event) => {
      const dragEvent = e as DragEvent;
      dragEvent.preventDefault();
      dragEvent.stopPropagation();
      
      if (dragEvent.dataTransfer) {
        dragEvent.dataTransfer.dropEffect = 'move';
      }
      
      if (!isDraggingOver) {
        setIsDraggingOver(true);
        paneEl.classList.add('drop-target');
      }
    };

    const handleDirectDragLeave = () => {
      setIsDraggingOver(false);
      paneEl.classList.remove('drop-target');
    };

    const handleDirectDrop = (e: Event) => {
      const dragEvent = e as DragEvent;
      dragEvent.preventDefault();
      dragEvent.stopPropagation();
      
      setIsDraggingOver(false);
      paneEl.classList.remove('drop-target');
      
      if (!dragEvent.dataTransfer || !reactFlowInstance || !reactFlowWrapper.current) {
        console.error('Missing required elements for drop');
        return;
      }
      
      // Try to get the data from multiple formats
      let blockData = dragEvent.dataTransfer.getData('application/reactflow');
      if (!blockData) {
        blockData = dragEvent.dataTransfer.getData('text/plain');
      }
      
      console.log('Direct drop event received data:', blockData);
      
      if (!blockData) {
        console.error('No block data received in direct drop');
        return;
      }
      
      try {
        const block = JSON.parse(blockData) as NodeBlock;
        console.log('Parsed block data in direct drop:', block);
        
        /*if (block.type !== 'node') {
          console.error('Dropped item is not a node block');
          return;
        }*/
        
        // Get the position where the node should be created
        const position = reactFlowInstance.screenToFlowPosition({
          x: dragEvent.clientX,
          y: dragEvent.clientY,
        });
        
        console.log('Creating node at position in direct drop:', position);
        
        // Create a new node
        const newNode: FlowNode = {
          id: `${block.nodeType}-${Date.now()}`,
          type: block.nodeType === 'default' ? undefined : block.nodeType,
          position,
          data: { 
            label: block.label,
            ...(block.defaultData || {})
          },
        };
        
        console.log('New node created in direct drop:', newNode);
        
        // Add the new node to the flow
        setNodes((nds) => [...nds, newNode]);
      } catch (error) {
        console.error('Error creating node in direct drop:', error);
      }
    };

    paneEl.addEventListener('dragover', handleDirectDragOver);
    paneEl.addEventListener('dragleave', handleDirectDragLeave);
    paneEl.addEventListener('drop', handleDirectDrop);

    return () => {
      paneEl.removeEventListener('dragover', handleDirectDragOver);
      paneEl.removeEventListener('dragleave', handleDirectDragLeave);
      paneEl.removeEventListener('drop', handleDirectDrop);
    };
  }, [reactFlowInstance, isDraggingOver, setNodes]);

  const onConnect = (params: any) => {
    console.log('onConnect', params);
    _setEdges((eds: Edge[]) => addEdge(params, eds));
  };

  return (
    <div 
      className="reactflow-wrapper" 
      ref={reactFlowWrapper} 
      style={{ width: '100%', height: '100%' }}
    >
      <ReactFlow
        nodes={nodes}
        nodeTypes={nodeTypes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onConnect={onConnect}
        fitView
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{ 
          // TODO: custom edge for custom (smoothstep) dragging handle
          // TODO: check this for draw.io similar behavior with edges https://stackoverflow.com/questions/77831116/is-it-possible-to-shape-reactflow-edges-by-dragging-them
          // ==> https://codesandbox.io/p/sandbox/floral-framework-forked-2ytjqc

          // TODO: animated + color change edge when running
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 10,
            height: 10,
            color: '#555',
          },
          style: {
            stroke: '#555',
            strokeWidth: 1,
          },
          type: 'smoothstep',
        }}
      >
        <Controls />
        <Background variant={BackgroundVariant.Lines} gap={12} size={1} />
        <Panel>
          Nombre del archivo/diagrama (TODO)
        </Panel>
      </ReactFlow>
    </div>
  );
};

export default FlowContent; 