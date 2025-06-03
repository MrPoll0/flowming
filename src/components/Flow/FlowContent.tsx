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
  IsValidConnection
} from '@xyflow/react';
import { SelectedNodeContext } from '../../context/SelectedNodeContext';
import { FlowInteractionContext } from '../../context/FlowInteractionContext';
import { useVariables } from '../../context/VariablesContext';
import { FlowNode, initialNodes, initialEdges, nodeTypes, edgeTypes } from './FlowTypes';
import { NodeBlock } from '../Toolbar/ToolbarTypes';
import ContextMenu from './ContextMenu';
import { useDnD } from '../../context/DnDContext';
import { useFlowExecutorContext } from '../../context/FlowExecutorContext';
import { Expression } from '../../models';
import { decisionEdgeLabels } from './Nodes/Conditional';

const FlowContent: React.FC = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const { setSelectedNode } = useContext(SelectedNodeContext);
  const { variables, deleteNodeVariables } = useVariables();
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

  // Add state to track edge being edited
  const [editingEdge, setEditingEdge] = useState<string | null>(null);
  
  // Add state to track code highlighting
  const [codeHighlightedVisualId, setCodeHighlightedVisualId] = useState<string | null>(null);

  // Add state to track alternating pattern for conditional edge labels
  const [nextConditionalLabel, setNextConditionalLabel] = useState<number>(1); // Start with "Yes" (index 1)

  const { isRunning } = useFlowExecutorContext();

  // TODO: possible problems when modifying node data from multiple places at the same time?

  // Assign sequential visual IDs to nodes
  useEffect(() => {
    setNodes((currentNodes) =>
      currentNodes.map((node, index) => {
        const visualId = `B${index + 1}`;
        if (node.data.visualId === visualId) {
          return node; // Avoid re-render if ID is already correct
        }
        return {
          ...node,
          data: {
            ...node.data,
            visualId,
          },
        };
      })
    );
  }, [nodes.length, setNodes]); // Re-run if the number of nodes changes

  // TODO: conditional edges cannot be created after being created, runned, etc

  useEffect(() => {
    // Handle code-to-diagram highlighting events

    const handleHighlightDiagramNode = (event: CustomEvent) => {
      const { visualId } = event.detail;
      setCodeHighlightedVisualId(visualId);
    };

    const handleClearDiagramHighlight = () => {
      setCodeHighlightedVisualId(null);
    };

    const handleSelectDiagramNode = (event: CustomEvent) => {
      const { visualId } = event.detail;
      // Find node by visualId and select it
      const targetNode = nodes.find(n => n.data.visualId === visualId);
      if (targetNode) {
        // Set selected node in context
        setSelectedNode(targetNode as FlowNode);
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
  }, [nodes]);

  useEffect(() => {
    // Apply visual styles based on hover, selection, and code highlighting states
    setNodes((prevNodes) => 
      prevNodes.map((node) => {
        const isHovered = hoveredElement?.id === node.id && hoveredElement?.type === 'node';
        const isSelected = selectedElement?.id === node.id && selectedElement?.type === 'node';
        const isCodeHighlighted = codeHighlightedVisualId === node.data.visualId;
        
        // Only create a new node object if any state changed
        if (node.data.isHovered === isHovered && 
            node.data.isSelected === isSelected && 
            node.data.isCodeHighlighted === isCodeHighlighted) {
          return node; // Return the existing node if no changes
        }
        
        return {
          ...node,
          data: {
            ...node.data,
            isHovered,
            isSelected,
            isCodeHighlighted,
          },
        };
      })
    );

    // Apply styles to edges
    setEdges((prevEdges) => 
      prevEdges.map((edge) => {
        const isHovered = hoveredElement?.id === edge.id && hoveredElement?.type === 'edge';
        const isSelected = selectedElement?.id === edge.id && selectedElement?.type === 'edge';

        // Only create a new edge object if the hover/selection state changed
        if (edge.data?.isHovered === isHovered && edge.data?.isSelected === isSelected) {
          return edge; // Return the existing edge if no changes
        }

        return {
          ...edge,
          data: {
            ...edge.data,
            isHovered,
            isSelected,
          },
        };
      })
    );
  }, [hoveredElement, selectedElement, codeHighlightedVisualId]);

  // Handle node selection
  const onNodeClick = (event: React.MouseEvent, node: Node) => {
    // Prevent event propagation to avoid triggering onPaneClick
    event.stopPropagation();
    
    // Don't change selection when flow is running (TODO: this is done to avoid a maximum depth setState when right-clicking AssignVariable with 2 variables in right side)
    if (isRunning) {
      return;
    }
    
    setSelectedNode(node as FlowNode);
    setSelectedElement({ id: node.id, type: 'node' });
    hideContextMenu();
  };

  // Handle edge selection
  const onEdgeClick = (event: React.MouseEvent, edge: Edge) => {
    // Prevent event propagation to avoid triggering onPaneClick
    event.stopPropagation();
    
    // Don't change selection when flow is running (TODO: this is done to avoid a maximum depth setState when right-clicking AssignVariable with 2 variables in right side)
    if (isRunning) {
      return;
    }
    
    setSelectedElement({ id: edge.id, type: 'edge' });
    hideContextMenu();
  };

  // Handle node/edge hover
  const onNodeMouseEnter = (__event: React.MouseEvent, node: Node) => {
    setHoveredElement({ id: node.id, type: 'node' });
  };

  const onNodeMouseLeave = () => {
    setHoveredElement(null);
  };

  const onEdgeMouseEnter = (__event: React.MouseEvent, edge: Edge) => {
    setHoveredElement({ id: edge.id, type: 'edge' });
  };

  const onEdgeMouseLeave = () => {
    setHoveredElement(null);
  };

  const onSelectionContextMenu = (event: React.MouseEvent, nodes: Node[]) => {
    event.preventDefault();

    // Don't show context menu when flow is running (TODO: this is done to avoid a maximum depth setState when right-clicking AssignVariable with 2 variables in right side)
    if (isRunning) {
      console.warn('Cannot show context menu while the flow is running');
      return;
    }

    // Use viewport coordinates directly since ContextMenu is fixed positioned
    const x = event.clientX;
    const y = event.clientY;

    showContextMenu(x, y, nodes.map(node => ({ id: node.id, type: 'node' })));
  };

  // Handle node/edge right-click (context menu)
  const onNodeContextMenu = (event: React.MouseEvent, node: Node) => {
    // Prevent the default context menu
    event.preventDefault();
    
    // Don't show context menu when flow is running (TODO: this is done to avoid a maximum depth setState when right-clicking AssignVariable with 2 variables in right side)
    if (isRunning) {
      console.warn('Cannot show context menu while the flow is running');
      return;
    }
    
    // Select the node (same as in onNodeClick)
    setSelectedNode(node as FlowNode);
    setSelectedElement({ id: node.id, type: 'node' });
    
    // Use viewport coordinates directly since ContextMenu is fixed positioned
    const x = event.clientX;
    const y = event.clientY;
    
    showContextMenu(x, y, [{ id: node.id, type: 'node' }]);
  };

  const onEdgeContextMenu = (event: React.MouseEvent, edge: Edge) => {
    // Prevent the default context menu
    event.preventDefault();
    
    // Don't show context menu when flow is running (TODO: this is done to avoid a maximum depth setState when right-clicking AssignVariable with 2 variables in right side)
    if (isRunning) {
      console.warn('Cannot show context menu while the flow is running');
      return;
    }
    
    // Select the edge (same as in onEdgeClick)
    setSelectedElement({ id: edge.id, type: 'edge' });
    
    // Use viewport coordinates directly since ContextMenu is fixed positioned
    const x = event.clientX;
    const y = event.clientY;
    
    showContextMenu(x, y, [{ id: edge.id, type: 'edge' }]);
  };

  // Clear selection when clicking on the canvas
  const onPaneClick = useCallback((__event: React.MouseEvent) => {
    setSelectedNode(null);
    setSelectedElement(null);
    hideContextMenu();
    
    // Cancel edge editing
    if (editingEdge) {
      setEdges((prevEdges) => 
        prevEdges.map((edge) => {
          if (edge.id === editingEdge) {
            return {
              ...edge,
              data: {
                ...edge.data,
                isEditing: false
              }
            };
          }
          return edge;
        })
      );
      setEditingEdge(null);
    }
  }, [hideContextMenu, setSelectedNode, setSelectedElement, editingEdge, setEdges]);

  // Handle mouse leave from ReactFlow area
  const onMouseLeave = useCallback(() => {
    // Reset hover state when mouse leaves the flow area
    setHoveredElement(null);
  }, [setHoveredElement]);

  // Handle element deletion
  const onDelete = useCallback(
    (element: { id: string; type: 'node' | 'edge' }) => {
      if (isRunning) {
        console.warn('Cannot delete elements while the flow is running'); // TOOD: handle this?
        return;
      }

      if (element.type === 'node') {
        // Find the node to check its type
        const nodeToDelete = nodes.find(node => node.id === element.id);
        if (nodeToDelete && nodeToDelete.type === 'DeclareVariable') {
          // Delete all variables associated with this node
          deleteNodeVariables(element.id);
        }
        
        // Delete node and connected edges
        setNodes((nodes) => nodes.filter((node) => node.id !== element.id));
      } else if (element.type === 'edge') {
        // Delete edge
        setEdges((edges) => edges.filter((edge) => edge.id !== element.id));
      }
    },
    [setNodes, setEdges, nodes, deleteNodeVariables]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    // Only allow if valid block data to prevent unexpectedly cancelling drag events (e.g. handle drag)
    if (!DnDData) {
      console.warn('No block data received in drag over');
      return;
    }

    // Try to validate that this is a proper block drag from the toolbar
    try {
      const parsedData = JSON.parse(DnDData);
      if (!parsedData.nodeType || !parsedData.label) {
        console.warn('Invalid block data in drag over');
        return;
      }
    } catch (e) {
      console.warn('Failed to parse drag data:', e);
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    
    if (!isDraggingOver) {
      setIsDraggingOver(true);
      if (reactFlowRef.current) {
        reactFlowRef.current.classList.add('drop-target');
      }
    }
  }, [isDraggingOver, setIsDraggingOver, DnDData]);

  const onDragLeave = useCallback((event: React.DragEvent) => {
    // Don't immediately remove the class - check if we're leaving to a child element
    const dragLeaveEvent = event.nativeEvent as DragEvent;
    const toElement = dragLeaveEvent.relatedTarget as HTMLElement | null;
    
    // Only remove the class if we're actually leaving the ReactFlow container
    // and not just entering a child element (e.g. a node)
    if (reactFlowRef.current) {
      // If there's no target element (e.g. quickly dragging and dropping in the border of the canvas) 
      // OR the target element is outside our component
      if (!toElement || !reactFlowRef.current.contains(toElement)) {
        setIsDraggingOver(false);
        reactFlowRef.current.classList.remove('drop-target');
      }
    }
  }, [setIsDraggingOver]);
  
  const onDrop = useCallback((event: React.DragEvent) => {
    // Only allow if valid block data to prevent unexpectedly cancelling drag events (e.g. handle drag)
    if (!DnDData) {
      console.warn('No block data received in drop');
      return;
    }

    // Try to validate that this is a proper block drag from the toolbar
    try {
      const parsedData = JSON.parse(DnDData);
      if (!parsedData.nodeType || !parsedData.label) {
        console.warn('Invalid block data in drop');
        return;
      }
    } catch (e) {
      console.warn('Failed to parse drag data:', e);
      return;
    }

    event.preventDefault();
    
    setIsDraggingOver(false);
    if (reactFlowRef.current) {
      reactFlowRef.current.classList.remove('drop-target');
    }
    
    if (!reactFlowInstance || !reactFlowWrapper.current) {
      console.error('Missing required elements for drop');
      return;
    }
  
    try {
      const block = JSON.parse(DnDData) as NodeBlock;
      
      // Limit the number of Start nodes to 1 at a time
      if (block.nodeType === 'Start' && nodes.some(node => node.type === 'Start')) {
        console.warn('Only one Start node is allowed');
        return;
      }
      
      // Calculate position - screen to flow position
      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      
      const nodeWidth = block.defaultData?.width || 100;
      const nodeHeight = block.defaultData?.height || 40;
      
      // Adjust position to center the node at the cursor
      const centeredPosition = {
        x: position.x - nodeWidth / 2,
        y: position.y - nodeHeight / 2
      };
      
      // Create a new node with the centered position
      const newNode: FlowNode = {
        id: `${block.nodeType}-${Date.now()}`,
        type: block.nodeType === 'default' ? undefined : block.nodeType,
        position: centeredPosition,
        data: { 
          label: block.label,
          ...(block.defaultData || {})
        },
      };

      // Initialize expression for specific node types upon creation
      if (newNode.type === 'Conditional') {
        newNode.data.expression = new Expression([], [], '==').toObject();
      } else if (newNode.type === 'Output') {
        newNode.data.expression = new Expression(undefined, []).toObject();
      }
      
      // Add the new node to the flow
      setNodes((nds) => nds.concat(newNode));
    } catch (error) {
      console.error('Error creating node in direct drop:', error);
    } finally {
      // Clear the DnDData after dropping
      setDnDData(null);
    }
  }, [reactFlowInstance, nodes, setNodes, setIsDraggingOver, DnDData]);

  const onConnect = (params: any) => {    
    setEdges((eds: Edge[]) => {
      const sourceNode = nodes.find(node => node.id === params.source);
      
      // Create a copy of current edges
      let newEdges = [...eds];
      
      // For conditional nodes, limit to 2 outgoing edges (True/Yes and False/No)
      if (sourceNode?.type === 'Conditional') {
        // Get existing outgoing edges for this conditional node
        const existingOutgoingEdges = newEdges.filter(edge => edge.source === params.source);
        
        // If already has 2 edges, don't allow more connections (not even replace) [TODO: consistency with non-conditional nodes?]
        if (existingOutgoingEdges.length >= 2) {
          return newEdges;
        }
        
        // Determine label for new edge based on existing edges
        const hasYesEdge = existingOutgoingEdges.some(edge => 
          edge.data?.conditionalLabel === decisionEdgeLabels[1]);
        const hasNoEdge = existingOutgoingEdges.some(edge => 
          edge.data?.conditionalLabel === decisionEdgeLabels[0]);

        let newEdgeLabel = '';
        if (!hasYesEdge && !hasNoEdge) {
          // If no yes nor no edge, set the label as the next in an alternating pattern (yes, no, yes, no...)
          // TODO: this toggling affects all the conditional nodes, not just the one that is being created (but its not critical)
          newEdgeLabel = decisionEdgeLabels[nextConditionalLabel];
          // Toggle for next time: 0 <-> 1 (No <-> Yes).
          setNextConditionalLabel(newEdgeLabel === decisionEdgeLabels[0] ? 1 : 0);
        } else {
          newEdgeLabel = hasYesEdge ? decisionEdgeLabels[0] : decisionEdgeLabels[1];
        }
          
        const newEdgeParams = {
          ...params,
          data: {
            ...params.data,
            conditionalLabel: newEdgeLabel,
          }
        };
        
        // Add the new edge with appropriate label
        return addEdge(newEdgeParams, newEdges);
      } else {
        // For every node except Conditional, limit the number of outgoing edges to 1
        newEdges = newEdges.filter(edge => edge.source !== params.source);
        
        // Add the new edge
        return addEdge(params, newEdges);
      }
    });
  };

  // Prevent default context menu
  const handleContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
  }, []);

  // Handle edge double-click
  const onEdgeDoubleClick = useCallback((event: React.MouseEvent, edge: Edge) => {
    event.stopPropagation();
    
    // Don't allow editing when flow is running (TODO: this is done to avoid a maximum depth setState when right-clicking AssignVariable with 2 variables in right side)
    if (isRunning) {
      return;
    }
    
    setEditingEdge(edge.id);
    setSelectedElement({ id: edge.id, type: 'edge' });
  }, [setSelectedElement, isRunning]);
  
  // Handle edge label changes
  useEffect(() => {
    const handleLabelChange = (event: CustomEvent) => {
      const { id, label } = event.detail;
      
      setEdges((eds) => 
        eds.map((edge) => {
          if (edge.id === id) {
            return {
              ...edge,
              data: {
                ...edge.data,
                label,
                isEditing: false
              },
              label
            };
          }
          return edge;
        })
      );
      
      setEditingEdge(null);
    };
    
    document.addEventListener('edge:labelChanged' as any, handleLabelChange as EventListener);
    
    return () => {
      document.removeEventListener('edge:labelChanged' as any, handleLabelChange as EventListener);
    };
  }, [setEdges]);
  
  // Update edge data for editing state
  useEffect(() => {
    if (editingEdge) {
      setEdges((prevEdges) => 
        prevEdges.map((edge) => {
          if (edge.id === editingEdge) {
            return {
              ...edge,
              data: {
                ...edge.data,
                isEditing: true
              }
            };
          }
          return edge;
        })
      );
    }
  }, [editingEdge, setEdges]);

  // Handle nodes deleted by keyboard or other means
  const onNodesDelete = useCallback((nodesToDelete: Node[]) => {
    // Clean up variables for any DeclareVariable nodes
    nodesToDelete.forEach(node => {
      if (node.type === 'DeclareVariable') {
        deleteNodeVariables(node.id);
      }
    });
    
    // Clear selection if the selected node was deleted
    if (selectedElement && selectedElement.type === 'node' && 
        nodesToDelete.some(node => node.id === selectedElement.id)) {
      setSelectedNode(null);
      setSelectedElement(null);
    }
  }, [deleteNodeVariables, selectedElement, setSelectedNode, setSelectedElement]);


  
  useEffect(() => {
    // Update expressions in AssignVariable, Conditional, Input, and Output nodes with variable changes
    const assignVarNodes = nodes.filter(node => node.type === 'AssignVariable');
    const inputNodes = nodes.filter(node => node.type === 'Input');
    const conditionalNodes = nodes.filter(node => node.type === 'Conditional');
    const outputNodes = nodes.filter(node => node.type === 'Output');

    // TODO: this needs to always be updated if new data depending on variables is added (refactor this to the node components?)

    if (assignVarNodes.length === 0 && inputNodes.length === 0 && conditionalNodes.length === 0 && outputNodes.length === 0) return;

    setNodes(prevNodes => 
      prevNodes.map(node => {
        if (node.type !== 'AssignVariable' && node.type !== 'Input' && node.type !== 'Conditional' && node.type !== 'Output') return node;
        if (node.type === 'AssignVariable' && !node.data.expression) return node;
        if (node.type === 'Conditional' && !node.data.expression) return node;
        if (node.type === 'Input' && !node.data.variable) return node;
        if (node.type === 'Output' && !node.data.expression) return node;

        if (node.type === 'AssignVariable') {
          try {
            // Create an Expression instance from the stored object
            const expression = Expression.fromObject(node.data.expression);
            
            // Update variable references
            expression.updateVariables(variables);
            
            // Return updated node with the latest expression data
            return { ...node, data: { ...node.data, expression: expression.toObject() } };
          } catch (error) {
            // Error means that the variable was deleted, so we need to delete the expression;
            return { ...node, data: { ...node.data, expression: null } };
          }
        } else if (node.type === 'Conditional') {
          // TODO: refactor this
          try {
            // Create an Expression instance from the stored object
            const expression = Expression.fromObject(node.data.expression);
            
            // Update variable references
            expression.updateVariables(variables);
            
            // Return updated node with the latest expression data
            return { ...node, data: { ...node.data, expression: expression.toObject() } };
          } catch (error) {
            // Error means that the variable was deleted, so we need to delete the expression;
            return { ...node, data: { ...node.data, expression: null } };
          }
        } else if (node.type === 'Input') {
          return { ...node, data: { ...node.data, variable: variables.find(v => v.id === node.data.variable.id) } };
        } else if (node.type === 'Output') {
          try {
            // Create an Expression instance from the stored object
            const expression = Expression.fromObject(node.data.expression);
            
            // Update variable references
            expression.updateVariables(variables);
            
            // Return updated node with the latest expression data
            return { ...node, data: { ...node.data, expression: expression.toObject() } };
          } catch (error) {
            // Error means that the variable was deleted, so we need to delete the expression;
            return { ...node, data: { ...node.data, expression: null } };
          }
        }
        return node;
      })
    );
  }, [variables, setNodes]);

  const isValidConnection: IsValidConnection = useCallback(
    (connection: Connection | Edge) => {
      // TODO: allow self-connections for while True on the same
      // careful with which type, e.g. conditional (then not?)
      // Prevent self-connections (a node connecting to itself)
      if (connection.source === connection.target) {
        return false;
      }

      const sourceNode = nodes.find(node => node.id === connection.source);

      // Get the existing edges from the source handle
      const existingEdgesFromHandle = edges.filter(
        edge => edge.source === connection.source && edge.sourceHandle === connection.sourceHandle
      );

      // Only for the case of Conditional nodes (as dragging a new edge from a handle if there are already Yes/No wont create a new edge, per onConnect)
      // If there's already an edge from this specific handle, prevent another one (1 outgoing edge per handle Yes/No to prevent label confusion and follow standard)
      if (sourceNode?.type === 'Conditional' && existingEdgesFromHandle.length > 0) {
        return false;
      }

      return true;
    },
    [edges]
  );

  return (
    <div 
      className="reactflow-wrapper" 
      ref={reactFlowWrapper} 
      style={{ width: '100%', height: '100%', userSelect: 'none' }} // userSelect needed to prevent intereferences with dragging (TODO) careful with this if need to select some text/drag in the flow (?)
      onMouseLeave={onMouseLeave}
      onContextMenu={handleContextMenu}
    >
      <ReactFlow
        ref={reactFlowRef}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        nodes={nodes}
        nodeTypes={nodeTypes}
        edges={edges}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
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
        onPaneMouseLeave={onMouseLeave}
        onConnect={onConnect}
        onNodesDelete={onNodesDelete}
        connectionLineType={ConnectionLineType.SmoothStep}
        isValidConnection={isValidConnection}
        fitView
        proOptions={{ hideAttribution: true }}
        deleteKeyCode={["Backspace", "Delete"]}
        defaultEdgeOptions={{ 
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

          type: 'Flowline',
        }}
      >
        <Controls />
        <Background variant={BackgroundVariant.Lines} gap={12} size={1} />
        <Panel style={{ userSelect: 'none' }}> {/* prevent text selection when double clicking on edge */}
          File/diagram name (TODO)
        </Panel>
      </ReactFlow>
      <ContextMenu onDelete={onDelete} />
    </div>
  );
};

export default FlowContent; 