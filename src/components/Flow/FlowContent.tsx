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

  const { isRunning } = useFlowExecutorContext();

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

  const onSelectionContextMenu = (event: React.MouseEvent, nodes: Node[]) => {
    event.preventDefault();

    // Calculate cursor position relative to the ReactFlow wrapper
    const reactFlowBounds = reactFlowWrapper.current?.getBoundingClientRect();
    const x = event.clientX - (reactFlowBounds?.left || 0);
    const y = event.clientY - (reactFlowBounds?.top || 0);

    showContextMenu(x, y, nodes.map(node => ({ id: node.id, type: 'node' })));
  };

  // Handle node/edge right-click (context menu)
  const onNodeContextMenu = (event: React.MouseEvent, node: Node) => {
    // Prevent the default context menu
    event.preventDefault();
    
    // Select the node (same as in onNodeClick)
    setSelectedNode(node as FlowNode);
    setSelectedElement({ id: node.id, type: 'node' });
    
    // Calculate cursor position relative to the ReactFlow wrapper
    const reactFlowBounds = reactFlowWrapper.current?.getBoundingClientRect();
    const x = event.clientX - (reactFlowBounds?.left || 0);
    const y = event.clientY - (reactFlowBounds?.top || 0);
    
    showContextMenu(x, y, [{ id: node.id, type: 'node' }]);
  };

  const onEdgeContextMenu = (event: React.MouseEvent, edge: Edge) => {
    // Prevent the default context menu
    event.preventDefault();
    
    // Select the edge (same as in onEdgeClick)
    setSelectedElement({ id: edge.id, type: 'edge' });
    
    // Calculate cursor position relative to the ReactFlow wrapper
    const reactFlowBounds = reactFlowWrapper.current?.getBoundingClientRect();
    const x = event.clientX - (reactFlowBounds?.left || 0);
    const y = event.clientY - (reactFlowBounds?.top || 0);
    
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
    
    console.log('Direct drop event received data:', DnDData);
  
    try {
      const block = JSON.parse(DnDData) as NodeBlock;
      console.log('Parsed block data in direct drop:', block);
      
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
      
      console.log('Creating node at centered position:', centeredPosition);
      
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
      
      console.log('New node created in direct drop:', newNode);
      
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
    console.log('onConnect', params);
    
    setEdges((eds: Edge[]) => {
      const sourceNode = nodes.find(node => node.id === params.source);
      
      // Create a copy of current edges
      let newEdges = [...eds];
      
      // For every node except Conditional, limit the number of outgoing edges to 1
      if (sourceNode?.type != 'Conditional') {
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

  // Prevent self-connections (a node connecting to itself)
  const isValidConnection: IsValidConnection = useCallback(
    (connection: Connection | Edge) => {
      // If source and target are the same node, it's an invalid connection
      return connection.source !== connection.target;
    },
    []
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

          // TODO: can delete edges/nodes while executing
          // (should this be fixed or not? if node stops existing, the execution stops)



          // TODO: context menu right click to delect when selecting multiple nodes with SHIFT + drag 
          // can only delete by SUPR



          // (should be fixed now by using ReactFlow drag & drop events)
          // TODO: bug - sometimes when dragging a node handle, it appears like you were dragging a block from toolbar and you kind of "drag" what you copied
          //        it is fixed by reloading web page
          /*        it happens when you drag a block node from the toolbar to the flow but it isnt added?

          Direct drop event received data: 

          FlowContent.tsx:301 Error creating node in direct drop: SyntaxError: Unexpected end of JSON input
              at JSON.parse (<anonymous>)
              at HTMLDivElement.handleDirectDrop (FlowContent.tsx:268:28)

          */
          

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