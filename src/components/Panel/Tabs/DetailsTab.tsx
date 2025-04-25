import { useContext, useState, useEffect, useRef, useCallback } from 'react';
import { SelectedNodeContext } from '../../../context/SelectedNodeContext';
import { useVariables } from '../../../context/VariablesContext';
import { useReactFlow } from '@xyflow/react';
import { Expression, ExpressionElement, Variable } from '../../../models';
import {
  DndContext, 
  useSensors, 
  useSensor, 
  PointerSensor,
  DragOverlay,
  useDroppable,
  useDraggable,
  rectIntersection
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
  arrayMove
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToHorizontalAxis } from '@dnd-kit/modifiers';  
import { variableTypes } from '../../../models';
import { useFlowExecutorContext } from '../../../context/FlowExecutorContext';
import { operators as expressionOperators, equalities, IEquality } from '../../../models/Expression';


// TODO: if cannot select element while running, then also hide its editor in DetailsTab for consistency (i prefer being able to select elements while running and see their values but not modify them)

// TODO: reset scroll when changing between AssignVariable and Conditional nodes

// TODO: proper expression reset depending on type (null, leftside undefined, empty array, etc)

// Available operators for expression building
const operators = [
  ...expressionOperators
];

// Define props interfaces for components
interface DraggableExpressionElementProps {
  element: ExpressionElement;
  index: number; // Keep this even if unused now, it might be needed later
  removeExpressionElement: (id: string) => void;
  disabled: boolean;
}

// Draggable expression element component
const DraggableExpressionElement = ({ element, removeExpressionElement, disabled }: DraggableExpressionElementProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: element.id, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    backgroundColor: 
      element.type === 'variable' ? '#d1e7ff' :
      element.type === 'operator' ? '#ffd1d1' : '#d1ffd1',
    padding: '4px 8px',
    margin: '4px',
    borderRadius: '4px',
    cursor: disabled ? 'not-allowed' : 'grab',
    display: 'inline-block',
    fontSize: '14px',
    opacity: isDragging ? 0 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
    >
      {element.value}
      <button
        onClick={() => removeExpressionElement(element.id)}
        style={{
          marginLeft: '5px',
          background: 'none',
          border: 'none',
          cursor: disabled ? 'not-allowed' : 'pointer',
          fontSize: '12px',
          padding: '0',
          display: 'inline-block',
          verticalAlign: 'middle'
        }}
      >
        ×
      </button>
    </div>
  );
};

// Define types for palette item props
interface DraggablePaletteItemProps {
  id: string;
  type: string; // Keep this even if unused now
  value: string;
  backgroundColor: string;
  disabled: boolean;
}

// Draggable palette item component (non-sortable)
const DraggablePaletteItem = ({ id, value, backgroundColor, disabled }: DraggablePaletteItemProps) => {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: id,
    disabled
  });

  const style = {
    backgroundColor: backgroundColor || '#e0e0e0',
    padding: '4px 8px',
    margin: '4px',
    borderRadius: '4px',
    cursor: disabled ? 'not-allowed' : 'grab',
    display: 'inline-block',
    fontSize: '14px',
    opacity: disabled ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
    >
      {value}
    </div>
  );
};

// Droppable area component
const ExpressionDropArea = ({ id, children, disabled }: { id: string, children: React.ReactNode, disabled: boolean }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: id
  });

  return (
    <div 
      ref={setNodeRef}
      style={{
        padding: '10px',
        border: `2px ${isOver ? 'solid' : 'dashed'} ${isOver ? '#4d9cff' : '#ccc'}`,
        borderRadius: '4px',
        minHeight: '60px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        backgroundColor: isOver ? 'rgba(77, 156, 255, 0.1)' : 'transparent',
        opacity: disabled ? 0.5 : 1
      }}
    >
      { /* 
      {isEmpty ? (
        <span style={{ color: '#888', fontStyle: 'italic' }}>
          Drag elements here to build expression
        </span>
      ) : children}
      */
      }
      {children}
    </div>
  );
};

