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
  Edge
} from '@xyflow/react';
import { SelectedNodeContext } from '../../context/SelectedNodeContext';
import { FlowNode, initialNodes, initialEdges } from './FlowTypes';
import { NodeBlock } from '../Toolbar/ToolbarTypes';

const FlowContent: React.FC = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
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
      
      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
      
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
        
        if (block.type !== 'node') {
          console.error('Dropped item is not a node block');
          return;
        }
        
        // Get the position where the node should be created
        const position = reactFlowInstance.screenToFlowPosition({
          x: dragEvent.clientX - reactFlowBounds.left,
          y: dragEvent.clientY - reactFlowBounds.top,
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

  return (
    <div 
      className="reactflow-wrapper" 
      ref={reactFlowWrapper} 
      style={{ width: '100%', height: '100%' }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Controls />
        <Background variant={BackgroundVariant.Lines} gap={12} size={1} />
      </ReactFlow>
    </div>
  );
};

export default FlowContent; 