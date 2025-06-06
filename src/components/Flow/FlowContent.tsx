import React, { useRef, useState, useEffect, useContext, useCallback } from 'react';
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
  addEdge,
  Edge,
  ConnectionLineType,
  Connection,
  IsValidConnection,
  OnNodesChange,
  OnEdgesChange
} from '@xyflow/react';
import { SelectedNodeContext } from '../../context/SelectedNodeContext';
import { FlowInteractionContext } from '../../context/FlowInteractionContext';
import { useVariables } from '../../context/VariablesContext';
import { FlowNode, initialNodes, initialEdges, nodeTypes, edgeTypes } from './FlowTypes'; // This is your custom FlowNode
import { NodeBlock } from '../Toolbar/ToolbarTypes';
import ContextMenu from './ContextMenu';
import { useDnD } from '../../context/DnDContext';
import { useFlowExecutorState } from '../../context/FlowExecutorContext';
import { Expression, Variable } from '../../models';
import { decisionEdgeLabels } from './Nodes/Conditional';
import FilenameEditor from '../FilenameEditor';
import { useCollaboration } from '../../context/CollaborationContext';
import RemoteCursorsOverlay from './RemoteCursorsOverlay';
import * as Y from 'yjs';

// Define transaction origins
const SYNC_ORIGIN_NODES = 'local_nodes_sync';
const SYNC_ORIGIN_EDGES = 'local_edges_sync';
const SYNC_ORIGIN_INIT_NODES = 'local_init_nodes';
const SYNC_ORIGIN_INIT_EDGES = 'local_init_edges';
const SYNC_ORIGIN_VARIABLES = 'local_variables_sync';
const SYNC_ORIGIN_INIT_VARIABLES = 'local_init_variables';

