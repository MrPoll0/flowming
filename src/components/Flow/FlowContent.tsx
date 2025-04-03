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
  ConnectionLineType
} from '@xyflow/react';
import { SelectedNodeContext } from '../../context/SelectedNodeContext';
import { FlowInteractionContext } from '../../context/FlowInteractionContext';
import { useVariables } from '../../context/VariablesContext';
import { FlowNode, initialNodes, initialEdges, nodeTypes, edgeTypes } from './FlowTypes';
import { NodeBlock } from '../Toolbar/ToolbarTypes';
import ContextMenu from './ContextMenu';

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
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const reactFlowInstance = useReactFlow();

  // Add state to track edge being edited
  const [editingEdge, setEditingEdge] = useState<string | null>(null);

  // Apply visual styles based on hover and selection states
  useEffect(() => {
    // Apply styles to nodes
    setNodes((prevNodes) => 
      prevNodes.map((node) => {
        const isHovered = hoveredElement?.id === node.id && hoveredElement?.type === 'node';
        const isSelected = selectedElement?.id === node.id && selectedElement?.type === 'node';
        
        // Only create a new node object if the hover/selection state changed
        if (node.data.isHovered === isHovered && node.data.isSelected === isSelected) {
          return node; // Return the existing node if no changes
        }
        
        return {
          ...node,
          data: {
            ...node.data,
            isHovered,
            isSelected,
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
  }, [hoveredElement, selectedElement]);

  // Handle node selection
  const onNodeClick = (event: React.MouseEvent, node: Node) => {
    // Prevent event propagation to avoid triggering onPaneClick
    event.stopPropagation();
    
    console.log('Node clicked:', node);
    setSelectedNode(node as FlowNode);
    setSelectedElement({ id: node.id, type: 'node' });
    hideContextMenu();
  };

  // Handle edge selection
  const onEdgeClick = (event: React.MouseEvent, edge: Edge) => {
    // Prevent event propagation to avoid triggering onPaneClick
    event.stopPropagation();
    
    console.log('Edge clicked:', edge);
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

  // Handle node/edge right-click (context menu)
  const onNodeContextMenu = (event: React.MouseEvent, node: Node) => {
    // Prevent the default context menu
    event.preventDefault();
    
    // Select the node (same as in onNodeClick)
    setSelectedNode(node as FlowNode);
    setSelectedElement({ id: node.id, type: 'node' });
    
    // Calculate position relative to the ReactFlow wrapper
    const reactFlowBounds = reactFlowWrapper.current?.getBoundingClientRect();
    const x = event.clientX - (reactFlowBounds?.left || 0);
    const y = event.clientY - (reactFlowBounds?.top || 0);
    
    showContextMenu(x, y, { id: node.id, type: 'node' });
  };

  const onEdgeContextMenu = (event: React.MouseEvent, edge: Edge) => {
    // Prevent the default context menu
    event.preventDefault();
    
    // Select the edge (same as in onEdgeClick)
    setSelectedElement({ id: edge.id, type: 'edge' });
    
    // Calculate position relative to the ReactFlow wrapper
    const reactFlowBounds = reactFlowWrapper.current?.getBoundingClientRect();
    const x = event.clientX - (reactFlowBounds?.left || 0);
    const y = event.clientY - (reactFlowBounds?.top || 0);
    
    showContextMenu(x, y, { id: edge.id, type: 'edge' });
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
        
        // Limit the number of Start nodes to 1 at a time
        if (block.nodeType === 'Start' && nodes.some(node => node.type === 'Start')) {
          console.warn('Only one Start node is allowed');
          return;
        }
        
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
  }, [reactFlowInstance, isDraggingOver, setNodes, nodes]);

  const onConnect = (params: any) => {
    console.log('onConnect', params);
    
    setEdges((eds: Edge[]) => {
      const sourceNode = nodes.find(node => node.id === params.source);
      
      // Create a copy of current edges
      let newEdges = [...eds];
      
      // If source is a Start node, remove any existing edge from this node (max 1 ongoing edge)
      if (sourceNode?.type === 'Start') {
        newEdges = newEdges.filter(edge => edge.source !== params.source);
      }
      
      // Add the new edge
      return addEdge(params, newEdges);
    });
  };

  // Add this new function to handle right-clicks on the wrapper
  const handleContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
  }, []);

  // Add double-click handler for edges
  const onEdgeDoubleClick = useCallback((event: React.MouseEvent, edge: Edge) => {
    event.stopPropagation();
    setEditingEdge(edge.id);
    setSelectedElement({ id: edge.id, type: 'edge' });
  }, [setSelectedElement]);
  
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
  
  // Add effect to update edge data for editing state
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

  // Update AssignVariable nodes when variables change
  useEffect(() => {
    // Find all AssignVariable nodes
    const assignVarNodes = nodes.filter(node => node.type === 'AssignVariable');
    if (assignVarNodes.length === 0) return; // No AssignVariable nodes to update

    // Create a map of variable ids to names for quick lookups
    const variableMap = new Map(variables.map(v => [v.id, v.name]));
    
    // Track if we actually need to update any nodes
    let needsGlobalUpdate = false;
    
    // Create new nodes array with updated values, only if updates are needed
    const updatedNodes = nodes.map(node => {
      // Only update AssignVariable nodes with expressions
      if (node.type !== 'AssignVariable' || !node.data.expression) return node;

      const { expression } = node.data;
      let needsUpdate = false;
      let updatedExpression = { ...expression };
      
      // Check if the leftSide variable exists using the ID if available
      if (expression.leftSideVarId) {
        // We have a variable ID, check if it still exists
        const varName = variableMap.get(expression.leftSideVarId);
        if (varName) {
          // Variable still exists, update name if needed
          if (varName !== expression.leftSide) {
            needsUpdate = true;
            updatedExpression.leftSide = varName;
          }
        } else {
          // Variable no longer exists
          needsUpdate = true;
          updatedExpression = null; // Reset to "No assignment defined"
        }
      } else if (expression.leftSide) {
        // No ID stored, try to find by name (legacy support)
        const matchingVar = variables.find(v => v.name === expression.leftSide);
        
        if (!matchingVar) {
          // The variable no longer exists
          needsUpdate = true;
          updatedExpression = null; // Reset to "No assignment defined"
        }
      }
      
      // If the expression is null now, no need to process elements
      if (!updatedExpression) {
        if (needsUpdate) {
          needsGlobalUpdate = true;
          return {
            ...node,
            data: {
              ...node.data,
              expression: null
            },
          };
        }
        return node;
      }
      
      // Handle variables in the elements array
      if (updatedExpression.elements && updatedExpression.elements.length > 0) {
        let elementsNeedUpdate = false;
        const updatedElements = updatedExpression.elements
          .map((element: any) => {
            // Only process variable elements
            if (element.type !== 'variable') return element;
            
            // If we have a variableId, use it to check if the variable still exists
            if (element.variableId) {
              const currentName = variableMap.get(element.variableId);
              if (!currentName) {
                // Variable no longer exists
                elementsNeedUpdate = true;
                // Return null to mark for removal
                return null;
              } else if (currentName !== element.value) {
                // Variable name has changed
                elementsNeedUpdate = true;
                return {
                  ...element,
                  value: currentName // Update to new name
                };
              }
            } else {
              // Legacy support: check by name
              const matchingVar = variables.find(v => v.name === element.value);
              if (!matchingVar) {
                // Variable no longer exists
                elementsNeedUpdate = true;
                // Return null to mark for removal
                return null;
              }
            }
            return element;
          })
          .filter((element: any) => element !== null) as typeof updatedExpression.elements; // Remove nulls (deleted variables)
        
        if (elementsNeedUpdate) {
          needsUpdate = true;
          updatedExpression.elements = updatedElements;
        }
      }
      
      // Only create a new node if we need to update it
      if (!needsUpdate) return node;
      
      // Flag that we need to update nodes
      needsGlobalUpdate = true;
      
      return {
        ...node,
        data: {
          ...node.data,
          expression: updatedExpression
        },
      };
    });
    
    // Only call setNodes if we actually made changes
    if (needsGlobalUpdate) {
      setNodes(updatedNodes);
    }
  }, [variables, setNodes]); // Remove nodes from dependencies

  return (
    <div 
      className="reactflow-wrapper" 
      ref={reactFlowWrapper} 
      style={{ width: '100%', height: '100%' }}
      onMouseLeave={onMouseLeave}
      onContextMenu={handleContextMenu}
    >
      <ReactFlow
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
        onNodeContextMenu={onNodeContextMenu}
        onEdgeContextMenu={onEdgeContextMenu}
        onPaneClick={onPaneClick}
        onPaneMouseLeave={onMouseLeave}
        onConnect={onConnect}
        onNodesDelete={onNodesDelete}
        connectionLineType={ConnectionLineType.SmoothStep}
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
          type: 'Flowline',
        }}
      >
        <Controls />
        <Background variant={BackgroundVariant.Lines} gap={12} size={1} />
        <Panel style={{ userSelect: 'none' }}> {/* prevent text selection when double clicking on edge */}
          Nombre del archivo/diagrama (TODO)
        </Panel>
      </ReactFlow>
      <ContextMenu onDelete={onDelete} />
    </div>
  );
};

export default FlowContent; 