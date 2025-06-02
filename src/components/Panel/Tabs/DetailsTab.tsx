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
import { variableTypes } from '../../../models';
import { useFlowExecutorContext } from '../../../context/FlowExecutorContext';
import { operators as expressionOperators, equalities, IEquality } from '../../../models/Expression';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Label } from "@/components/ui/label";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";

// TODO: if cannot select element while running, then also hide its editor in DetailsTab for consistency (i prefer being able to select elements while running and see their values but not modify them)

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

  const bgColor = 
    element.type === 'variable' ? 'bg-blue-100' :
    element.type === 'operator' ? 'bg-red-100' : 'bg-green-100';

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      {...attributes}
      {...listeners}
      className={`
        group relative inline-block px-2 py-1 m-1 rounded text-sm
        ${bgColor}
        ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-grab'}
        ${isDragging ? 'opacity-0' : 'opacity-100'}
      `}
    >
      <span>{element.value}</span>
      <Button
        variant="ghost"
        size="sm"
        onClick={(e) => {
          e.stopPropagation();
          removeExpressionElement(element.id);
        }}
        disabled={disabled}
        className="ml-1 h-4 w-4 p-0 text-xs opacity-70 hover:opacity-100"
      >
        ×
      </Button>
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

  // Map background colors to Tailwind classes
  const bgColorClass = 
    backgroundColor === '#d1e7ff' ? 'bg-blue-100' :
    backgroundColor === '#ffd1d1' ? 'bg-red-100' :
    backgroundColor === '#d1ffd1' ? 'bg-green-100' : 'bg-gray-200';

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`
        inline-block px-2 py-1 m-1 rounded text-sm
        ${bgColorClass}
        ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-grab'}
      `}
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
      className={`
        p-2.5 
        ${isOver 
          ? 'border-2 border-solid border-blue-400 bg-blue-50' 
          : 'border-2 border-dashed border-gray-300 bg-transparent'
        }
        rounded 
        min-h-[60px] 
        flex 
        flex-wrap 
        items-center
        ${disabled ? 'opacity-50' : ''}
      `}
    >
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
  const additionalInfoRef = useRef<HTMLDivElement>(null); // Ref for auto-scrolling to additional info

  const [expression, setExpression] = useState<Expression | null>(null);
  
  const reactFlowInstance = useReactFlow();
  
  const [_activeId, setActiveId] = useState<string | null>(null);
  const [activeItem, setActiveItem] = useState<ExpressionElement | null>(null);
  const [isReordering, setIsReordering] = useState(false);
  const [assignmentTab, setAssignmentTab] = useState<'variables' | 'literals'>('variables');
  const [conditionalTab, setConditionalTab] = useState<'variables' | 'literals'>('variables');
  const [outputTab, setOutputTab] = useState<'variables' | 'literals'>('variables');
  
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
    if (selectedNode?.type === 'AssignVariable') {
      if (leftSideVariable) {
        const varInstance = getAllVariables().find(v => v.id === leftSideVariable);

        if (!varInstance) {
          if (expression !== null) setExpression(null);
          return;
        }

        // Only update if the left side has changed or if the expression is null
        if (!expression || (expression.leftSide instanceof Variable && expression.leftSide.id !== varInstance.id)) {
          // Preserve right side if expression already exists and has one
          setExpression(new Expression(varInstance, expression?.rightSide || []));
        }
      } else { // AssignVariable selected, but no variable chosen for its LHS, so reset expression
        if (expression !== null) setExpression(null);
      }
    }
    // For other node types, their expressions are managed by the main useEffect hook that listens to selectedNode changes
    // and reloads/initializes expressions from node.data. This hook should not interfere.
  }, [leftSideVariable, selectedNode, getAllVariables, expression]);

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
  
  // Update the node data when variable changes for Input node (TODO: is this needed or already done in other useEffect?) [needed for this specific case because of variable]
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
      <Card className="mt-5">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Variable Declaration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {variables.map((variable) => (
            <div key={variable.id} className="flex items-center gap-2">
              <Select
                value={variable.type}
                onValueChange={(value) => updateVariable(variable.id, 'type', value)}
                disabled={isRunning}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {variableTypes.map(type => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Input
                value={variable.name}
                onChange={(e) => updateVariable(variable.id, 'name', e.target.value)}
                placeholder="Variable name"
                className="flex-1"
                disabled={isRunning}
              />
              
              {variables.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteVariable(variable.id)}
                  disabled={isRunning}
                  className="px-2 text-destructive hover:text-destructive"
                >
                  ×
                </Button>
              )}
            </div>
          ))}
          
          <Button
            onClick={addVariable}
            variant="outline"
            className="w-full mt-3"
            disabled={isRunning}
          >
            + Add variable
          </Button>
        </CardContent>
      </Card>
    );
  };

  // TODO: refactor editors to other files (?)
  
  // Render assignment editor for AssignVariable nodes
  const renderAssignmentEditor = () => {
    if (!selectedNode || selectedNode.type !== 'AssignVariable') return null;
    
    const allVariables = getAllVariables();
    
    return (
      <DndContext
        sensors={sensors}
        collisionDetection={rectIntersection}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div key={selectedNode.id}>
          <h4>Variable Assignment</h4>
          
          {/* Assignment expression display box */}
          <Card className="mb-4">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-4">
                <div className="flex-none min-w-[200px]">
                  <Label className="text-sm font-medium">Variable</Label>
                </div>
                <div className="flex-none w-6 text-center">
                  {/* Spacer for equals sign */}
                </div>
                <div className="flex-1">
                  <Label className="text-sm font-medium">Expression</Label>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="min-h-[50px] p-2 bg-muted/30 border rounded">
                <div className="flex items-center gap-4">
                  {/* Variable selection */}
                  <div className="flex-none min-w-[200px]">
                    <Select
                      value={leftSideVariable}
                      onValueChange={(value) => setLeftSideVariable(value === '__CLEAR__' ? '' : value)}
                      disabled={isRunning}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="No variable" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__CLEAR__">No variable</SelectItem>
                        {allVariables.map(variable => (
                          <SelectItem key={variable.id} value={variable.id}>
                            {variable.name} ({variable.type})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Equals sign */}
                  <div className="flex-none w-6 text-center">
                    <span className="text-lg font-bold">=</span>
                  </div>
                  
                  {/* Expression area */}
                  <div className="flex-1">
                    {leftSideVariable && expression ? (
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
                    ) : (
                      <div className="p-2.5 border-2 border-dashed border-gray-300 rounded min-h-[60px] flex items-center justify-center bg-transparent">
                        <span className="text-muted-foreground text-sm italic">
                          Select a variable to build expression
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Building blocks: variables, operators, literals */}
          {leftSideVariable && (
            <>
              <div className="grid grid-cols-2 gap-4 mb-4">
                {/* Left column: Tabbed Variables and Literals */}
                <Card>
                  <CardHeader className="pb-2">
                    <Tabs value={assignmentTab} onValueChange={(value) => setAssignmentTab(value as 'variables' | 'literals')} className="w-full">
                      <TabsList className="grid grid-cols-2 w-full">
                        <TabsTrigger value="variables">Variables</TabsTrigger>
                        <TabsTrigger value="literals">Literals</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </CardHeader>
                  <CardContent>
                    <Tabs value={assignmentTab} onValueChange={(value) => setAssignmentTab(value as 'variables' | 'literals')}>
                      <TabsContent value="variables" className="mt-0">
                        <div className="space-y-2">
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
                            <div className="text-muted-foreground text-sm italic">No variables declared</div>
                          )}
                        </div>
                      </TabsContent>
                      
                      <TabsContent value="literals" className="mt-0">
                        <div className="space-y-3">
                          {/* Boolean literals */}
                          <div className="space-y-1">
                            <Label className="text-xs font-medium">Boolean</Label>
                            <div className="flex gap-1">
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
                          
                          {/* String literal */}
                          <div className="space-y-1">
                            <Label className="text-xs font-medium">String</Label>
                            <div className="flex gap-1">
                              <Input
                                type="text"
                                placeholder="String value"
                                id="string-literal-input"
                                className="flex-1 text-sm"
                                disabled={isRunning}
                              />
                              <Button
                                variant="outline"
                                size="sm"
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
                                disabled={isRunning}
                                className="text-xs px-2"
                              >
                                Add
                              </Button>
                            </div>
                          </div>
                          
                          {/* Integer literal */}
                          <div className="space-y-1">
                            <Label className="text-xs font-medium">Integer</Label>
                            <div className="flex gap-1">
                              <Input
                                type="number"
                                step="1"
                                placeholder="Integer value" 
                                id="integer-literal-input"
                                className="flex-1 text-sm"
                                disabled={isRunning}
                              />
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const input = document.getElementById('integer-literal-input') as HTMLInputElement;
                                  if (input && input.value) {
                                    const value = parseInt(input.value).toString();
                                    const element = new ExpressionElement(
                                      crypto.randomUUID(),
                                      'literal',
                                      value
                                    );
                                    addExpressionElement(element);
                                    input.value = '';
                                  }
                                }}
                                disabled={isRunning}
                                className="text-xs px-2"
                              >
                                Add
                              </Button>
                            </div>
                          </div>
                          
                          {/* Float literal */}
                          <div className="space-y-1">
                            <Label className="text-xs font-medium">Float</Label>
                            <div className="flex gap-1">
                              <Input
                                type="number"
                                step="0.1"
                                placeholder="Float value"
                                id="float-literal-input"
                                className="flex-1 text-sm"
                                disabled={isRunning}
                              />
                              <Button
                                variant="outline"
                                size="sm"
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
                                disabled={isRunning}
                                className="text-xs px-2"
                              >
                                Add
                              </Button>
                            </div>
                          </div>
                        </div>
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>
                
                {/* Right column: Operators */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Operators</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
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
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
        
        <DragOverlay>
          {activeItem ? (
            <div className={`
              px-2 py-1 m-1 rounded text-sm shadow-lg cursor-grabbing
              ${activeItem.type === 'variable' ? 'bg-blue-100' :
                activeItem.type === 'operator' ? 'bg-red-100' : 'bg-green-100'}
            `}>
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

    return (
      <DndContext
        sensors={sensors}
        collisionDetection={rectIntersection}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div key={selectedNode.id}>
          <h4>Output Expression</h4>

          {/* Expression display box */}
          <Card className="mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Expression</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="min-h-[50px] p-2 bg-muted/30 border rounded">
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
            </CardContent>
          </Card>

          {/* Building blocks section */}
          <div className="grid grid-cols-2 gap-4">
            {/* Left column: Tabbed Variables and Literals */}
            <Card>
              <CardHeader className="pb-2">
                <Tabs value={outputTab} onValueChange={(value) => setOutputTab(value as 'variables' | 'literals')} className="w-full">
                  <TabsList className="grid grid-cols-2 w-full">
                    <TabsTrigger value="variables">Variables</TabsTrigger>
                    <TabsTrigger value="literals">Literals</TabsTrigger>
                  </TabsList>
                </Tabs>
              </CardHeader>
              <CardContent>
                <Tabs value={outputTab} onValueChange={(value) => setOutputTab(value as 'variables' | 'literals')}>
                  <TabsContent value="variables" className="mt-0">
                    <div className="space-y-2">
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
                        <div className="text-muted-foreground text-sm italic">No variables declared</div>
                      )}
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="literals" className="mt-0">
                    <div className="space-y-3">
                      {/* Boolean literals */}
                      <div className="space-y-1">
                        <Label className="text-xs font-medium">Boolean</Label>
                        <div className="flex gap-1">
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
                      
                      {/* String literal */}
                      <div className="space-y-1">
                        <Label className="text-xs font-medium">String</Label>
                        <div className="flex gap-1">
                          <Input
                            type="text"
                            placeholder="String value"
                            id="output-string-literal-input"
                            className="flex-1 text-sm"
                            disabled={isRunning}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const input = document.getElementById('output-string-literal-input') as HTMLInputElement;
                              if (input && input.value) {
                                const element = new ExpressionElement(crypto.randomUUID(), 'literal', `"${input.value}"`);
                                addExpressionElement(element);
                                input.value = '';
                              }
                            }}
                            disabled={isRunning}
                            className="text-xs px-2"
                          >
                            Add
                          </Button>
                        </div>
                      </div>
                      
                      {/* Integer literal */}
                      <div className="space-y-1">
                        <Label className="text-xs font-medium">Integer</Label>
                        <div className="flex gap-1">
                          <Input
                            type="number"
                            step="1"
                            placeholder="Integer value"
                            id="output-integer-literal-input"
                            className="flex-1 text-sm"
                            disabled={isRunning}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const input = document.getElementById('output-integer-literal-input') as HTMLInputElement;
                              if (input && input.value) {
                                const element = new ExpressionElement(crypto.randomUUID(), 'literal', input.value);
                                addExpressionElement(element);
                                input.value = '';
                              }
                            }}
                            disabled={isRunning}
                            className="text-xs px-2"
                          >
                            Add
                          </Button>
                        </div>
                      </div>
                      
                      {/* Float literal */}
                      <div className="space-y-1">
                        <Label className="text-xs font-medium">Float</Label>
                        <div className="flex gap-1">
                          <Input
                            type="number"
                            step="0.1"
                            placeholder="Float value"
                            id="output-float-literal-input"
                            className="flex-1 text-sm"
                            disabled={isRunning}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const input = document.getElementById('output-float-literal-input') as HTMLInputElement;
                              if (input && input.value) {
                                const element = new ExpressionElement(crypto.randomUUID(), 'literal', input.value);
                                addExpressionElement(element);
                                input.value = '';
                              }
                            }}
                            disabled={isRunning}
                            className="text-xs px-2"
                          >
                            Add
                          </Button>
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
            
            {/* Right column: Operators */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Operators</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
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
              </CardContent>
            </Card>
          </div>
        </div>

        <DragOverlay>
          {activeItem ? (
            <div className={`
              px-2 py-1 m-1 rounded text-sm shadow-lg cursor-grabbing
              ${activeItem.type === 'variable' ? 'bg-blue-100' :
                activeItem.type === 'operator' ? 'bg-red-100' : 'bg-green-100'}
            `}>
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
    
    return (
      <DndContext
        sensors={sensors}
        collisionDetection={rectIntersection}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div key={selectedNode.id}>
          <h4>Conditional Expression</h4>
          
          {/* Expression display box */}
          <Card className="mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Condition</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="min-h-[50px] p-2 bg-muted/30 border rounded">
                <div className="flex items-center flex-wrap gap-4">
                  {/* Left side expression */}
                  <div className="flex-1 min-w-[150px]">
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
                          <span className="text-muted-foreground text-sm italic">
                            Drag elements here to build left side
                          </span>
                        )}
                      </SortableContext>
                    </ExpressionDropArea>
                  </div>
                  
                  {/* Equality operator selector */}
                  <div>
                    <Select
                      value={expression?.equality || '=='}
                      onValueChange={(value) => {
                        setExpression(prev => {
                          if (!prev) return null;
                          const newExpr = prev.clone();
                          newExpr.equality = value as IEquality;
                          return newExpr;
                        });
                      }}
                      disabled={isRunning}
                    >
                      <SelectTrigger className="w-20 font-bold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {equalities.map(eq => (
                          <SelectItem key={eq} value={eq}>{eq}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Right side expression */}
                  <div className="flex-1 min-w-[150px]">
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
                          <span className="text-muted-foreground text-sm italic">
                            Drag elements here to build right side
                          </span>
                        )}
                      </SortableContext>
                    </ExpressionDropArea>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Building blocks section */}
          <div className="grid grid-cols-2 gap-4">
            {/* Left column: Tabbed Variables and Literals */}
            <Card>
              <CardHeader className="pb-2">
                <Tabs value={conditionalTab} onValueChange={(value) => setConditionalTab(value as 'variables' | 'literals')} className="w-full">
                  <TabsList className="grid grid-cols-2 w-full">
                    <TabsTrigger value="variables">Variables</TabsTrigger>
                    <TabsTrigger value="literals">Literals</TabsTrigger>
                  </TabsList>
                </Tabs>
              </CardHeader>
              <CardContent>
                <Tabs value={conditionalTab} onValueChange={(value) => setConditionalTab(value as 'variables' | 'literals')}>
                  <TabsContent value="variables" className="mt-0">
                    <div className="space-y-2">
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
                        <div className="text-muted-foreground text-sm italic">No variables declared</div>
                      )}
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="literals" className="mt-0">
                    <div className="space-y-3">
                      {/* Boolean literals */}
                      <div className="space-y-1">
                        <Label className="text-xs font-medium">Boolean</Label>
                        <div className="flex gap-1">
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
                      
                      {/* String literal */}
                      <div className="space-y-1">
                        <Label className="text-xs font-medium">String</Label>
                        <div className="flex gap-1">
                          <Input
                            type="text"
                            placeholder="String value"
                            id="conditional-string-literal-input"
                            className="flex-1 text-sm"
                            disabled={isRunning}
                          />
                          <Button
                            variant="outline"
                            size="sm"
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
                            disabled={isRunning}
                            className="text-xs px-2"
                          >
                            ← Left
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
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
                            disabled={isRunning}
                            className="text-xs px-2"
                          >
                            Right →
                          </Button>
                        </div>
                      </div>
                      
                      {/* Integer literal */}
                      <div className="space-y-1">
                        <Label className="text-xs font-medium">Integer</Label>
                        <div className="flex gap-1">
                          <Input
                            type="number"
                            step="1"
                            placeholder="Integer value"
                            id="conditional-integer-literal-input"
                            className="flex-1 text-sm"
                            disabled={isRunning}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const input = document.getElementById('conditional-integer-literal-input') as HTMLInputElement;
                              if (input && input.value) {
                                const value = parseInt(input.value).toString();
                                const element = new ExpressionElement(
                                  crypto.randomUUID(),
                                  'literal',
                                  value
                                );
                                addExpressionElement(element, 'left');
                                input.value = '';
                              }
                            }}
                            disabled={isRunning}
                            className="text-xs px-2"
                          >
                            ← Left
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const input = document.getElementById('conditional-integer-literal-input') as HTMLInputElement;
                              if (input && input.value) {
                                const value = parseInt(input.value).toString();
                                const element = new ExpressionElement(
                                  crypto.randomUUID(),
                                  'literal',
                                  value
                                );
                                addExpressionElement(element, 'right');
                                input.value = '';
                              }
                            }}
                            disabled={isRunning}
                            className="text-xs px-2"
                          >
                            Right →
                          </Button>
                        </div>
                      </div>
                      
                      {/* Float literal */}
                      <div className="space-y-1">
                        <Label className="text-xs font-medium">Float</Label>
                        <div className="flex gap-1">
                          <Input
                            type="number"
                            step="0.1"
                            placeholder="Float value"
                            id="conditional-float-literal-input"
                            className="flex-1 text-sm"
                            disabled={isRunning}
                          />
                          <Button
                            variant="outline"
                            size="sm"
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
                            disabled={isRunning}
                            className="text-xs px-2"
                          >
                            ← Left
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
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
                            disabled={isRunning}
                            className="text-xs px-2"
                          >
                            Right →
                          </Button>
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
            
            {/* Right column: Operators */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Operators</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
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
              </CardContent>
            </Card>
          </div>
        </div>
        
        <DragOverlay>
          {activeItem ? (
            <div className={`
              px-2 py-1 m-1 rounded text-sm shadow-lg cursor-grabbing
              ${activeItem.type === 'variable' ? 'bg-blue-100' :
                activeItem.type === 'operator' ? 'bg-red-100' : 'bg-green-100'}
            `}>
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
    
    return (
      <div key={selectedNode.id}>
        <h4>Input Configuration</h4>
        
        {/* Variable selection */}
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Select Input Variable</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select
              value={leftSideVariable}
              onValueChange={(value) => setLeftSideVariable(value === '__CLEAR__' ? '' : value)}
              disabled={isRunning}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="No variable" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__CLEAR__">No variable</SelectItem>
                {allVariables.map(variable => (
                  <SelectItem key={variable.id} value={variable.id}>
                    {variable.name} ({variable.type})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <div className="text-sm text-muted-foreground italic">
              During execution, the program will prompt for this variable's value.
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };
    
  return (
    <>
      {selectedNode ? (
        <div className="h-full flex flex-col overflow-hidden">
          {/* Scrollable editors */}
          <div 
            ref={scrollableContainerRef}
            className="flex-1 overflow-y-auto overflow-x-hidden mt-5"
          >
            {renderVariableEditor()}
            {renderAssignmentEditor()}
            {renderOutputEditor()}
            {renderConditionalEditor()}
            {renderInputEditor()}
            
            {/* Additional information accordion - shown for any selected node */}
            {selectedNode && (
              <div ref={additionalInfoRef} className="w-full">
                <Accordion type="single" collapsible className="mt-5">
                  <AccordionItem value="additional-info">
                    <AccordionTrigger 
                      className="text-sm"
                      onClick={() => {
                        // Auto-scroll when expanded (with delay to allow full accordion animation)
                        setTimeout(() => {
                          if (additionalInfoRef.current && scrollableContainerRef.current) {
                            // First try scrollIntoView
                            additionalInfoRef.current.scrollIntoView({ 
                              behavior: 'smooth', 
                              block: 'end'
                            });
                            
                            // Fallback: scroll to the very bottom of the container
                            setTimeout(() => {
                              if (scrollableContainerRef.current) {
                                scrollableContainerRef.current.scrollTop = scrollableContainerRef.current.scrollHeight;
                              }
                            }, 100);
                          }
                        }, 300); // TODO: smoother/faster animation
                      }}
                    >
                      Additional information
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-2 text-sm break-words overflow-hidden">
                        <p className="break-all"><span className="font-medium">Node ID:</span> {selectedNode.data.visualId}</p>
                        <p><span className="font-medium">Type:</span> {selectedNode.type || 'default'}</p>
                        <p className="break-words"><span className="font-medium">Label:</span> {selectedNode.data.label}</p>
                        <p><span className="font-medium">Position:</span> x={selectedNode.position.x.toFixed(2)}, y={selectedNode.position.y.toFixed(2)}</p>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            )}
          </div>
        </div>
      ) : (
        <p>No node selected</p>
      )}
    </>
  );
};

export default DetailsTab;