const FlowContent: React.FC = () => {
  const [nodes, setNodes, onNodesChangeOriginal] = useNodesState<FlowNode>(initialNodes);
  const [edges, setEdges, onEdgesChangeOriginal] = useEdgesState<Edge>(initialEdges);
  const { ydoc, ySharedNodes, ySharedEdges, ySharedVariables, awareness, users } = useCollaboration();
  const { selectedNode, setSelectedNode } = useContext(SelectedNodeContext);
  const { variables, setVariables, deleteNodeVariables } = useVariables();
  const { 
    hoveredElement, 
    selectedElement, 
    setHoveredElement, 
    setSelectedElement,
    showContextMenu,
    hideContextMenu
  } = useContext(FlowInteractionContext);
  
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [DnDData, setDnDData] = useDnD();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const reactFlowInstance = useReactFlow();

  const reactFlowRef = useRef<HTMLDivElement>(null);

  // State to track edge being edited
  const [editingEdge, setEditingEdge] = useState<string | null>(null);

  // State to track code highlighting
  const [codeHighlightedVisualId, setCodeHighlightedVisualId] = useState<string | null>(null);

  // State to track alternatting pattern for conditional edge labels
  const [nextConditionalLabel, setNextConditionalLabel] = useState<number>(1); // Start with "Yes" (index 1)

  // State to track flow execution
  const { isRunning } = useFlowExecutorContext();

  // Ref to always have the latest selectedNode in async callbacks
  const selectedNodeRef = useRef<FlowNode | null>(selectedNode);
  useEffect(() => {
    selectedNodeRef.current = selectedNode;
  }, [selectedNode]);

  // TODO: possible problems when modifying node data from multiple places at the same time?
  
  // Assign sequential visual IDs to nodes
  useEffect(() => {
    setNodes((currentNodes) =>
      currentNodes.map((node, index) => {
        const visualId = `B${index + 1}`;
        if (node.data.visualId === visualId) return node;
        return { ...node, data: { ...node.data, visualId } };
      })
    );
  }, [nodes.length, setNodes]); // Re-run if the number of nodes changes

  // TODO: conditional edges cannot be created after being created, runned, etc

  useEffect(() => {
    // Handle code-to-diagram highlighting events
    const handleHighlightDiagramNode = (event: CustomEvent) => setCodeHighlightedVisualId(event.detail.visualId);
    const handleClearDiagramHighlight = () => setCodeHighlightedVisualId(null);
    const handleSelectDiagramNode = (event: CustomEvent) => {
      const targetNode = nodes.find(n => n.data.visualId === event.detail.visualId);
      if (targetNode) {
        setSelectedNode(targetNode);
        setSelectedElement({ id: targetNode.id, type: 'node' });
      }
    };
    window.addEventListener('highlightDiagramNode', handleHighlightDiagramNode as EventListener);
    window.addEventListener('clearDiagramHighlight', handleClearDiagramHighlight);
    window.addEventListener('selectDiagramNode', handleSelectDiagramNode as EventListener);
    return () => {
      window.removeEventListener('highlightDiagramNode', handleHighlightDiagramNode as EventListener);
      window.removeEventListener('clearDiagramHighlight', handleClearDiagramHighlight);
      window.removeEventListener('selectDiagramNode', handleSelectDiagramNode as EventListener);
    };
  }, [nodes, setSelectedNode, setSelectedElement]);

  useEffect(() => {
    // Apply visual styles
    setNodes(prevNodes => prevNodes.map(node => {
      const isHovered = hoveredElement?.id === node.id && hoveredElement.type === 'node';
      const isSelected = selectedElement?.id === node.id && selectedElement.type === 'node';
      const isCodeHighlighted = codeHighlightedVisualId === node.data.visualId;
      // Only create a new node object if any state changed
      if (node.data.isHovered === isHovered && node.data.isSelected === isSelected && node.data.isCodeHighlighted === isCodeHighlighted) return node;
      return { ...node, data: { ...node.data, isHovered, isSelected, isCodeHighlighted } };
    }));

    // Apply styles to edges
    setEdges(prevEdges => prevEdges.map(edge => {
      const isHovered = hoveredElement?.id === edge.id && hoveredElement.type === 'edge';
      const isSelected = selectedElement?.id === edge.id && selectedElement.type === 'edge';
      // Only create a new edge object if the hover/selection state changed
      if (edge.data?.isHovered === isHovered && edge.data?.isSelected === isSelected) return edge;
      return { ...edge, data: { ...edge.data, isHovered, isSelected } };
    }));
  }, [hoveredElement, selectedElement, codeHighlightedVisualId, setNodes, setEdges]);

  // Handle node selection
  const onNodeClick = (event: React.MouseEvent, node: FlowNode) => {
    // Prevent error propagation to avoid triggering onPaneClick
    event.stopPropagation();
    setSelectedNode(node);
    setSelectedElement({ id: node.id, type: 'node' });
    hideContextMenu();
  };

  // Handle edge selection
  const onEdgeClick = (event: React.MouseEvent, edge: Edge) => {
    // Prevent event propagation to avoid triggering onPaneClick
    event.stopPropagation();
    // Don't change selection when flow is running (TODO: this is done to avoid a maximum depth setState when right-clicking AssignVariable with 2 variables in right side)
    if (isRunning) return;
    setSelectedElement({ id: edge.id, type: 'edge' });
    hideContextMenu();
  };

  // Handle node/edge hover
  const onNodeMouseEnter = (_event: React.MouseEvent, node: FlowNode) => setHoveredElement({ id: node.id, type: 'node' });
  const onNodeMouseLeave = () => setHoveredElement(null);
  const onEdgeMouseEnter = (_event: React.MouseEvent, edge: Edge) => setHoveredElement({ id: edge.id, type: 'edge' });
  const onEdgeMouseLeave = () => setHoveredElement(null);

  const onSelectionContextMenu = (event: React.MouseEvent, selectedNodes: FlowNode[]) => {
    event.preventDefault();

    // Don't show context menu when flow is running (TODO: this is done to avoid a maximum depth setState when right-clicking AssignVariable with 2 variables in right side)
    if (isRunning) return;
    // Use viewport coordinates directly since ContextMenu is fixed positioned
    showContextMenu(event.clientX, event.clientY, selectedNodes.map(node => ({ id: node.id, type: 'node' })));
  };

  // Handle node/edge right-click (context menu)
  const onNodeContextMenu = (event: React.MouseEvent, node: FlowNode) => {
    event.preventDefault();
    // Don't show context menu when flow is running (TODO: this is done to avoid a maximum depth setState when right-clicking AssignVariable with 2 variables in right side)
    if (isRunning) return;
    setSelectedNode(node);
    setSelectedElement({ id: node.id, type: 'node' });
    // Use viewport coordinates directly since ContextMenu is fixed positioned
    showContextMenu(event.clientX, event.clientY, [{ id: node.id, type: 'node' }]);
  };

  const onEdgeContextMenu = (event: React.MouseEvent, edge: Edge) => {
    event.preventDefault();
    // Don't show context menu when flow is running (TODO: this is done to avoid a maximum depth setState when right-clicking AssignVariable with 2 variables in right side)
    if (isRunning) return;
    setSelectedElement({ id: edge.id, type: 'edge' });
    // Use viewport coordinates directly since ContextMenu is fixed positioned
    showContextMenu(event.clientX, event.clientY, [{ id: edge.id, type: 'edge' }]);
  };

  // Clear selection when clicking on the canvas
  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
    setSelectedElement(null);
    hideContextMenu();

    // Cancel edge editing
    if (editingEdge) {
      setEdges(prev => prev.map(e => e.id === editingEdge ? { ...e, data: { ...e.data, isEditing: false } } : e));
      setEditingEdge(null);
    }
  }, [hideContextMenu, setSelectedNode, setSelectedElement, editingEdge, setEdges]);

  // Handle mouse leave from ReactFlow area -> reset hover state and clear cursor
  const onMouseLeavePane = useCallback(() => {
    setHoveredElement(null);
    if (awareness) {
      awareness.setLocalStateField('cursor', null);
    }
  }, [setHoveredElement, awareness]);

  // Handle element deletion
  const onDelete = useCallback(
    (element: { id: string; type: 'node' | 'edge' }) => {
      if (isRunning) { console.warn('Cannot delete elements while flow is running'); return; } // TODO: handle this
      if (element.type === 'node') {
        const nodeToDelete = nodes.find(node => node.id === element.id);
        if (nodeToDelete?.type === 'DeclareVariable') {
          // Delete all variables associated with this node
          deleteNodeVariables(element.id);
        }
        onNodesChangeOriginal([{ type: 'remove', id: element.id }]);
      } else if (element.type === 'edge') {
        onEdgesChangeOriginal([{ type: 'remove', id: element.id }]);
      }
    },
    [isRunning, nodes, deleteNodeVariables, onNodesChangeOriginal, onEdgesChangeOriginal]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    // Only allow if valid block data to prevent unexpectedly cancelling drag events (e.g. handle drag)
    if (!DnDData) return;

    // Try to validate that this is a proper block drag from the toolbar
    try { JSON.parse(DnDData); } catch (e) { return; }
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    if (!isDraggingOver) { 
      setIsDraggingOver(true); 
      if (reactFlowRef.current) {
        reactFlowRef.current.classList.add('drop-target');
      }
    }
  }, [isDraggingOver, DnDData]);

  const onDragLeave = useCallback((event: React.DragEvent) => {
    const toElement = (event.nativeEvent as DragEvent).relatedTarget as HTMLElement | null;
    
    // Only remove the class if we're actually leaving the ReactFlow container
    // and not just entering a child element (e.g. a node)
    // If there's no target element (e.g. quickly dragging and dropping in the border of the canvas) 
      // OR the target element is outside our component
    if (reactFlowRef.current && (!toElement || !reactFlowRef.current.contains(toElement))) {
      setIsDraggingOver(false);
      reactFlowRef.current.classList.remove('drop-target');
    }
  }, [setIsDraggingOver]);
  
  const onDrop = useCallback((event: React.DragEvent) => {
    // Only allow if valid block data to prevent unexpectedly cancelling drag events (e.g. handle drag)
    if (!DnDData) { console.warn('No block data in drop'); return; }
    // Try to validate that this is a proper block drag from the toolbar
    let block: NodeBlock;
    try { 
      block = JSON.parse(DnDData) as NodeBlock;
      if (!block.nodeType || !block.label) { console.warn('Invalid block data in drop'); return; }
    } catch (e) { console.warn('Failed to parse drag data:', e); return; }

    // Don't allow creating new blocks when flow is running
    if (isRunning) { console.warn('Cannot create blocks while flow is running'); return; }
    event.preventDefault();
    setIsDraggingOver(false);
    if (reactFlowRef.current) {
      reactFlowRef.current.classList.remove('drop-target');
    }
    if (!reactFlowInstance || !reactFlowWrapper.current) { console.error('Missing elements for drop'); return; }
    
    // Limit the number of Start nodes to 1 at a time
    if (block.nodeType === 'Start' && nodes.some(node => node.type === 'Start')) {
      console.warn('Only one Start node is allowed'); return;
    }
    
    // Calculate position - screen to flow position
    const position = reactFlowInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY });
    const nodeWidth = block.defaultData?.width || 100;
    const nodeHeight = block.defaultData?.height || 40;
    // Adjust position to center the node at the cursor
    const centeredPosition = { x: position.x - nodeWidth / 2, y: position.y - nodeHeight / 2 };
    
    // Initialize expression for specific node types upon creation
    const newNodeData: FlowNode['data'] = { label: block.label, ...(block.defaultData || {}) };
    if (block.nodeType === 'Conditional') newNodeData.expression = new Expression([], [], '==').toObject();
    else if (block.nodeType === 'Output') newNodeData.expression = new Expression(undefined, []).toObject();

    // Create a new node with the centered position
    const newNode: FlowNode = {
      id: `${block.nodeType}-${Date.now()}`,
      type: block.nodeType === 'default' ? undefined : block.nodeType,
      position: centeredPosition,
      data: newNodeData,
    };
    onNodesChangeOriginal([{ type: 'add', item: newNode }]);
    setDnDData(null);
  }, [reactFlowInstance, nodes, setIsDraggingOver, DnDData, isRunning, onNodesChangeOriginal, setDnDData]);

  const onConnect = (params: Connection | Edge) => {    
    setEdges(eds => {
      const sourceNode = nodes.find(node => node.id === params.source);
      // Create a copy of current edges
      let newEdges = [...eds];
            
      // For conditional nodes, limit to 2 outgoing edges (True/Yes and False/No)
      if (sourceNode?.type === 'Conditional') {
        const existingOutgoingEdges = newEdges.filter(edge => edge.source === params.source);
        
        // If already has 2 edges, don't allow more connections (not even replace) [TODO: consistency with non-conditional nodes?]
        if (existingOutgoingEdges.length >= 2) return newEdges;
        
        // Determine label for new edge based on existing edges
        const hasYesEdge = existingOutgoingEdges.some(edge => edge.data?.conditionalLabel === decisionEdgeLabels[1]);
        const hasNoEdge = existingOutgoingEdges.some(edge => edge.data?.conditionalLabel === decisionEdgeLabels[0]);
        let newEdgeLabel = '';
        if (!hasYesEdge && !hasNoEdge) {
          // If no yes nor no edge, set the label as the next in an alternating pattern (yes, no, yes, no...)
          // TODO: this toggling affects all the conditional nodes, not just the one that is being created (but its not critical)
          newEdgeLabel = decisionEdgeLabels[nextConditionalLabel];
          setNextConditionalLabel(newEdgeLabel === decisionEdgeLabels[0] ? 1 : 0);
        } else {
          newEdgeLabel = hasYesEdge ? decisionEdgeLabels[0] : decisionEdgeLabels[1];
        }
        const existingData = ('data' in params && params.data) ? params.data : {};
        const newEdgeParams = { ...params, data: { ...existingData, conditionalLabel: newEdgeLabel } };
        return addEdge(newEdgeParams, newEdges);
      } else {
        // For every node except Conditional, limit the number of outgoing edges to 1
        newEdges = newEdges.filter(edge => edge.source !== params.source);
        return addEdge(params, newEdges);
      }
    });
  };

  // Prevent default context menu
  const handleContextMenuPane = useCallback((event: React.MouseEvent) => event.preventDefault(), []);

  // Handle edge double-click
  const onEdgeDoubleClick = useCallback((event: React.MouseEvent, edge: Edge) => {
    event.stopPropagation();
    // Don't allow editing when flow is running (TODO: this is done to avoid a maximum depth setState when right-clicking AssignVariable with 2 variables in right side)
    if (isRunning) return;
    setEditingEdge(edge.id);
    setSelectedElement({ id: edge.id, type: 'edge' });
  }, [setSelectedElement, isRunning]);
  
  // Handle edge label changes
  useEffect(() => {
    const handleLabelChange = (event: CustomEvent) => {
      const { id, label } = event.detail;
      setEdges(eds => eds.map(e => e.id === id ? { ...e, data: { ...e.data, label, isEditing: false }, label } : e));
      setEditingEdge(null);
    };
    document.addEventListener('edge:labelChanged' as any, handleLabelChange as EventListener);
    return () => document.removeEventListener('edge:labelChanged' as any, handleLabelChange as EventListener);
  }, [setEdges]);
  
  // Update edge data for editing state
  useEffect(() => {
    if (editingEdge) {
      setEdges(prev => prev.map(e => e.id === editingEdge ? { ...e, data: { ...e.data, isEditing: true } } : e));
    }
  }, [editingEdge, setEdges]);

  // Handle nodes deleted by keyboard or other means
  const onNodesDeleteReactFlow = useCallback((deletedNodes: Node[]) => {
    // Clean up variables for any DeclareVariable nodes
    deletedNodes.forEach(node => {
      const localNode = nodes.find(n => n.id === node.id);
      if (localNode && localNode.type === 'DeclareVariable') {
        deleteNodeVariables(localNode.id);
      }
    });
    
    // Clear selection if the selected node was deleted
    if (selectedElement?.type === 'node' && deletedNodes.some(node => node.id === selectedElement.id)) {
      setSelectedNode(null);
      setSelectedElement(null);
    }
  }, [deleteNodeVariables, selectedElement, setSelectedNode, setSelectedElement, nodes]);

  // Yjs -> Local state (Nodes)
  useEffect(() => {
    if (!ySharedNodes || !ydoc) return;

    const handleRemoteNodeChanges = () => {
      // Build array of FlowNode from Yjs shared nodes
      const yNodesArray = Array.from(ySharedNodes.values()).map(n => {
        const nodeCopy: Partial<FlowNode> = { ...n, data: { ...n.data } };

        if (!nodeCopy.data!.label && n.type !== 'default') nodeCopy.data!.label = n.type || 'Unknown';
        if (nodeCopy.data && nodeCopy.data.expression && typeof nodeCopy.data.expression === 'object') {
          try {
            const expressionObj = JSON.parse(JSON.stringify(nodeCopy.data.expression));
            nodeCopy.data.expression = Expression.fromObject(expressionObj).toObject();
          } catch (e) { console.error("Error deserializing node expr from Yjs:", n.id, e); nodeCopy.data.expression = null; }
        }
        delete nodeCopy.data!.isSelected; delete nodeCopy.data!.isHovered; delete nodeCopy.data!.isCodeHighlighted;
        return nodeCopy as FlowNode;
      });
      // Update local nodes state
      setNodes(yNodesArray);
      // If a node is currently selected, update it to reflect remote changes
      const current = selectedNodeRef.current;
      if (current) {
        const remoteNode = yNodesArray.find(fn => fn.id === current.id);
        setSelectedNode(remoteNode || null);
      }
    };

    const observer = (_events: any[], transaction: Y.Transaction) => {
      if (transaction.origin === SYNC_ORIGIN_NODES || transaction.origin === SYNC_ORIGIN_INIT_NODES) return;
      handleRemoteNodeChanges();
    };

    ySharedNodes.observeDeep(observer);
    if (ySharedNodes.size > 0) {
      handleRemoteNodeChanges();
    } else if (initialNodes.length > 0) {
      // Initial push of default nodes to Yjs
      ydoc.transact(() => {
        initialNodes.forEach(node => {
          const nodeToSync = JSON.parse(JSON.stringify(node));

          if (node.data.expression instanceof Expression) nodeToSync.data.expression = node.data.expression.toObject();
          else if (typeof node.data.expression?.toObject === 'function') nodeToSync.data.expression = node.data.expression.toObject();
          delete nodeToSync.data.isSelected; delete nodeToSync.data.isHovered; delete nodeToSync.data.isCodeHighlighted;
          ySharedNodes.set(node.id, nodeToSync);
        });
      }, SYNC_ORIGIN_INIT_NODES);
    }

    return () => ySharedNodes.unobserveDeep(observer);
  }, [ySharedNodes, ydoc, setNodes, setSelectedNode]);

  // Yjs -> Local state (Edges)
  useEffect(() => {
    if (!ySharedEdges || !ydoc) return;

    const handleRemoteEdgeChanges = () => {
      const yEdgesArray = Array.from(ySharedEdges.values()).map(e => {
        const edgeCopy = { ...e, data: { ...e.data } };
        delete edgeCopy.data?.isSelected; delete edgeCopy.data?.isHovered;
        return edgeCopy as Edge;
      });
      setEdges(yEdgesArray);
    };

    const observer = (_events: any[], transaction: Y.Transaction) => {
      if (transaction.origin === SYNC_ORIGIN_EDGES || transaction.origin === SYNC_ORIGIN_INIT_EDGES) return;
      handleRemoteEdgeChanges();
    };

    ySharedEdges.observeDeep(observer);
    if (ySharedEdges.size > 0) {
      handleRemoteEdgeChanges();
    } else if (initialEdges.length > 0) {
      // Initial push of default edges to Yjs
      ydoc.transact(() => {
        initialEdges.forEach(edge => {
          const edgeToSync = JSON.parse(JSON.stringify(edge));
          delete edgeToSync.data?.isSelected; delete edgeToSync.data?.isHovered;
          ySharedEdges.set(edge.id, edgeToSync);
        });
      }, SYNC_ORIGIN_INIT_EDGES);
    }

    return () => ySharedEdges.unobserveDeep(observer);
  }, [ySharedEdges, ydoc, setEdges]);

  // Yjs -> Local state (Variables)
  useEffect(() => {
    if (!ySharedVariables || !ydoc) return;

    const handleRemoteVariableChanges = () => {
      const yVariablesArray = Array.from(ySharedVariables.values());
      const newVariables = yVariablesArray.map(varData => Variable.fromObject(varData));
      setVariables(newVariables);
    };

    const observer = (_events: any[], transaction: Y.Transaction) => {
      if (transaction.origin === SYNC_ORIGIN_VARIABLES || transaction.origin === SYNC_ORIGIN_INIT_VARIABLES) return;
      handleRemoteVariableChanges();
    };

    ySharedVariables.observeDeep(observer);
    
    if (ySharedVariables.size > 0) {
      handleRemoteVariableChanges();
    }

    return () => ySharedVariables.unobserveDeep(observer);
  }, [ySharedVariables, ydoc, setVariables]);

  // Local `nodes` state -> Yjs
  const isNodesInitialized = useRef(false);
  useEffect(() => {
    if (!ydoc || !ySharedNodes) return;

    if (!isNodesInitialized.current) {
      if(ySharedNodes.size > 0 || (nodes.length > 0 && nodes !== initialNodes)) isNodesInitialized.current = true;
      else if (nodes === initialNodes && ySharedNodes.size === 0) isNodesInitialized.current = true;
    }

    if (!isNodesInitialized.current && !(nodes.length === 0 && initialNodes.length === 0)) return;
    
    if (nodes === initialNodes && ySharedNodes.size > 0) return; 

    ydoc.transact(() => {
      const localNodeIds = new Set(nodes.map(n => n.id));
      Array.from(ySharedNodes.keys()).forEach(yjsNodeId => {
        if (!localNodeIds.has(yjsNodeId as string)) ySharedNodes.delete(yjsNodeId as string);
      });

      nodes.forEach(node => {
        const nodeToSync = JSON.parse(JSON.stringify(node));
        if (node.data.expression instanceof Expression) nodeToSync.data.expression = node.data.expression.toObject();
        else if (typeof node.data.expression?.toObject === 'function') nodeToSync.data.expression = node.data.expression.toObject();
        delete nodeToSync.data.isSelected; delete nodeToSync.data.isHovered; delete nodeToSync.data.isCodeHighlighted;
        
        const yNode = ySharedNodes.get(node.id);
        if (!yNode || JSON.stringify(yNode) !== JSON.stringify(nodeToSync)) ySharedNodes.set(node.id, nodeToSync);
      });
    }, SYNC_ORIGIN_NODES);
  }, [nodes, ydoc, ySharedNodes, initialNodes]);

  // Local `edges` state -> Yjs
  const isEdgesInitialized = useRef(false);
  useEffect(() => {
    if (!ydoc || !ySharedEdges) return;

    if (!isEdgesInitialized.current) {
      if(ySharedEdges.size > 0 || (edges.length > 0 && edges !== initialEdges)) isEdgesInitialized.current = true;
      else if (edges === initialEdges && ySharedEdges.size === 0) isEdgesInitialized.current = true;
    }

    if(!isEdgesInitialized.current && !(edges.length === 0 && initialEdges.length === 0)) return;

    if (edges === initialEdges && ySharedEdges.size > 0) return;

    ydoc.transact(() => {
      const localEdgeIds = new Set(edges.map(e => e.id));
      Array.from(ySharedEdges.keys()).forEach(yjsEdgeId => {
        if (!localEdgeIds.has(yjsEdgeId as string)) ySharedEdges.delete(yjsEdgeId as string);
      });

      edges.forEach(edge => {
        const edgeToSync = JSON.parse(JSON.stringify(edge));
        delete edgeToSync.data?.isSelected; delete edgeToSync.data?.isHovered;
        
        const yEdge = ySharedEdges.get(edge.id);
        if (!yEdge || JSON.stringify(yEdge) !== JSON.stringify(edgeToSync)) ySharedEdges.set(edge.id, edgeToSync);
      });
    }, SYNC_ORIGIN_EDGES);
  }, [edges, ydoc, ySharedEdges, initialEdges]);

  // Local `variables` state -> Yjs
  const isVariablesInitialized = useRef(false);
  useEffect(() => {
    if (!ydoc || !ySharedVariables) return;

    if (!isVariablesInitialized.current) {
      if(ySharedVariables.size > 0 || variables.length > 0) {
        isVariablesInitialized.current = true;
      }
    }

    if (!isVariablesInitialized.current) return;
    
    ydoc.transact(() => {
      const localVariableIds = new Set(variables.map(v => v.id));
      Array.from(ySharedVariables.keys()).forEach(yjsVarId => {
        if (!localVariableIds.has(yjsVarId as string)) ySharedVariables.delete(yjsVarId as string);
      });

      variables.forEach(variable => {
        const variableToSync = variable.toObject();
        const yVar = ySharedVariables.get(variable.id);
        if (!yVar || JSON.stringify(yVar) !== JSON.stringify(variableToSync)) {
          ySharedVariables.set(variable.id, variableToSync);
        }
      });
    }, SYNC_ORIGIN_VARIABLES);
  }, [variables, ydoc, ySharedVariables]);

  // Update expressions when variables change
  useEffect(() => {
    const needsUpdate = nodes.some(node => 
      ((node.type === 'AssignVariable' || node.type === 'Conditional' || node.type === 'Output') && node.data.expression) ||
      (node.type === 'Input' && node.data.variable)
    );

    if (!needsUpdate) return;

    setNodes(prevNodes => prevNodes.map(node => {
      if ((node.type === 'AssignVariable' || node.type === 'Conditional' || node.type === 'Output') && node.data.expression) {
        try {
          const currentExprData = (node.data.expression instanceof Expression)
            ? node.data.expression.toObject()
            : JSON.parse(JSON.stringify(node.data.expression));
          const expression = Expression.fromObject(currentExprData);
          expression.updateVariables(variables);

          return { ...node, data: { ...node.data, expression: expression.toObject() } };
        } catch {
          return { ...node, data: { ...node.data, expression: null } };
        }
      } else if (node.type === 'Input' && node.data.variable) {
        const updatedVariable = variables.find(v => v.id === node.data.variable?.id);
        return { ...node, data: { ...node.data, variable: updatedVariable ? JSON.parse(JSON.stringify(updatedVariable)) : undefined } };
      }

      return node;
    }));
  }, [variables, setNodes]);

  const isValidConnectionCheck: IsValidConnection = useCallback(
    (connection: Connection | Edge) => {
      // TODO: allow self-connections for while True on the same
      // careful with which type, e.g. conditional (then not?)
      // Prevent self-connections (a node connecting to itself)
      if (connection.source === connection.target) return false;
      const sourceNode = nodes.find(node => node.id === connection.source);
      if (sourceNode?.type === 'Conditional') {
        const existingEdgesFromHandle = edges.filter(e => e.source === connection.source && e.sourceHandle === connection.sourceHandle);
        // Only for the case of Conditional nodes (as dragging a new edge from a handle if there are already Yes/No wont create a new edge, per onConnect)
      // If there's already an edge from this specific handle, prevent another one (1 outgoing edge per handle Yes/No to prevent label confusion and follow standard)
        if (existingEdgesFromHandle.length > 0) return false;
      }
      return true;
    }, [nodes, edges]
  );
  
  const onMouseMoveCollab = useCallback((event: React.MouseEvent) => {
    if (awareness && reactFlowWrapper.current && reactFlowInstance) {
      const flowPosition = reactFlowInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY });
      awareness.setLocalStateField('cursor', flowPosition);
    }
  }, [awareness, reactFlowInstance]);

  // New handler for updating cursor during node drag
  const onNodeDragCollab = useCallback((event: React.MouseEvent, _node: Node) => {
    if (awareness && reactFlowWrapper.current && reactFlowInstance) {
      const flowPosition = reactFlowInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY });
      awareness.setLocalStateField('cursor', flowPosition);
    }
  }, [awareness, reactFlowInstance]);

  const onNodesChangeHandler: OnNodesChange<FlowNode> = onNodesChangeOriginal;
  const onEdgesChangeHandler: OnEdgesChange = onEdgesChangeOriginal;

  return (
    <div 
      className="reactflow-wrapper" 
      ref={reactFlowWrapper} 
      style={{ position: 'relative', width: '100%', height: '100%', userSelect: 'none' }}
      onMouseMove={onMouseMoveCollab}
      onMouseLeave={onMouseLeavePane}
      onContextMenu={handleContextMenuPane}
    >
      <ReactFlow
        ref={reactFlowRef}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChangeHandler}
        onEdgesChange={onEdgesChangeHandler}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onEdgeDoubleClick={onEdgeDoubleClick}
        onNodeMouseEnter={onNodeMouseEnter}
        onNodeMouseLeave={onNodeMouseLeave}
        onEdgeMouseEnter={onEdgeMouseEnter}
        onEdgeMouseLeave={onEdgeMouseLeave}
        onSelectionContextMenu={onSelectionContextMenu}
        onNodeContextMenu={onNodeContextMenu}
        onEdgeContextMenu={onEdgeContextMenu}
        onPaneClick={onPaneClick}
        onConnect={onConnect}
        onNodesDelete={onNodesDeleteReactFlow}
        onNodeDrag={onNodeDragCollab}
        connectionLineType={ConnectionLineType.SmoothStep}
        isValidConnection={isValidConnectionCheck}
        fitView
        proOptions={{ hideAttribution: true }}
        deleteKeyCode={["Backspace", "Delete"]}
        defaultEdgeOptions={{ type: 'Flowline' }}
          // TODO: check this for draw.io similar behavior with edges https://stackoverflow.com/questions/77831116/is-it-possible-to-shape-reactflow-edges-by-dragging-them
          // ==> https://codesandbox.io/p/sandbox/floral-framework-forked-2ytjqc

          // TODO: animated + color change edge when running
          // check: https://reactflow.dev/examples/edges/animating-edges
          // https://reactflow.dev/components/edges/animated-svg-edge

          // also check:
          // https://reactflow.dev/examples/interaction/drag-and-drop for drag and drop (same as current?)
          // https://reactflow.dev/examples/interaction/interaction-props for interaction props
          // https://reactflow.dev/examples/interaction/save-and-restore for save and restore
          // https://reactflow.dev/examples/interaction/touch-device for mobile
          // https://reactflow.dev/examples/interaction/prevent-cycles for cycle/while checking
          // https://reactflow.dev/examples/interaction/zoom-transitions for zoom transitions while executing

          // https://reactflow.dev/api-reference/react-flow#selection-events for selection events (same as current?)

          // https://reactflow.dev/examples/interaction/collaborative for collaborative (with yjs)

          // implement floating edges?
          // => https://reactflow.dev/examples/edges/floating-edges

          // TODO: exactly 1 start node and at least 1 end node (checking when designing or in execute-time?)

          // User manual: SHIFT + click (drag) to select zone for multi-select; CTRL + click to select multiple nodes/edges
          // TODO: node type 'group' for functions

          // check this (overview of all the features): https://reactflow.dev/examples/overview

          // TODO FlowExecution: Component for it, startingNode, .next, Start(), BFS/DFS, check all edges in current node..., pass variables to next node as props... (?) [what do we care about as (previous) data in the current node?] 
          //                      lock Flow (just like the little button does) to prevent modifying the diagram while executing
          //                      update edge that is being used to go to next node to animated and/or colored
          //                      generally, are nodes allowed to have a single outgoing edge or multiple? e.g. DeclareVariable with a single or multiple outgoing edges? e.g. Condition does have 2 outgoing edges
          //                        only one outgoing edge for normal blocks (except conditional/decision block)
          //                        multiple incoming edges allowed (edges coming from multiple conditionals (or merging from both paths from the same conditional), loops, code reuse, etc)


          // TODO: copy and paste + cut nodes



          // TODO: dropzone expression doesnt have drop styling if dragging over an element

          // TODO: for some reason, when edge animation, the edge changes slightly
          // (check /bug screenshots)
          // actually, its not that it changes when the edge is animated, but Screenshot_1 the edge intially had a weird path, so the animation
          // re-rendered it (?)



          // TODO: check getNodesBounds() and getViewportForBounds() in the case of importing a flow (setup zoom, viewport, etc)
          // https://reactflow.dev/api-reference/utils/get-nodes-bounds
          // https://reactflow.dev/api-reference/utils/get-viewport-for-bounds



          // TODO: check Node.measure?.width, .height and Node.width, .height
          // (actually doesnt make sense because so far we only need width/height for CREATING it, and obviusly we cannot get it before it exists)
          // thats why we need the defaultData width and height (and also for some configuration/personalization)


          // TODO: checkout ReactFlowInstance.getNodeConnections that returns NodeConnection[] with edgeId and source/target and source/targetHandle


          // TODO: check https://reactflow.dev/examples/nodes/add-node-on-edge-drop
          // https://reactflow.dev/examples/nodes/easy-connect


          // TODO: disable adding blocks to flow when executing
          

          // TODO: disable edge creation when executing

          // TODO: handle float correctly in AssignVariable

          // TODO: are variables (normal) being resetted correctly?

          // (should be fixed now by using ReactFlow drag & drop events)
          // TODO: bug - sometimes when dragging a node handle, it appears like you were dragging a block from toolbar and you kind of "drag" what you copied
          //        it is fixed by reloading web page
          /*        it happens when you drag a block node from the toolbar to the flow but it isnt added?

          Direct drop event received data: 

          FlowContent.tsx:301 Error creating node in direct drop: SyntaxError: Unexpected end of JSON input
              at JSON.parse (<anonymous>)
              at HTMLDivElement.handleDirectDrop (FlowContent.tsx:268:28)

          */



          // TODO: Yes/No labels in arrows are in the contrary side (Conditional, get 2 arrows from below to each side; same with from side to up and down)
          // ===> NO! it is correct. but Yes/No labels must come from DIFFERENT handles
          // cannot use the same handle for both (this should apply also for other nodes connections)



          // TODO: BUG with Conditional edges -> add both, remove one, cannot get a new one?

          // TODO: refactor flowline Yes/No to have 0-1 data instead of relying on a label which may change with language

          // TODO: change Yes/No labels in Conditional edges for one-one instead of random 50%
          
          // TODO: cannot move draggable elements in expression builder if its >= 2 lines height (only horizontally)

          // Timer: https://www.timeanddate.com/countdown/generic?iso=20250616T12&p0=%3A&font=cursive
      >
        <Controls />
        <Background variant={BackgroundVariant.Lines} gap={12} size={1} />
        <Panel style={{ userSelect: 'none' }}> {/* prevent text selection when double clicking on edge */}
          <FilenameEditor />
        </Panel>

        {/* Render remote cursors overlay */}
        <RemoteCursorsOverlay reactFlowWrapper={reactFlowWrapper} />
      </ReactFlow>
      <ContextMenu onDelete={onDelete} />
    </div>
  );
};

export default FlowContent; 