// Component for Details tab that uses the context
const DetailsTab = () => {
  const { selectedNode } = useContext(SelectedNodeContext);
  const { getNodeVariables, updateNodeVariables, getAllVariables } = useVariables();
  const [variables, setVariables] = useState<Variable[]>([]);
  const [leftSideVariable, setLeftSideVariable] = useState<string>('');
  const isInitialLoadRef = useRef(true);
  const updateTimeoutRef = useRef<number | null>(null);
  const previousNodeIdRef = useRef<string | null>(null);
  const scrollableContainerRef = useRef<HTMLDivElement>(null); // Ref for the scrollable container

  const [expression, setExpression] = useState<Expression | null>(null);
  
  const reactFlowInstance = useReactFlow();
  
  const [_activeId, setActiveId] = useState<string | null>(null);
  const [activeItem, setActiveItem] = useState<ExpressionElement | null>(null);
  const [isReordering, setIsReordering] = useState(false);
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const { isRunning } = useFlowExecutorContext();


  // NOTE: multiple useEffects
  // 1. UI changes -> state
  // 2. state changes -> node data

  // Initialize expression when variable is selected
  useEffect(() => {
    if (selectedNode?.type === 'AssignVariable' && leftSideVariable) {
      const varInstance = getAllVariables().find(v => v.id === leftSideVariable);

      if (!varInstance) {
        if (expression !== null) setExpression(null);
        return;
      }

      // Only update if the left side has changed
      if (!expression || (expression.leftSide instanceof Variable && expression.leftSide.id !== varInstance.id)) {
        setExpression(new Expression(varInstance, expression?.rightSide || []));
      }
    } else if (!leftSideVariable) {
      if (expression !== null) setExpression(null);
    }
  }, [leftSideVariable, selectedNode]);

  // Update the node data when expression changes
  useEffect(() => {
    if ((selectedNode?.type === 'AssignVariable' || selectedNode?.type === 'Conditional' || selectedNode?.type === 'Output') && !isInitialLoadRef.current) {
      let updatedData;
      if (expression) {
        updatedData = {
          expression: expression.toObject()
        };
      } else {
        updatedData = { expression: null };
      }
      
      // Update the node data
      reactFlowInstance.updateNodeData(selectedNode.id, updatedData);
    }
  }, [expression, reactFlowInstance, selectedNode]);
  
  // Cleanup function for the debounce timeout
  const clearUpdateTimeout = () => {
    if (updateTimeoutRef.current !== null) {
      window.clearTimeout(updateTimeoutRef.current);
      updateTimeoutRef.current = null;
    }
  };
  
  // Debounced function to update node variables
  const debouncedUpdateNodeVariables = useCallback((nodeId: string, vars: Variable[]) => {
    clearUpdateTimeout();
    
    updateTimeoutRef.current = window.setTimeout(() => {
      updateNodeVariables(nodeId, vars);
    }, 100);
  }, [updateNodeVariables]);
  
  // Load variables when the selected node changes
  useEffect(() => {
    // Reset initial load flag
    isInitialLoadRef.current = true;
    
    // Reset scroll position when node changes
    if (scrollableContainerRef.current) {
      scrollableContainerRef.current.scrollTop = 0;
    }
    
    // Clear previous state if node type changes (to avoid Maximum depth exceeded error)
    if (previousNodeIdRef.current && selectedNode &&
        reactFlowInstance.getNode(previousNodeIdRef.current)?.type !== selectedNode.type) {
      setExpression(null);
      // Also reset leftSideVariable to avoid side effects with AssignVariable type
      if (selectedNode.type !== 'AssignVariable' && selectedNode.type !== 'Input' && selectedNode.type !== 'Output') {
        setLeftSideVariable('');
      }
    }
    
    // Only load if we have a DeclareVariable node selected
    if (selectedNode && selectedNode.type === 'DeclareVariable') {
      // Check if node changed
      if (previousNodeIdRef.current !== selectedNode.id) {
        previousNodeIdRef.current = selectedNode.id;
        const nodeVars = getNodeVariables(selectedNode.id);
        
        if (nodeVars.length > 0) {
          setVariables(nodeVars);
        } else {
          // Initialize with one empty variable if none exist
          const newVar = new Variable(crypto.randomUUID(), 'string', '', selectedNode.id);
          setVariables([newVar]);
        }
      }
    } else if (selectedNode && (selectedNode.type === 'AssignVariable' || selectedNode.type === 'Conditional' || selectedNode.type === 'Output')) {
      // Load assignment data if available
      if (previousNodeIdRef.current !== selectedNode.id) {
        previousNodeIdRef.current = selectedNode.id;
        
        // Initialize with existing data if available
        if (selectedNode.data.expression) {
          const allVariables = getAllVariables();

          try {
            let leftSide: Variable | ExpressionElement[] | undefined = undefined;
            let rightSide: ExpressionElement[];
            let equality: IEquality | undefined = undefined;

            if(selectedNode.type === 'AssignVariable') {
              const varId = selectedNode.data.expression.leftSide.id;
              // Check if the variable with this ID still exists
              if (allVariables.some(v => v.id === varId)) {
                setLeftSideVariable(varId);
                // Try to recreate the expression
                const leftVar = allVariables.find(v => v.id === varId);
                if (leftVar) leftSide = leftVar;
              }
            } else if(selectedNode.type === 'Conditional') {
              // Create expression elements from the stored data
              leftSide = selectedNode.data.expression.leftSide?.map((elem: any) => 
                ExpressionElement.fromObject(elem)
              ) || [];
              
              // Get equality operator
              equality = selectedNode.data.expression.equality || '==';
            }

            rightSide = selectedNode.data.expression.rightSide?.map((elem: any) => 
              ExpressionElement.fromObject(elem)
            ) || [];

            setExpression(new Expression(leftSide, rightSide, equality));
          } catch (error) {
            console.error('Error creating expression:', error);
          }
        } else {
          // Reset form state for a new or empty assignment
          setLeftSideVariable('');
          
          // For Conditional, initialize with empty expression
          if (selectedNode.type === 'Conditional') {
            setExpression(new Expression([], [], '=='));
          } else if (selectedNode.type === 'Output') {
            setExpression(new Expression(undefined, []));
          } else {
            setExpression(null);
          }
        }
      }
    } else if (selectedNode && selectedNode.type === 'Input') {
      // Load input variable data if available
      if (previousNodeIdRef.current !== selectedNode.id) {
        previousNodeIdRef.current = selectedNode.id;
        
        // Initialize with existing variable if available
        if (selectedNode.data.variable && selectedNode.data.variable.id) {
          setLeftSideVariable(selectedNode.data.variable.id);
        } else {
          setLeftSideVariable('');
        }
      }
    } else {
      previousNodeIdRef.current = null;
      setVariables([]);
    }
    
    isInitialLoadRef.current = false;
    
    // Cleanup on component unmount or when selected node changes
    return () => {
      clearUpdateTimeout();
    };
  }, [selectedNode]);
  
  // Update the node data when variable changes for Input node (TODO: is this needed or already done in other useEffect?)
  useEffect(() => {
    if (selectedNode?.type === 'Input' && !isInitialLoadRef.current) {
      const allVariables = getAllVariables();
      const selectedVariable = allVariables.find(v => v.id === leftSideVariable);
      
      let updatedData;
      if (selectedVariable) {
        updatedData = {
          variable: selectedVariable
        };
      } else {
        updatedData = { variable: null };
      }
      
      // Update the node data
      reactFlowInstance.updateNodeData(selectedNode.id, updatedData);
    }
  }, [leftSideVariable, reactFlowInstance, selectedNode]);
  
  // Save variables when they change
  useEffect(() => {
    // Skip the initial load
    if (isInitialLoadRef.current) {
      return;
    }
    
    // Only update if we have a DeclareVariable node selected and variables to save
    if (selectedNode && selectedNode.type === 'DeclareVariable' && variables.length > 0) {
      // Filter out variables with empty names before saving
      const validVariables = variables.filter(v => v.name.trim() !== '');
      debouncedUpdateNodeVariables(selectedNode.id, validVariables);
    }
    
    // Cleanup on unmount
    return () => {
      clearUpdateTimeout();
    };
  }, [variables, selectedNode]);
  
  // Variable management functions
  const addVariable = () => {
    if (selectedNode && selectedNode.type === 'DeclareVariable') {
      const newVar = new Variable(
        crypto.randomUUID(), 
        'string', 
        '', 
        selectedNode.id
      );

      setVariables(prev => [...prev, newVar]);
    }
  };
  
  const updateVariable = (id: string, field: 'type' | 'name', value: string) => {
    if (selectedNode && selectedNode.type === 'DeclareVariable' && !isRunning) {
      setVariables(prev => 
        prev.map(v => v.id === id ? v.update({ [field]: value }) : v)
      );
    }
  };
  
  const deleteVariable = (id: string) => {
    if (selectedNode && selectedNode.type === 'DeclareVariable' && !isRunning) {
      setVariables(prev => prev.filter(v => v.id !== id));
    }

    // TODO: this might need proper cleanup in the future
  };
  
  // Expression building functions
  const addExpressionElement = (element: ExpressionElement, side?: 'left' | 'right') => {
    if ((selectedNode?.type === 'AssignVariable' || selectedNode?.type === 'Conditional' || selectedNode?.type === 'Output') && expression && !isRunning) {
      setExpression(prev => {
        if (!prev) return null;
        const newExpr = prev.clone();
        
        // For conditional nodes, check if we need to add to the left side
        if (selectedNode.type === 'Conditional' && side === 'left' && Array.isArray(newExpr.leftSide)) {
          newExpr.leftSide = [...newExpr.leftSide, element];
        } else {
          // Otherwise add to the right side (default)
          newExpr.addElement(element);
        }
        
        return newExpr;
      });
    }
  };
  
  const removeExpressionElement = (id: string) => {
    if ((selectedNode?.type === 'AssignVariable' || selectedNode?.type === 'Conditional' || selectedNode?.type === 'Output') && expression && !isRunning) {
      setExpression(prev => {
        if (!prev) return null;
        const newExpr = prev.clone();
        
        // For conditional nodes, check both left and right sides
        if (selectedNode.type === 'Conditional' && Array.isArray(newExpr.leftSide)) {
          // Check if the element to remove is in the left side
          const leftIndex = (newExpr.leftSide as ExpressionElement[]).findIndex(e => e.id === id);
          if (leftIndex > -1) {
            const newLeftSide = [...(newExpr.leftSide as ExpressionElement[])];
            newLeftSide.splice(leftIndex, 1);
            newExpr.leftSide = newLeftSide;
            return newExpr;
          }
        }
        
        // Otherwise remove from right side (for both AssignVariable and Conditional)
        newExpr.removeElement(id);
        return newExpr;
      });
    }
  };
  
  // Handle drag start
  const handleDragStart = (event: any) => {
    const { active } = event;
    setActiveId(active.id);
    
    // Find the active item
    let foundItem: ExpressionElement | null = null;
    
    // Check if it's an existing expression element being reordered
    const isExistingElement = expression?.rightSide.find(item => item.id === active.id);
    setIsReordering(!!isExistingElement); // Set state based on whether it's reordering

    if (isExistingElement) {
      foundItem = isExistingElement;
    } else if (active.id.startsWith('var-')) { // Check in variables (palette)
      const varId = active.id.replace('var-', '');
      const variable = getAllVariables().find(v => v.id === varId);
      if (variable) {
        foundItem = new ExpressionElement(
          active.id, 
          'variable', 
          variable.name,
          variable
        );
      }
    } else if (active.id.startsWith('op-')) { // Check in operators (palette)
      const op = active.id.replace('op-', '');
      foundItem = new ExpressionElement(active.id, 'operator', op);
    } else if (active.id.startsWith('lit-')) { // Check in literals (palette)
      const parts = active.id.split('-'); // e.g., "lit-boolean-true"
      if (parts.length >= 3) {
        const value = parts.slice(2).join('-'); // e.g., "true"
        foundItem = new ExpressionElement(active.id, 'literal', value);
      }
    }
    
    setActiveItem(foundItem);
  };

  // Handle drag end
  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    setActiveId(null); // Reset active state even if dropped outside
    setActiveItem(null);
    setIsReordering(false); // Reset reordering state

    // Exit if dropped outside a valid droppable area
    if (!over) {
      return;
    }

    const activeId = active.id;
    const overId = over.id;

    if (expression && (selectedNode?.type === 'AssignVariable' || selectedNode?.type === 'Output')) {
      // Find the index of the active element if it exists in the expression list
      const activeElementIndex = expression.rightSide.findIndex(e => e.id === activeId);

      // Check if the target ('over') is the drop area itself
      const overIsDropArea = overId === 'expression-drop-area';
      // Find the index of the element being dropped onto, if applicable
      const overElementIndex = expression.rightSide.findIndex(e => e.id === overId);

      // Case 1: Reordering existing expression elements
      if (activeElementIndex > -1 && activeId !== overId) {
        // Check if the drop target is another existing element
        if (overElementIndex > -1) {
          setExpression(prev => {
            if (!prev) return null;
            const newExpr = prev.clone();
            newExpr.rightSide = arrayMove(newExpr.rightSide, activeElementIndex, overElementIndex);
            return newExpr;
          });
        }
      }
      // Case 2: Adding a new element from the palette
      else if (activeElementIndex === -1 && overIsDropArea) {
        // This is a new element being added to the expression
        if (!activeItem) return; // Safety check

        // Create a new element with a fresh UUID
        let newElement: ExpressionElement; 
        
        // Create proper ExpressionElement based on the type
        if (activeItem.type === 'variable') {
          // Access variable through type assertion
          const element = activeItem as any;
          const varId = element.variable?.id;
          
          if (varId) {
            const variable = getAllVariables().find(v => v.id === varId);
            if (variable) {
              newElement = new ExpressionElement(
                crypto.randomUUID(),
                'variable',
                variable.name,
                variable
              );
            } else {
              console.error(`Variable ${varId} not found`);
              return;
            }
          } else {
            console.error(`Variable ID not found`);
            return;
          }
        } else {
          newElement = new ExpressionElement(
            crypto.randomUUID(),
            activeItem.type,
            activeItem.value
          );
        }
        
        // Add the element to the expression
        setExpression(prev => {
          if (!prev) return null;
          const newExpr = prev.clone();
          newExpr.addElement(newElement);
          return newExpr;
        });
      }
      // Case 3: Adding an element at a specific position in the expression
      else if (activeElementIndex === -1 && overElementIndex > -1) {
        // This is a new element being inserted at a specific position
        if (!activeItem) return; // Safety check

        // Create a new element with a fresh UUID
        let newElement: ExpressionElement;
        
        // Create proper ExpressionElement based on the type
        if (activeItem.type === 'variable') {
          // Access variable through type assertion
          const element = activeItem as any;
          const varId = element.variable?.id;
          
          if (varId) {
            const variable = getAllVariables().find(v => v.id === varId);
            if (variable) {
              newElement = new ExpressionElement(
                crypto.randomUUID(),
                'variable',
                variable.name,
                variable
              );
            } else {
              console.error(`Variable ${varId} not found`);
              return;
            }
          } else {
            console.error(`Variable ID not found`);
            return;
          }
        } else {
          newElement = new ExpressionElement(
            crypto.randomUUID(),
            activeItem.type,
            activeItem.value
          );
        }
        
        // Insert at the specified position
        setExpression(prev => {
          if (!prev) return null;
          const newExpr = prev.clone();
          newExpr.insertElementAt(newElement, overElementIndex);
          return newExpr;
        });
      }
    }
    // For Conditional nodes
    else if (selectedNode?.type === 'Conditional') {
      // Initialize expression if it doesn't exist
      if (!expression) {
        setExpression(new Expression([], [], '=='));
        return;
      }

      // Create helper function to create a new element
      const createNewExpressionElement = () => {
        if (!activeItem) return null;
        
        let newElement: ExpressionElement;
        
        if (activeItem.type === 'variable') {
          const element = activeItem as any;
          const varId = element.variable?.id;
          
          if (varId) {
            const variable = getAllVariables().find(v => v.id === varId);
            if (variable) {
              newElement = new ExpressionElement(
                crypto.randomUUID(),
                'variable',
                variable.name,
                variable
              );
            } else {
              console.error(`Variable ${varId} not found`);
              return null;
            }
          } else {
            console.error(`Variable ID not found`);
            return null;
          }
        } else {
          newElement = new ExpressionElement(
            crypto.randomUUID(),
            activeItem.type,
            activeItem.value
          );
        }
        
        return newElement;
      };
      
      // Handle dropping into left expression drop area
      if (overId === 'left-expression-drop-area') {
        const newElement = createNewExpressionElement();
        
        if (newElement) {
          setExpression(prev => {
            if (!prev) return null;
            const newExpr = prev.clone();
            if (Array.isArray(newExpr.leftSide)) {
              newExpr.leftSide = [...newExpr.leftSide, newElement];
            } else {
              newExpr.leftSide = [newElement];
            }
            return newExpr;
          });
        }
      }
      // Handle dropping into right expression drop area
      else if (overId === 'right-expression-drop-area') {
        const newElement = createNewExpressionElement();
        
        if (newElement) {
          setExpression(prev => {
            if (!prev) return null;
            const newExpr = prev.clone();
            newExpr.rightSide = [...newExpr.rightSide, newElement];
            return newExpr;
          });
        }
      }
      // Handle reordering or insertion in left expression area
      else {
        // Check if the active element is in the left side
        const leftSide = Array.isArray(expression.leftSide) ? expression.leftSide : [];
        const activeLeftElementIndex = leftSide.findIndex(e => e.id === activeId);
        const overLeftElementIndex = leftSide.findIndex(e => e.id === overId);
        
        // Check if the active element is in the right side
        const activeRightElementIndex = expression.rightSide.findIndex(e => e.id === activeId);
        const overRightElementIndex = expression.rightSide.findIndex(e => e.id === overId);
        
        // Reordering in left side
        if (activeLeftElementIndex > -1 && overLeftElementIndex > -1) {
          setExpression(prev => {
            if (!prev) return null;
            const newExpr = prev.clone();
            if (Array.isArray(newExpr.leftSide)) {
              newExpr.leftSide = arrayMove(
                newExpr.leftSide as ExpressionElement[], 
                activeLeftElementIndex, 
                overLeftElementIndex
              );
            }
            return newExpr;
          });
        }
        // Reordering in right side
        else if (activeRightElementIndex > -1 && overRightElementIndex > -1) {
          setExpression(prev => {
            if (!prev) return null;
            const newExpr = prev.clone();
            newExpr.rightSide = arrayMove(
              newExpr.rightSide, 
              activeRightElementIndex, 
              overRightElementIndex
            );
            return newExpr;
          });
        }
      }
    }
  };
  
  // Render variable editor if DeclareVariable node is selected
  const renderVariableEditor = () => {
    if (!selectedNode || selectedNode.type !== 'DeclareVariable') return null;
    
    return (
      <div key={selectedNode.id} style={{ marginTop: '20px' }}>
        <h4>Variable Declaration</h4>
        
        {variables.map((variable) => (
          <div key={variable.id} style={{ 
            display: 'flex', 
            marginBottom: '8px',
            alignItems: 'center'
          }}>
            <select
              value={variable.type}
              onChange={(e) => updateVariable(variable.id, 'type', e.target.value)}
              style={{
                flex: '1',
                padding: '8px',
                borderRadius: '4px',
                marginRight: '8px',
                border: '1px solid #ccc',
                backgroundColor: isRunning ? '#f0f0f0' : 'white',
                cursor: isRunning ? 'not-allowed' : 'pointer'
              }}
              disabled={isRunning}
            >
              {variableTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
            <input
              value={variable.name}
              onChange={(e) => updateVariable(variable.id, 'name', e.target.value)}
              placeholder="Variable name"
              style={{
                flex: '1',
                padding: '8px',
                borderRadius: '4px',
                border: '1px solid #ccc',
                backgroundColor: isRunning ? '#f0f0f0' : 'white',
                cursor: isRunning ? 'not-allowed' : 'pointer'
              }}
              disabled={isRunning}
            />
            {variables.length > 1 && (
              <button 
                onClick={() => deleteVariable(variable.id)}
                style={{
                  marginLeft: '8px',
                  background: 'none',
                  border: 'none',
                  cursor: isRunning ? 'not-allowed' : 'pointer',
                  fontSize: '18px'
                }}
                disabled={isRunning}
              >
                ×
              </button>
            )}
          </div>
        ))}
        
        <button
          onClick={addVariable}
          style={{
            background: '#f0f0f0',
            border: '1px solid #ccc',
            borderRadius: '4px',
            padding: '8px 12px',
            marginTop: '10px',
            cursor: isRunning ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%'
          }}
          disabled={isRunning}
        >
          + Add variable
        </button>
      </div>
    );
  };

  // TODO: refactor editors to other files (?)
  
  // Render assignment editor for AssignVariable nodes
  const renderAssignmentEditor = () => {
    if (!selectedNode || selectedNode.type !== 'AssignVariable') return null;
    
    const allVariables = getAllVariables();
    
    // Style for expression box
    const expressionBoxStyle = {
      padding: '10px',
      border: '1px solid #ccc',
      borderRadius: '4px',
      minHeight: '50px',
      marginBottom: '15px',
      backgroundColor: '#f9f9f9',
    };
    
    // Style for section boxes
    const sectionStyle = {
      marginBottom: '15px',
      border: '1px solid #ddd',
      borderRadius: '4px',
      padding: '10px',
    };
    
    return (
      <DndContext
        sensors={sensors}
        collisionDetection={rectIntersection}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        // TODO: horizontal restriction does not work properly with vertical scrolling
        modifiers={isReordering ? [restrictToHorizontalAxis] : undefined}
      >
        <div key={selectedNode.id}>
          <h4>Variable Assignment</h4>
          
          {/* Left side (variable selection) */}
          <div style={sectionStyle}>
            <h5 style={{ marginTop: 0, marginBottom: '10px' }}>Select Variable to Assign (Left-hand side)</h5>
            <select
              value={leftSideVariable}
              onChange={(e) => {
                const newValue = e.target.value;
                setLeftSideVariable(newValue);
              }}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '4px',
                border: '1px solid #ccc',
                backgroundColor: isRunning ? '#f0f0f0' : 'white',
                cursor: isRunning ? 'not-allowed' : 'pointer'
              }}
              disabled={isRunning}
            >
              <option value="">-- Select Variable --</option>
              {allVariables.map(variable => (
                <option key={variable.id} value={variable.id}>
                  {variable.name} ({variable.type})
                </option>
              ))}
            </select>
          </div>
          
          {/* Expression display box */}
          <div style={{ marginBottom: '15px' }}>
            <h5 style={{ marginTop: 0, marginBottom: '5px' }}>Expression</h5>
            <div style={expressionBoxStyle}>
              {leftSideVariable && expression ? (
                <>
                  <span style={{ fontWeight: 'bold', marginBottom: '10px', display: 'block' }}>
                    {expression.leftSide?.toString()} = 
                  </span>
                  
                  <ExpressionDropArea id="expression-drop-area" disabled={isRunning}>
                    <SortableContext 
                      items={expression.rightSide.map(item => item.id)}
                      strategy={horizontalListSortingStrategy}
                    >
                      {expression.rightSide.map((element, index) => (
                        <DraggableExpressionElement 
                          key={element.id}
                          element={element}
                          index={index}
                          removeExpressionElement={removeExpressionElement}
                          disabled={isRunning}
                        />
                      ))}
                    </SortableContext>
                  </ExpressionDropArea>
                </>
              ) : (
                <span style={{ color: '#888', fontStyle: 'italic' }}>Select a variable for the left-hand side</span>
              )}
            </div>
          </div>
          
          {/* Building blocks section */}
          {leftSideVariable && (
            <>
              {/* Variables section */}
              <div style={sectionStyle}>
                <h5 style={{ marginTop: 0, marginBottom: '10px' }}>Variables</h5>
                <div>
                  {allVariables.map(variable => (
                    <DraggablePaletteItem
                      key={`var-${variable.id}`}
                      id={`var-${variable.id}`}
                      type="variable"
                      value={variable.name}
                      backgroundColor="#d1e7ff"
                      disabled={isRunning}
                    />
                  ))}
                  {allVariables.length === 0 && (
                    <div style={{ color: '#888', fontStyle: 'italic' }}>No variables declared</div>
                  )}
                </div>
              </div>
              
              {/* Operators section */}
              <div style={sectionStyle}>
                <h5 style={{ marginTop: 0, marginBottom: '10px' }}>Operators</h5>
                <div>
                  {operators.map(op => (
                    <DraggablePaletteItem
                      key={`op-${op}`}
                      id={`op-${op}`}
                      type="operator"
                      value={op}
                      backgroundColor="#ffd1d1"
                      disabled={isRunning}
                    />
                  ))}
                </div>
              </div>
              
              {/* Literals section */}
              <div style={sectionStyle}>
                <h5 style={{ marginTop: 0, marginBottom: '10px' }}>Literals</h5>
                
                {/* String literal */}
                <div>
                  <h6 style={{ margin: '5px 0' }}>String</h6>
                  <input 
                    type="text" 
                    placeholder="String value" 
                    id="string-literal-input"
                    style={{ width: '70%', padding: '4px', marginRight: '5px' }}
                    disabled={isRunning}
                  />
                  <button
                    onClick={() => {
                      const input = document.getElementById('string-literal-input') as HTMLInputElement;
                      if (input && input.value) {
                        const value = input.value;
                        const element = new ExpressionElement(
                          crypto.randomUUID(),
                          'literal',
                          `"${value}"`
                        );
                        addExpressionElement(element);
                        input.value = '';
                      }
                    }}
                    style={{ 
                      padding: '4px 8px',
                      backgroundColor: '#d1ffd1',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      cursor: isRunning ? 'not-allowed' : 'pointer',
                      opacity: isRunning ? 0.5 : 1
                    }}
                    disabled={isRunning}
                  >
                    Add String
                  </button>
                </div>
                
                {/* Integer literal */}
                <div style={{ marginTop: '10px' }}>
                  <h6 style={{ margin: '5px 0' }}>Integer</h6>
                  <input 
                    type="number" 
                    step="1"
                    placeholder="Integer value" 
                    id="integer-literal-input"
                    style={{ width: '70%', padding: '4px', marginRight: '5px' }}
                    disabled={isRunning}
                  />
                  <button
                    onClick={() => {
                      const input = document.getElementById('integer-literal-input') as HTMLInputElement;
                      if (input && input.value) {
                        const value = parseInt(input.value).toString(); // Ensure it's an integer
                        const element = new ExpressionElement(
                          crypto.randomUUID(),
                          'literal',
                          value
                        );
                        addExpressionElement(element);
                        input.value = '';
                      }
                    }}
                    style={{ 
                      padding: '4px 8px',
                      backgroundColor: '#d1ffd1',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      cursor: isRunning ? 'not-allowed' : 'pointer',
                      opacity: isRunning ? 0.5 : 1
                    }}
                    disabled={isRunning}
                  >
                    Add Integer
                  </button>
                </div>
                
                {/* Float literal */}
                <div style={{ marginTop: '10px' }}>
                  <h6 style={{ margin: '5px 0' }}>Float</h6>
                  <input 
                    type="number" 
                    step="0.1"
                    placeholder="Float value"
                    id="float-literal-input"
                    style={{ width: '70%', padding: '4px', marginRight: '5px' }}
                    disabled={isRunning}
                  />
                  <button
                    onClick={() => {
                      const input = document.getElementById('float-literal-input') as HTMLInputElement;
                      if (input && input.value) {
                        const value = parseFloat(input.value).toString();
                        const element = new ExpressionElement(
                          crypto.randomUUID(),
                          'literal',
                          value
                        );
                        addExpressionElement(element);
                        input.value = '';
                      }
                    }}
                    style={{ 
                      padding: '4px 8px',
                      backgroundColor: '#d1ffd1',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      cursor: isRunning ? 'not-allowed' : 'pointer',
                      opacity: isRunning ? 0.5 : 1
                    }}
                    disabled={isRunning}
                  >
                    Add Float
                  </button>
                </div>
                
                {/* Boolean literals */}
                <div style={{ marginTop: '10px' }}>
                  <h6 style={{ margin: '5px 0' }}>Boolean</h6>
                  <div>
                    <DraggablePaletteItem
                      id="lit-boolean-true"
                      type="literal"
                      value="true"
                      backgroundColor="#d1ffd1"
                      disabled={isRunning}
                    />
                    <DraggablePaletteItem
                      id="lit-boolean-false"
                      type="literal"
                      value="false"
                      backgroundColor="#d1ffd1"
                      disabled={isRunning}
                    />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
        
        <DragOverlay>
          {activeItem ? (
            <div style={{
              padding: '4px 8px',
              margin: '4px',
              borderRadius: '4px',
              fontSize: '14px',
              backgroundColor: 
                activeItem.type === 'variable' ? '#d1e7ff' :
                activeItem.type === 'operator' ? '#ffd1d1' : '#d1ffd1',
              boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
              cursor: 'grabbing',
            }}>
              {activeItem.value}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    );
  };

  // Render output editor for Output nodes
  const renderOutputEditor = () => {
    if (!selectedNode || selectedNode.type !== 'Output' || !expression) return null;
    
    
    const allVariables = getAllVariables();

    // Style for expression box
    const expressionBoxStyle = {
      padding: '10px',
      border: '1px solid #ccc',
      borderRadius: '4px',
      minHeight: '50px',
      marginBottom: '15px',
      backgroundColor: '#f9f9f9',
    };

    // Style for section boxes
    const sectionStyle = {
      marginBottom: '15px',
      border: '1px solid #ddd',
      borderRadius: '4px',
      padding: '10px',
    };

    return (
      <DndContext
        sensors={sensors}
        collisionDetection={rectIntersection}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        // TODO: horizontal restriction does not work properly with vertical scrolling
        modifiers={isReordering ? [restrictToHorizontalAxis] : undefined}
      >
        <div key={selectedNode.id}>
          <h4>Output Expression</h4>

          {/* Expression display box */}
          <div style={{ marginBottom: '15px' }}>
            <h5 style={{ marginTop: 0, marginBottom: '5px' }}>Expression</h5>
            <div style={expressionBoxStyle}>
              { expression ? (
                <>
                  <ExpressionDropArea id="expression-drop-area" disabled={isRunning}>
                    <SortableContext 
                      items={expression.rightSide.map(e => e.id)} 
                      strategy={horizontalListSortingStrategy}
                    >
                      {expression.rightSide.map((element, index) => (
                        <DraggableExpressionElement
                          key={element.id}
                          element={element}
                          index={index}
                          removeExpressionElement={removeExpressionElement}
                          disabled={isRunning}
                        />
                      ))}
                    </SortableContext>
                  </ExpressionDropArea>
                </>
              ) : ( <></> )}
            </div>
          </div>

          {/* Building blocks section */}
          {/* Variables section */}
          <div style={sectionStyle}>
            <h5 style={{ marginTop: 0, marginBottom: '10px' }}>Variables</h5>
            <div>
              {allVariables.map(variable => (
                <DraggablePaletteItem
                  key={`var-${variable.id}`}
                  id={`var-${variable.id}`}
                  type="variable"
                  value={variable.name}
                  backgroundColor="#d1e7ff"
                  disabled={isRunning}
                />
              ))}
              {allVariables.length === 0 && (
                <div style={{ color: '#888', fontStyle: 'italic' }}>No variables declared</div>
              )}
            </div>
          </div>

          {/* Operators section */}
          <div style={sectionStyle}>
            <h5 style={{ marginTop: 0, marginBottom: '10px' }}>Operators</h5>
            <div>
              {operators.map(op => (
                <DraggablePaletteItem
                  key={`op-${op}`}
                  id={`op-${op}`}
                  type="operator"
                  value={op}
                  backgroundColor="#ffd1d1"
                  disabled={isRunning}
                />
              ))}
            </div>
          </div>

          {/* Literals section */}
          <div style={sectionStyle}>
            <h5 style={{ marginTop: 0, marginBottom: '10px' }}>Literals</h5>
            
            {/* String literal */}
            <div>
              <h6 style={{ margin: '5px 0' }}>String</h6>
              <input
                type="text"
                placeholder="String value"
                id="output-string-literal-input"
                style={{ width: '70%', padding: '4px', marginRight: '5px' }}
                disabled={isRunning}
              />
              <button
                onClick={() => {
                  const strInput = document.getElementById('output-string-literal-input') as HTMLInputElement;
                  if (strInput && strInput.value) {
                    const element = new ExpressionElement(crypto.randomUUID(), 'literal', `"${strInput.value}"`);
                    addExpressionElement(element);
                    strInput.value = '';
                  }
                }}
                style={{ padding: '4px 8px', backgroundColor: '#d1ffd1', border: '1px solid #ccc', borderRadius: '4px', cursor: isRunning ? 'not-allowed' : 'pointer', opacity: isRunning ? 0.5 : 1 }}
                disabled={isRunning}
              >Add String</button>
            </div>

            {/* Integer literal */}
            <div style={{ marginTop: '10px' }}>
              <h6 style={{ margin: '5px 0' }}>Integer</h6>
              <input
                type="number"
                step="1"
                placeholder="Integer value"
                id="output-integer-literal-input"
                style={{ width: '70%', padding: '4px', marginRight: '5px' }}
                disabled={isRunning}
              />
              <button
                onClick={() => {
                  const intInput = document.getElementById('output-integer-literal-input') as HTMLInputElement;
                  if (intInput && intInput.value) {
                    const element = new ExpressionElement(crypto.randomUUID(), 'literal', intInput.value);
                    addExpressionElement(element);
                    intInput.value = '';
                  }
                }}
                style={{ padding: '4px 8px', backgroundColor: '#d1ffd1', border: '1px solid #ccc', borderRadius: '4px', cursor: isRunning ? 'not-allowed' : 'pointer', opacity: isRunning ? 0.5 : 1 }}
                disabled={isRunning}
              >Add Integer</button>
            </div>

            {/* Float literal */}
            <div style={{ marginTop: '10px' }}>
              <h6 style={{ margin: '5px 0' }}>Float</h6>
              <input
                type="number"
                step="0.1"
                placeholder="Float value"
                id="output-float-literal-input"
                style={{ width: '70%', padding: '4px', marginRight: '5px' }}
                disabled={isRunning}
              />
              <button
                onClick={() => {
                  const floatInput = document.getElementById('output-float-literal-input') as HTMLInputElement;
                  if (floatInput && floatInput.value) {
                    const element = new ExpressionElement(crypto.randomUUID(), 'literal', floatInput.value);
                    addExpressionElement(element);
                    floatInput.value = '';
                  }
                }}
                style={{ padding: '4px 8px', backgroundColor: '#d1ffd1', border: '1px solid #ccc', borderRadius: '4px', cursor: isRunning ? 'not-allowed' : 'pointer', opacity: isRunning ? 0.5 : 1 }}
                disabled={isRunning}
              >Add Float</button>
            </div>

            {/* Boolean literals */}
            <div style={{ marginTop: '10px' }}>
              <h6 style={{ margin: '5px 0' }}>Boolean</h6>
              <div style={{ display: 'flex', gap: '5px' }}>
                <button
                  onClick={() => { const element = new ExpressionElement(crypto.randomUUID(), 'literal', 'true'); addExpressionElement(element); }}
                  style={{ padding: '4px 8px', backgroundColor: '#d1ffd1', border: '1px solid #ccc', borderRadius: '4px', cursor: isRunning ? 'not-allowed' : 'pointer', opacity: isRunning ? 0.5 : 1 }}
                  disabled={isRunning}
                >true</button>
                <button
                  onClick={() => { const element = new ExpressionElement(crypto.randomUUID(), 'literal', 'false'); addExpressionElement(element); }}
                  style={{ padding: '4px 8px', backgroundColor: '#d1ffd1', border: '1px solid #ccc', borderRadius: '4px', cursor: isRunning ? 'not-allowed' : 'pointer', opacity: isRunning ? 0.5 : 1 }}
                  disabled={isRunning}
                >false</button>
              </div>
            </div>
          </div>
        </div>

        <DragOverlay>
          {activeItem ? (
            <div style={{
              padding: '4px 8px',
              margin: '4px',
              borderRadius: '4px',
              fontSize: '14px',
              backgroundColor: 
                activeItem.type === 'variable' ? '#d1e7ff' :
                activeItem.type === 'operator' ? '#ffd1d1' : '#d1ffd1',
              boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
              cursor: 'grabbing',
            }}>
              {activeItem.value}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    );
  };

  // Render conditional editor for Conditional nodes
  const renderConditionalEditor = () => {
    if (!selectedNode || selectedNode.type !== 'Conditional') return null;
    
    const allVariables = getAllVariables();
    
    // Style for expression box
    const expressionBoxStyle = {
      padding: '10px',
      border: '1px solid #ccc',
      borderRadius: '4px',
      minHeight: '50px',
      marginBottom: '15px',
      backgroundColor: '#f9f9f9',
    };
    
    // Style for section boxes
    const sectionStyle = {
      marginBottom: '15px',
      border: '1px solid #ddd',
      borderRadius: '4px',
      padding: '10px',
    };
    
    return (
      <DndContext
        sensors={sensors}
        collisionDetection={rectIntersection}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        // TODO: horizontal restriction does not work properly with vertical scrolling
        modifiers={isReordering ? [restrictToHorizontalAxis] : undefined}
      >
        <div key={selectedNode.id}>
          <h4>Conditional Expression</h4>
          
          {/* Expression display box */}
          <div style={{ marginBottom: '15px' }}>
            <h5 style={{ marginTop: 0, marginBottom: '5px' }}>Condition</h5>
            <div style={expressionBoxStyle}>
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                {/* Left side expression */}
                <div style={{ flex: '1' }}>
                  <ExpressionDropArea id="left-expression-drop-area" disabled={isRunning}>
                    <SortableContext 
                      items={expression?.leftSide && Array.isArray(expression.leftSide) 
                          ? expression.leftSide.map(item => item.id) 
                          : []}
                      strategy={horizontalListSortingStrategy}
                    >
                      {expression?.leftSide && Array.isArray(expression.leftSide) ? (
                        expression.leftSide.map((element, index) => (
                          <DraggableExpressionElement 
                            key={element.id}
                            element={element}
                            index={index}
                            removeExpressionElement={removeExpressionElement}
                            disabled={isRunning}
                          />
                        ))
                      ) : (
                        <span style={{ color: '#888', fontStyle: 'italic' }}>
                          Drag elements here to build left side
                        </span>
                      )}
                    </SortableContext>
                  </ExpressionDropArea>
                </div>
                
                {/* Equality operator selector */}
                <div>
                  <select
                    value={expression?.equality || '=='}
                    onChange={(e) => {
                      setExpression(prev => {
                        if (!prev) return null;
                        const newExpr = prev.clone();
                        newExpr.equality = e.target.value as IEquality;
                        return newExpr;
                      });
                    }}
                    style={{
                      padding: '8px',
                      borderRadius: '4px',
                      border: '1px solid #ccc',
                      backgroundColor: isRunning ? '#f0f0f0' : 'white',
                      cursor: isRunning ? 'not-allowed' : 'pointer',
                      fontWeight: 'bold'
                    }}
                    disabled={isRunning}
                  >
                    {equalities.map(eq => (
                      <option key={eq} value={eq}>{eq}</option>
                    ))}
                  </select>
                </div>
                
                {/* Right side expression */}
                <div style={{ flex: '1' }}>
                  <ExpressionDropArea id="right-expression-drop-area" disabled={isRunning}>
                    <SortableContext 
                      items={expression?.rightSide.map(item => item.id) || []}
                      strategy={horizontalListSortingStrategy}
                    >
                      {expression?.rightSide.map((element, index) => (
                        <DraggableExpressionElement 
                          key={element.id}
                          element={element}
                          index={index}
                          removeExpressionElement={removeExpressionElement}
                          disabled={isRunning}
                        />
                      )) || (
                        <span style={{ color: '#888', fontStyle: 'italic' }}>
                          Drag elements here to build right side
                        </span>
                      )}
                    </SortableContext>
                  </ExpressionDropArea>
                </div>
              </div>
            </div>
          </div>
          
          {/* Building blocks section */}
          <>
            {/* Variables section */}
            <div style={sectionStyle}>
              <h5 style={{ marginTop: 0, marginBottom: '10px' }}>Variables</h5>
              <div>
                {allVariables.map(variable => (
                  <DraggablePaletteItem
                    key={`var-${variable.id}`}
                    id={`var-${variable.id}`}
                    type="variable"
                    value={variable.name}
                    backgroundColor="#d1e7ff"
                    disabled={isRunning}
                  />
                ))}
                {allVariables.length === 0 && (
                  <div style={{ color: '#888', fontStyle: 'italic' }}>No variables declared</div>
                )}
              </div>
            </div>
            
            {/* Operators section */}
            <div style={sectionStyle}>
              <h5 style={{ marginTop: 0, marginBottom: '10px' }}>Operators</h5>
              <div>
                {operators.map(op => (
                  <DraggablePaletteItem
                    key={`op-${op}`}
                    id={`op-${op}`}
                    type="operator"
                    value={op}
                    backgroundColor="#ffd1d1"
                    disabled={isRunning}
                  />
                ))}
              </div>
            </div>
            
            {/* Literals section */}
            <div style={sectionStyle}>
              <h5 style={{ marginTop: 0, marginBottom: '10px' }}>Literals</h5>
              
              {/* String literal */}
              <div>
                <h6 style={{ margin: '5px 0' }}>String</h6>
                <input 
                  type="text" 
                  placeholder="String value" 
                  id="conditional-string-literal-input"
                  style={{ width: '60%', padding: '4px', marginRight: '5px' }}
                  disabled={isRunning}
                />
                <div style={{ display: 'flex', gap: '5px', marginTop: '5px' }}>
                  <button
                    onClick={() => {
                      const input = document.getElementById('conditional-string-literal-input') as HTMLInputElement;
                      if (input && input.value) {
                        const value = input.value;
                        const element = new ExpressionElement(
                          crypto.randomUUID(),
                          'literal',
                          `"${value}"`
                        );
                        addExpressionElement(element, 'left');
                        input.value = '';
                      }
                    }}
                    style={{ 
                      padding: '4px 8px',
                      backgroundColor: '#d1ffd1',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      cursor: isRunning ? 'not-allowed' : 'pointer',
                      opacity: isRunning ? 0.5 : 1,
                      fontSize: '12px'
                    }}
                    disabled={isRunning}
                  >
                    Add to Left
                  </button>
                  <button
                    onClick={() => {
                      const input = document.getElementById('conditional-string-literal-input') as HTMLInputElement;
                      if (input && input.value) {
                        const value = input.value;
                        const element = new ExpressionElement(
                          crypto.randomUUID(),
                          'literal',
                          `"${value}"`
                        );
                        addExpressionElement(element, 'right');
                        input.value = '';
                      }
                    }}
                    style={{ 
                      padding: '4px 8px',
                      backgroundColor: '#d1ffd1',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      cursor: isRunning ? 'not-allowed' : 'pointer',
                      opacity: isRunning ? 0.5 : 1,
                      fontSize: '12px'
                    }}
                    disabled={isRunning}
                  >
                    Add to Right
                  </button>
                </div>
              </div>
              
              {/* Integer literal */}
              <div style={{ marginTop: '10px' }}>
                <h6 style={{ margin: '5px 0' }}>Integer</h6>
                <input 
                  type="number" 
                  step="1"
                  placeholder="Integer value" 
                  id="conditional-integer-literal-input"
                  style={{ width: '60%', padding: '4px', marginRight: '5px' }}
                  disabled={isRunning}
                />
                <div style={{ display: 'flex', gap: '5px', marginTop: '5px' }}>
                  <button
                    onClick={() => {
                      const input = document.getElementById('conditional-integer-literal-input') as HTMLInputElement;
                      if (input && input.value) {
                        const value = parseInt(input.value).toString(); // Ensure it's an integer
                        const element = new ExpressionElement(
                          crypto.randomUUID(),
                          'literal',
                          value
                        );
                        addExpressionElement(element, 'left');
                        input.value = '';
                      }
                    }}
                    style={{ 
                      padding: '4px 8px',
                      backgroundColor: '#d1ffd1',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      cursor: isRunning ? 'not-allowed' : 'pointer',
                      opacity: isRunning ? 0.5 : 1,
                      fontSize: '12px'
                    }}
                    disabled={isRunning}
                  >
                    Add to Left
                  </button>
                  <button
                    onClick={() => {
                      const input = document.getElementById('conditional-integer-literal-input') as HTMLInputElement;
                      if (input && input.value) {
                        const value = parseInt(input.value).toString(); // Ensure it's an integer
                        const element = new ExpressionElement(
                          crypto.randomUUID(),
                          'literal',
                          value
                        );
                        addExpressionElement(element, 'right');
                        input.value = '';
                      }
                    }}
                    style={{ 
                      padding: '4px 8px',
                      backgroundColor: '#d1ffd1',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      cursor: isRunning ? 'not-allowed' : 'pointer',
                      opacity: isRunning ? 0.5 : 1,
                      fontSize: '12px'
                    }}
                    disabled={isRunning}
                  >
                    Add to Right
                  </button>
                </div>
              </div>
              
              {/* Float literal */}
              <div style={{ marginTop: '10px' }}>
                <h6 style={{ margin: '5px 0' }}>Float</h6>
                <input 
                  type="number" 
                  step="0.1"
                  placeholder="Float value"
                  id="conditional-float-literal-input"
                  style={{ width: '60%', padding: '4px', marginRight: '5px' }}
                  disabled={isRunning}
                />
                <div style={{ display: 'flex', gap: '5px', marginTop: '5px' }}>
                  <button
                    onClick={() => {
                      const input = document.getElementById('conditional-float-literal-input') as HTMLInputElement;
                      if (input && input.value) {
                        const value = parseFloat(input.value).toString();
                        const element = new ExpressionElement(
                          crypto.randomUUID(),
                          'literal',
                          value
                        );
                        addExpressionElement(element, 'left');
                        input.value = '';
                      }
                    }}
                    style={{ 
                      padding: '4px 8px',
                      backgroundColor: '#d1ffd1',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      cursor: isRunning ? 'not-allowed' : 'pointer',
                      opacity: isRunning ? 0.5 : 1,
                      fontSize: '12px'
                    }}
                    disabled={isRunning}
                  >
                    Add to Left
                  </button>
                  <button
                    onClick={() => {
                      const input = document.getElementById('conditional-float-literal-input') as HTMLInputElement;
                      if (input && input.value) {
                        const value = parseFloat(input.value).toString();
                        const element = new ExpressionElement(
                          crypto.randomUUID(),
                          'literal',
                          value
                        );
                        addExpressionElement(element, 'right');
                        input.value = '';
                      }
                    }}
                    style={{ 
                      padding: '4px 8px',
                      backgroundColor: '#d1ffd1',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      cursor: isRunning ? 'not-allowed' : 'pointer',
                      opacity: isRunning ? 0.5 : 1,
                      fontSize: '12px'
                    }}
                    disabled={isRunning}
                  >
                    Add to Right
                  </button>
                </div>
              </div>
              
              {/* Boolean literals */}
              <div style={{ marginTop: '10px' }}>
                <h6 style={{ margin: '5px 0' }}>Boolean</h6>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <div>
                    <span style={{ marginBottom: '5px', display: 'block', fontSize: '12px', fontWeight: 'bold' }}>Left side:</span>
                    <div>
                      <button
                        onClick={() => {
                          const element = new ExpressionElement(
                            crypto.randomUUID(),
                            'literal',
                            'true'
                          );
                          addExpressionElement(element, 'left');
                        }}
                        style={{ 
                          padding: '4px 8px',
                          backgroundColor: '#d1ffd1',
                          border: '1px solid #ccc',
                          borderRadius: '4px',
                          cursor: isRunning ? 'not-allowed' : 'pointer',
                          margin: '2px',
                          opacity: isRunning ? 0.5 : 1
                        }}
                        disabled={isRunning}
                      >
                        true
                      </button>
                      <button
                        onClick={() => {
                          const element = new ExpressionElement(
                            crypto.randomUUID(),
                            'literal',
                            'false'
                          );
                          addExpressionElement(element, 'left');
                        }}
                        style={{ 
                          padding: '4px 8px',
                          backgroundColor: '#d1ffd1',
                          border: '1px solid #ccc',
                          borderRadius: '4px',
                          cursor: isRunning ? 'not-allowed' : 'pointer',
                          margin: '2px',
                          opacity: isRunning ? 0.5 : 1
                        }}
                        disabled={isRunning}
                      >
                        false
                      </button>
                    </div>
                  </div>
                  <div>
                    <span style={{ marginBottom: '5px', display: 'block', fontSize: '12px', fontWeight: 'bold' }}>Right side:</span>
                    <div>
                      <button
                        onClick={() => {
                          const element = new ExpressionElement(
                            crypto.randomUUID(),
                            'literal',
                            'true'
                          );
                          addExpressionElement(element, 'right');
                        }}
                        style={{ 
                          padding: '4px 8px',
                          backgroundColor: '#d1ffd1',
                          border: '1px solid #ccc',
                          borderRadius: '4px',
                          cursor: isRunning ? 'not-allowed' : 'pointer',
                          margin: '2px',
                          opacity: isRunning ? 0.5 : 1
                        }}
                        disabled={isRunning}
                      >
                        true
                      </button>
                      <button
                        onClick={() => {
                          const element = new ExpressionElement(
                            crypto.randomUUID(),
                            'literal',
                            'false'
                          );
                          addExpressionElement(element, 'right');
                        }}
                        style={{ 
                          padding: '4px 8px',
                          backgroundColor: '#d1ffd1',
                          border: '1px solid #ccc',
                          borderRadius: '4px',
                          cursor: isRunning ? 'not-allowed' : 'pointer',
                          margin: '2px',
                          opacity: isRunning ? 0.5 : 1
                        }}
                        disabled={isRunning}
                      >
                        false
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        </div>
        
        <DragOverlay>
          {activeItem ? (
            <div style={{
              padding: '4px 8px',
              margin: '4px',
              borderRadius: '4px',
              fontSize: '14px',
              backgroundColor: 
                activeItem.type === 'variable' ? '#d1e7ff' :
                activeItem.type === 'operator' ? '#ffd1d1' : '#d1ffd1',
              boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
              cursor: 'grabbing',
            }}>
              {activeItem.value}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    );
  };

  // Render input editor for Input nodes
  const renderInputEditor = () => {
    if (!selectedNode || selectedNode.type !== 'Input') return null;
    
    const allVariables = getAllVariables();
    
    // Style for section boxes
    const sectionStyle = {
      marginBottom: '15px',
      border: '1px solid #ddd',
      borderRadius: '4px',
      padding: '10px',
    };
    
    return (
      <div key={selectedNode.id}>
        <h4>Input Configuration</h4>
        
        {/* Variable selection */}
        <div style={sectionStyle}>
          <h5 style={{ marginTop: 0, marginBottom: '10px' }}>Select Input Variable</h5>
          <select
            value={leftSideVariable}
            onChange={(e) => {
              const newValue = e.target.value;
              setLeftSideVariable(newValue);
            }}
            style={{
              width: '100%',
              padding: '8px',
              borderRadius: '4px',
              border: '1px solid #ccc',
              backgroundColor: isRunning ? '#f0f0f0' : 'white',
              cursor: isRunning ? 'not-allowed' : 'pointer'
            }}
            disabled={isRunning}
          >
            <option value="">-- Select Variable --</option>
            {allVariables.map(variable => (
              <option key={variable.id} value={variable.id}>
                {variable.name} ({variable.type})
              </option>
            ))}
          </select>
          
          <div style={{ marginTop: '15px', fontStyle: 'italic', color: '#888' }}>
            During execution, the program will prompt for this variable's value.
          </div>
        </div>
      </div>
    );
  };
    
  return (
    <>
      <h3>Details</h3>
      {selectedNode ? (
        <div style={{ 
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          {/* Header section */}
          <div style={{ flexShrink: 0 }}>
            <p>Node ID: <strong>{selectedNode.id}</strong></p>
            <p>Type: {selectedNode.type || 'default'}</p>
            <p>Label: {selectedNode.data.label}</p>
            <p>Position: x={selectedNode.position.x.toFixed(2)}, y={selectedNode.position.y.toFixed(2)}</p>
            {renderVariableEditor()}
          </div>

          {/* Scrollable editors */}
          <div 
            ref={scrollableContainerRef}
            style={{ 
              flex: 1,
              overflowY: 'auto',
              marginTop: '20px'
            }}
          >
            {renderAssignmentEditor()}
            {renderOutputEditor()}
            {renderConditionalEditor()}
            {renderInputEditor()}
          </div>
        </div>
      ) : (
        <p>No node selected</p>
      )}
    </>
  );
};

export default DetailsTab;