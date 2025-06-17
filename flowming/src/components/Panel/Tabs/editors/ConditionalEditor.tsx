import { useContext, useState, useEffect, useRef } from 'react';
import { SelectedNodeContext } from '../../../../context/SelectedNodeContext';
import { useVariables } from '../../../../context/VariablesContext';
import { useReactFlow } from '@xyflow/react';
import { Expression, ExpressionElement, Variable } from '../../../../models';
import {
  DndContext, 
  useSensors, 
  useSensor, 
  PointerSensor,
  DragOverlay,
  rectIntersection
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { operators as expressionOperators, equalities, IEquality } from '../../../../models/Expression';
import { useFlowExecutorState } from '../../../../context/FlowExecutorContext';
import { CSS } from '@dnd-kit/utilities';

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
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";

import { 
  DraggableExpressionElement, 
  DraggablePaletteItem, 
  ExpressionDropArea,
} from './shared/DragAndDropComponents';
import ArrayIndexDialog from '@/components/ui/ArrayIndexDialog';
import { parseArrayAccess, parseExpressionString } from '@/utils/expressionParsing';

// Available operators for expression building
const operators = [
  ...expressionOperators
];

// Helper to generate UUID
const uuid = () => crypto.randomUUID();

// Interface to describe the location of an element for drag & drop logic
interface ElementLocation {
  id: string; // Original ID from the event (active.id or over.id)
  isPaletteItem: boolean;
  isMainDropArea: boolean; // e.g., 'left-expression-drop-area' or 'right-expression-drop-area'
  isMainExpressionElement: boolean;
  isNestedDropArea: boolean;
  isNestedExpressionElement: boolean;
  side?: 'left' | 'right'; // Indicates if the main element/area is on the left or right
  funcId?: string; // ID of the parent function if nested
  funcIdPath?: string[]; // Full path of parent function IDs for deep nesting
  elementActualId?: string; // The ID of the element itself (if not a drop area or palette)
  item?: ExpressionElement; // The actual ExpressionElement if it's an existing one
  index?: number; // Index in its respective list (main or nested)
}

// Helper function to create new expression element
const createNewElement = (activeItem: ExpressionElement, getAllVars: () => Variable[]): ExpressionElement | null => {
  if (activeItem.type === 'variable') {
    // For palette items, activeItem.variable might not be a full Variable instance yet,
    // so we re-fetch from getAllVars using the ID if it was a palette drag (id like 'var-someId')
    // or use the embedded variable directly if it's an existing ExpressionElement being cloned.
    const varId = activeItem.variable?.id || (activeItem.id.startsWith('var-') ? activeItem.id.replace('var-', '') : null);
    if (varId) {
      const variable = getAllVars().find(v => v.id === varId);
      if (variable) {
        return new ExpressionElement(uuid(), 'variable', variable.name, variable);
      }
    }
    // If activeItem.variable exists and is a full instance (e.g. cloning an existing element)
    if (activeItem.variable instanceof Variable) {
      return new ExpressionElement(uuid(), 'variable', activeItem.variable.name, activeItem.variable.clone());
    }
    return null;
  } else if (activeItem.type === 'function') {
    const nestedExpr = activeItem.nestedExpression ? activeItem.nestedExpression.clone() : new Expression(undefined, []);
    return new ExpressionElement(uuid(), 'function', activeItem.value, nestedExpr);
  } else {
    // For literals and operators, value is usually sufficient.
    // The original ID from activeItem (palette ID) isn't used for the new element.
    return new ExpressionElement(uuid(), activeItem.type, activeItem.value);
  }
};

// Props for function expression element
interface FunctionExpressionElementProps {
  element: ExpressionElement;
  removeExpressionElement: (id: string) => void;
  disabled: boolean;
  side: 'left' | 'right';
}

// Function block component for nesting
const FunctionExpressionElement: React.FC<FunctionExpressionElementProps> = ({ element, removeExpressionElement, disabled, side }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: element.id, disabled });
  
  const nestedDropId = `nested-${side}-${element.id}`;
  const nestedElements = element.nestedExpression?.rightSide || [];
  const nestedItems = nestedElements.map(e => e.id);

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      className={`
        relative inline-flex items-center p-2 m-1 rounded-lg text-sm bg-purple-100 border border-purple-200
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-grab hover:bg-purple-150'}
        ${isDragging ? 'opacity-30' : 'opacity-100'}
        transition-all duration-200
      `}
    >
      <span className="font-medium text-purple-700 mr-1">{element.value}</span>
      <span className="text-purple-600 font-bold">(</span>
      <div className="flex-1 min-w-[60px] mx-1">
        <ExpressionDropArea id={nestedDropId} disabled={disabled}>
          <SortableContext items={nestedItems} strategy={horizontalListSortingStrategy}>
            {nestedElements.length > 0 ? (
              nestedElements.map((nestedElem: ExpressionElement, idx: number) => (
                nestedElem.isFunction() ? (
                  <FunctionExpressionElement
                    key={nestedElem.id}
                    element={nestedElem}
                    removeExpressionElement={removeExpressionElement}
                    disabled={disabled}
                    side={side}
                  />
                ) : (
                  <DraggableExpressionElement
                    key={nestedElem.id}
                    element={nestedElem}
                    index={idx}
                    removeExpressionElement={removeExpressionElement}
                    disabled={disabled}
                  />
                )
              ))
            ) : (
              <span className="text-purple-400 text-xs italic">drop here</span>
            )}
          </SortableContext>
        </ExpressionDropArea>
      </div>
      <span className="text-purple-600 font-bold">)</span>
      <Button
        variant="ghost"
        size="sm"
        onClick={(e) => { e.stopPropagation(); removeExpressionElement(element.id); }}
        disabled={disabled}
        className="ml-1 h-5 w-5 p-0 text-purple-600 hover:text-red-600 hover:bg-red-50 rounded-full"
      >
        ×
      </Button>
    </div>
  );
};

const ConditionalEditor = () => {
  const { selectedNode } = useContext(SelectedNodeContext);
  const { getAllVariables } = useVariables();
  const isInitialLoadRef = useRef(true);
  const previousNodeIdRef = useRef<string | null>(null);
  const [expression, setExpression] = useState<Expression | null>(null);
  const [isIndexDialogOpen, setIsIndexDialogOpen] = useState(false);
  const [arrayVariableForIndex, setArrayVariableForIndex] = useState<Variable | null>(null);
  const [indexSide, setIndexSide] = useState<'left' | 'right'>('left');
  const [conditionalTab, setConditionalTab] = useState<'variables' | 'literals' | 'functions'>('variables');
  const [_activeId, setActiveId] = useState<string | null>(null);
  const [activeDraggableItem, setActiveDraggableItem] = useState<ExpressionElement | null>(null);
  
  // State for editing existing array access elements
  const [editingElement, setEditingElement] = useState<ExpressionElement | null>(null);
  const [initialExpression, setInitialExpression] = useState<Expression | null>(null);
  const [initialRangeStart, setInitialRangeStart] = useState<Expression | null>(null);
  const [initialRangeEnd, setInitialRangeEnd] = useState<Expression | null>(null);
  const [initialTab, setInitialTab] = useState<'single' | 'range'>('single');
  
  const reactFlowInstance = useReactFlow();
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const { isRunning } = useFlowExecutorState();

  const findFunctionElementById = (elements: ExpressionElement[], id: string): ExpressionElement | null => {
    if (!elements) return null;
    for (const element of elements) {
      if (element.id === id && element.isFunction()) {
        return element;
      }
      if (element.isFunction() && element.nestedExpression) {
        const found = findFunctionElementById(element.nestedExpression.rightSide, id);
        if (found) {
          return found;
        }
      }
    }
    return null;
  };

  // Update the node data when expression changes
  useEffect(() => {
    if (selectedNode?.type === 'Conditional' && !isInitialLoadRef.current) {
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

  // Load conditional data when the selected node changes or when its data changes (for collaboration)
  useEffect(() => {
    // Reset initial load flag
    isInitialLoadRef.current = true;
    
    if (selectedNode && selectedNode.type === 'Conditional') {
      // Load conditional data if available or if data has changed (collaboration)
      const nodeChanged = previousNodeIdRef.current !== selectedNode.id;
      const hasExpressionData = selectedNode.data.expression;
      
      if (nodeChanged) {
        previousNodeIdRef.current = selectedNode.id;
      }
      
      // Always update if node changed OR if we have expression data (to handle collaborative updates)
      if (nodeChanged || hasExpressionData) {
        // Initialize with existing data if available
        if (selectedNode.data.expression) {
          try {
            // Create expression elements from the stored data
            const leftSide = selectedNode.data.expression.leftSide?.map((elem: any) => 
              ExpressionElement.fromObject(elem)
            ) || [];
            
            const rightSide = selectedNode.data.expression.rightSide?.map((elem: any) => 
              ExpressionElement.fromObject(elem)
            ) || [];
            
            // Get equality operator
            const equality = selectedNode.data.expression.equality || '==';

            setExpression(new Expression(leftSide, rightSide, equality));
          } catch (error) {
            console.error('Error creating expression:', error);
          }
        } else if (nodeChanged) {
          // For Conditional, initialize with empty expression only when it's a new node
          setExpression(new Expression([], [], '=='));
        }
      }
    } else {
      previousNodeIdRef.current = null;
      setExpression(null);
    }
    
    isInitialLoadRef.current = false;
  }, [selectedNode, selectedNode?.data?.expression, getAllVariables]);

  // Expression building functions
  const addExpressionElement = (element: ExpressionElement, side?: 'left' | 'right') => {
    if (selectedNode?.type === 'Conditional' && expression && !isRunning) {
      setExpression(prev => {
        if (!prev) return null;
        const newExpr = prev.clone();
        
        // For conditional nodes, check if we need to add to the left side
        if (side === 'left' && Array.isArray(newExpr.leftSide)) {
          newExpr.leftSide = [...newExpr.leftSide, element];
        } else {
          // Otherwise add to the right side (default)
          newExpr.rightSide.push(element);
        }
        
        return newExpr;
      });
    }
  };
  
  // Helper function for left click - adds to left side
  const addElementOnLeftClick = (element: ExpressionElement) => {
    addExpressionElement(element, 'left');
  };
  
  // Helper function for right click - adds to right side
  const addElementOnRightClick = (element: ExpressionElement) => {
    addExpressionElement(element, 'right');
  };
  
  const removeExpressionElement = (id: string) => {
    if (selectedNode?.type === 'Conditional' && expression && !isRunning) {
      setExpression(prev => {
        if (!prev) return null;
        const newExpr = prev.clone();
        newExpr.removeElement(id);
        return newExpr;
      });
    }
  };
  
  // Handle drag start
  const handleDragStart = (event: any) => {
    const { active } = event;
    setActiveId(active.id);

    const findActiveElementRecursive = (elements: ExpressionElement[], id: string): ExpressionElement | null => {
      for (const element of elements) {
        if (element.id === id) {
          return element;
        }
        if (element.isFunction() && element.nestedExpression) {
          const found = findActiveElementRecursive(element.nestedExpression.rightSide, id);
          if (found) {
            return found;
          }
        }
      }
      return null;
    }
    
    let determinedActiveElement: ExpressionElement | null = null;
    
    if (expression) {
      if (Array.isArray(expression.leftSide)) {
        determinedActiveElement = findActiveElementRecursive(expression.leftSide, active.id);
      }
      if (!determinedActiveElement) {
        determinedActiveElement = findActiveElementRecursive(expression.rightSide, active.id);
      }
    }

    if (!determinedActiveElement) {
      // Element is from palette
      if (active.id.startsWith('var-')) {
        const varId = active.id.replace('var-', '');
        const variable = getAllVariables().find(v => v.id === varId);
        if (variable) {
          determinedActiveElement = new ExpressionElement(active.id, 'variable', variable.name, variable);
          if (variable.type === 'array') {
            determinedActiveElement.value = `${variable.name}[]`;
          }
        }
      } else if (active.id.startsWith('op-')) {
        const op = active.id.replace('op-', '');
        determinedActiveElement = new ExpressionElement(active.id, 'operator', op);
      } else if (active.id.startsWith('lit-')) {
        const parts = active.id.split('-');
        if (parts.length >= 3) {
          const value = parts.slice(2).join('-');
          determinedActiveElement = new ExpressionElement(active.id, 'literal', value);
        }
      } else if (active.id.startsWith('func-')) {
        const funcName = active.id.replace('func-', '');
        determinedActiveElement = new ExpressionElement(active.id, 'function', funcName, new Expression(undefined, []));
      }
    }
    setActiveDraggableItem(determinedActiveElement);
  };

  const findElementLocationRecursive = (
    id: string, 
    elements: ExpressionElement[], 
    side: 'left' | 'right', 
    funcIdPath: string[]
  ): ElementLocation | null => {
    for (let index = 0; index < elements.length; index++) {
      const item = elements[index];
      if (item.id === id) {
        if (funcIdPath.length > 0) {
          return {
            id, isPaletteItem: false, isMainDropArea: false, isMainExpressionElement: false, isNestedDropArea: false, isNestedExpressionElement: true,
            side, funcId: funcIdPath[funcIdPath.length - 1], funcIdPath, elementActualId: id, item, index
          };
        } else {
          return {
            id, isPaletteItem: false, isMainDropArea: false, isMainExpressionElement: true, isNestedDropArea: false, isNestedExpressionElement: false,
            side, elementActualId: id, item, index, funcIdPath
          };
        }
      }
      if (item.isFunction() && item.nestedExpression) {
        const found = findElementLocationRecursive(id, item.nestedExpression.rightSide, side, [...funcIdPath, item.id]);
        if (found) return found;
      }
    }
    return null;
  };

  const getElementLocationInfo = (id: string, expr: Expression | null): ElementLocation | null => {
      if (!expr) return null;
  
      if (id.startsWith('var-') || id.startsWith('op-') || id.startsWith('lit-') || id.startsWith('func-')) {
        return { id, isPaletteItem: true, isMainDropArea: false, isMainExpressionElement: false, isNestedDropArea: false, isNestedExpressionElement: false };
      }
      if (id === 'left-expression-drop-area') {
        return { id, isPaletteItem: false, isMainDropArea: true, side: 'left', isMainExpressionElement: false, isNestedDropArea: false, isNestedExpressionElement: false };
      }
      if (id === 'right-expression-drop-area') {
        return { id, isPaletteItem: false, isMainDropArea: true, side: 'right', isMainExpressionElement: false, isNestedDropArea: false, isNestedExpressionElement: false };
      }
      if (id.startsWith('nested-')) {
        const parts = id.replace('nested-', '').split('-');
        const side = parts[0] as 'left' | 'right';
        const funcId = parts.slice(1).join('-');
        const allElements = [...(expr.leftSide as ExpressionElement[]), ...expr.rightSide];
        const funcElemPath = findElementLocationRecursive(funcId, allElements, side, []);
        return { 
            id, isPaletteItem: false, isMainDropArea: false, isMainExpressionElement: false, isNestedDropArea: true, isNestedExpressionElement: false, 
            side, funcId, funcIdPath: funcElemPath ? [...(funcElemPath.funcIdPath || []), funcId] : [funcId]
        };
      }
  
      if (Array.isArray(expr.leftSide)) {
        const foundOnLeft = findElementLocationRecursive(id, expr.leftSide, 'left', []);
        if (foundOnLeft) return foundOnLeft;
      }
      
      const foundOnRight = findElementLocationRecursive(id, expr.rightSide, 'right', []);
      if (foundOnRight) return foundOnRight;
      
      return null;
  };

  // Handle drag end
  const handleDragEnd = (event: any) => {
    const { active, over } = event;

    if (!over || !active || !activeDraggableItem || !expression) {
      setActiveId(null);
      setActiveDraggableItem(null);
      return;
    }
    
    // Intercept array variable drag
    if (activeDraggableItem.type === 'variable' && activeDraggableItem.variable?.type === 'array') {
      const overLocation = getElementLocationInfo(over.id, expression);
      if (overLocation && overLocation.side && (overLocation.isMainDropArea || overLocation.isNestedDropArea || overLocation.isMainExpressionElement || overLocation.isNestedExpressionElement)) {
        setArrayVariableForIndex(activeDraggableItem.variable);
        setIndexSide(overLocation.side); // Set the side
        setIsIndexDialogOpen(true);
        setActiveId(null);
        setActiveDraggableItem(null);
        return; // Stop further processing
      }
    }
    
    const activeLocation = getElementLocationInfo(active.id, expression);
    const overLocation = getElementLocationInfo(over.id, expression);

    if (!activeLocation || !overLocation) {
        setActiveId(null);
        setActiveDraggableItem(null);
        return;
    }

    setExpression(prevExpr => {
        if (!prevExpr) return null;
        const newExpr = prevExpr.clone();
        
        const itemToMove = activeLocation.isPaletteItem
          ? createNewElement(activeDraggableItem, getAllVariables)
          : activeLocation.item?.clone();

        if (!itemToMove) return newExpr;
        
        const getList = (side: 'left' | 'right', path: string[] = []): ExpressionElement[] | null => {
            let currentList: ExpressionElement[] | undefined | Variable = side === 'left' ? newExpr.leftSide : newExpr.rightSide;
            if (!Array.isArray(currentList)) return null;

            let currentFunc: ExpressionElement | undefined;
            for (const funcId of path) {
                currentFunc = currentList.find(e => e.id === funcId);
                if (!currentFunc || !currentFunc.isFunction() || !currentFunc.nestedExpression) return null;
                currentList = currentFunc.nestedExpression.rightSide;
            }
            return currentList;
        };

        // --- Reorder within the same list ---
        if (active.id === over.id) {
          // No change
        } else if (
            !activeLocation.isPaletteItem &&
            activeLocation.side === overLocation.side &&
            JSON.stringify(activeLocation.funcIdPath) === JSON.stringify(overLocation.funcIdPath) &&
            overLocation.isNestedExpressionElement
        ) {
            const list = getList(activeLocation.side!, activeLocation.funcIdPath);
            if (list && activeLocation.index !== undefined && overLocation.index !== undefined) {
                const [movedItem] = list.splice(activeLocation.index, 1);
                list.splice(overLocation.index, 0, movedItem);
            }
        } else {
            // --- Move between different lists ---
            // 1. Remove from original location
            if (!activeLocation.isPaletteItem) {
                const sourceList = getList(activeLocation.side!, activeLocation.funcIdPath);
                if (sourceList && activeLocation.index !== undefined) {
                    sourceList.splice(activeLocation.index, 1);
                }
            }

            // 2. Add to new location
            const targetSide = overLocation.side!;
            let targetPath = overLocation.funcIdPath || [];
            let targetIndex = overLocation.index;
            
            if (overLocation.isNestedDropArea) { // Dropped on area, not element
                targetPath = overLocation.funcIdPath!;
                targetIndex = undefined; // Append to end
            } else if (overLocation.isMainDropArea) {
                targetPath = [];
                targetIndex = undefined; // Append to end
            }
            
            const targetList = getList(targetSide, targetPath);
            if (targetList) {
                if (targetIndex !== undefined) {
                    targetList.splice(targetIndex, 0, itemToMove);
                } else {
                    targetList.push(itemToMove);
                }
            }
        }
        
        return newExpr;
    });

    setActiveId(null);
    setActiveDraggableItem(null);
  };

  // Handle add variable including array index dialog
  const handleAddVariable = (variable: Variable, side: 'left' | 'right') => {
    if (variable.type === 'array') {
      setArrayVariableForIndex(variable);
      setIndexSide(side);
      setIsIndexDialogOpen(true);
    } else if (selectedNode?.type === 'Conditional' && expression && !isRunning) {
      const element = new ExpressionElement(
        crypto.randomUUID(),
        'variable',
        variable.name,
        variable
      );
      setExpression(prev => {
        if (!prev) return null;
        const newExpr = prev.clone();
        if (indexSide === 'left' && Array.isArray(newExpr.leftSide)) {
          newExpr.leftSide.push(element as any);
        } else {
          newExpr.rightSide.push(element);
        }
        return newExpr;
      });
    }
  };

  // Handle editing array access elements
  const handleEditArrayAccess = (element: ExpressionElement) => {
    if (!element.value.includes('[') || !element.value.includes(']')) return;
    
    const parsed = parseArrayAccess(element.value);
    if (!parsed) return;

    // Find the array variable
    const arrayVar = getAllVariables().find(v => v.name === parsed.arrayName && v.type === 'array');
    if (!arrayVar) return;

    // Determine which side the element is on
    let elementSide: 'left' | 'right' = 'right';
    if (expression?.leftSide && Array.isArray(expression.leftSide)) {
      const foundOnLeft = expression.leftSide.find(e => e.id === element.id);
      if (foundOnLeft) {
        elementSide = 'left';
      }
    }

    setEditingElement(element);
    setArrayVariableForIndex(arrayVar);
    setIndexSide(elementSide);

    if (parsed.isRange && parsed.rangeStart && parsed.rangeEnd) {
      setInitialTab('range');
      setInitialRangeStart(parseExpressionString(parsed.rangeStart, getAllVariables()));
      setInitialRangeEnd(parseExpressionString(parsed.rangeEnd, getAllVariables()));
      setInitialExpression(null);
    } else if (parsed.indexExpression) {
      setInitialTab('single');
      setInitialExpression(parseExpressionString(parsed.indexExpression, getAllVariables()));
      setInitialRangeStart(null);
      setInitialRangeEnd(null);
    }

    setIsIndexDialogOpen(true);
  };

  // Handle dialog submission for editing
  const handleDialogSubmit = (_: 'single', expr: Expression) => {
    if (arrayVariableForIndex && expression) {
      const exprStr = expr.toString();
      const newValue = `${arrayVariableForIndex.name}[${exprStr}]`;

      if (editingElement) {
        // Replace existing element
        setExpression(prev => {
          if (!prev) return null;
          const newExpr = prev.clone();
          const elementToUpdate = newExpr.findElement(editingElement.id);
          if (elementToUpdate) {
            elementToUpdate.value = newValue;
          }
          return newExpr;
        });
      } else {
        // Add new element
        const element = new ExpressionElement(crypto.randomUUID(), 'literal', newValue);
        setExpression(prev => {
          if (!prev) return null;
          const newExpr = prev.clone();
          if (indexSide === 'left' && Array.isArray(newExpr.leftSide)) {
            newExpr.leftSide.push(element as any);
          } else {
            newExpr.rightSide.push(element);
          }
          return newExpr;
        });
      }
    }
    
    // Reset state
    setEditingElement(null);
    setInitialExpression(null);
    setInitialRangeStart(null);
    setInitialRangeEnd(null);
    setIsIndexDialogOpen(false);
  };

  // Handle dialog submission for range editing
  const handleDialogSubmitRange = (_: 'range', start: Expression, end: Expression) => {
    if (arrayVariableForIndex && expression) {
      const newValue = `${arrayVariableForIndex.name}[${start.toString()}:${end.toString()}]`;

      if (editingElement) {
        // Replace existing element
        setExpression(prev => {
          if (!prev) return null;
          const newExpr = prev.clone();
          const elementToUpdate = newExpr.findElement(editingElement.id);
          if (elementToUpdate) {
            elementToUpdate.value = newValue;
          }
          return newExpr;
        });
      } else {
        // Add new element
        const element = new ExpressionElement(crypto.randomUUID(), 'literal', newValue);
        setExpression(prev => {
          if (!prev) return null;
          const newExpr = prev.clone();
          if (indexSide === 'left' && Array.isArray(newExpr.leftSide)) {
            newExpr.leftSide.push(element as any);
          } else {
            newExpr.rightSide.push(element);
          }
          return newExpr;
        });
      }
    }
    
    // Reset state
    setEditingElement(null);
    setInitialExpression(null);
    setInitialRangeStart(null);
    setInitialRangeEnd(null);
    setIsIndexDialogOpen(false);
  };

  // Handle dialog cancel
  const handleDialogCancel = () => {
    setEditingElement(null);
    setInitialExpression(null);
    setInitialRangeStart(null);
    setInitialRangeEnd(null);
    setIsIndexDialogOpen(false);
  };

  // Don't render if not a Conditional node
  if (!selectedNode || selectedNode.type !== 'Conditional') return null;
  
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={rectIntersection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div key={selectedNode.id}>
        
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
                        expression.leftSide.map((element, index) => {
                          if (element.type === 'function') {
                            return (
                              <FunctionExpressionElement
                                key={element.id}
                                element={element}
                                removeExpressionElement={removeExpressionElement}
                                disabled={isRunning}
                                side='left'
                              />
                            );
                          }
                          return (
                                                    <DraggableExpressionElement 
                          key={element.id}
                          element={element}
                          index={index}
                          removeExpressionElement={removeExpressionElement}
                          disabled={isRunning}
                          onEdit={handleEditArrayAccess}
                        />
                          );
                        })
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
                        element.type === 'function' ? (
                          <FunctionExpressionElement
                            key={element.id}
                            element={element}
                            removeExpressionElement={removeExpressionElement}
                            disabled={isRunning}
                            side='right'
                          />
                        ) : (
                          <DraggableExpressionElement 
                            key={element.id}
                            element={element}
                            index={index}
                            removeExpressionElement={removeExpressionElement}
                            disabled={isRunning}
                            onEdit={handleEditArrayAccess}
                          />
                        )
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
              <Tabs value={conditionalTab} onValueChange={(value) => setConditionalTab(value as 'variables' | 'literals' | 'functions')} className="w-full">
                <TabsList className="grid grid-cols-3 w-full">
                  <TabsTrigger value="variables">Variables</TabsTrigger>
                  <TabsTrigger value="literals">Literals</TabsTrigger>
                  <TabsTrigger value="functions">Functions</TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>
            <CardContent>
              <Tabs value={conditionalTab} onValueChange={(value) => setConditionalTab(value as 'variables' | 'literals' | 'functions')}>
                <TabsContent value="variables" className="mt-0">
                  <div className="space-y-2">
                    {getAllVariables().map(variable => (
                      <DraggablePaletteItem
                        key={`var-${variable.id}`}
                        id={`var-${variable.id}`}
                        type="variable"
                        value={variable.type === 'array' ? `${variable.name}[]` : variable.name}
                        backgroundColor="#d1e7ff"
                        disabled={isRunning}
                        onClick={() => handleAddVariable(variable, 'left')}
                        onRightClick={() => handleAddVariable(variable, 'right')}
                      />
                    ))}
                    {getAllVariables().length === 0 && (
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
                          onClick={() => {
                            const element = new ExpressionElement(
                              crypto.randomUUID(),
                              'literal',
                              'true'
                            );
                            addElementOnLeftClick(element);
                          }}
                          onRightClick={() => {
                            const element = new ExpressionElement(
                              crypto.randomUUID(),
                              'literal',
                              'true'
                            );
                            addElementOnRightClick(element);
                          }}
                        />
                        <DraggablePaletteItem
                          id="lit-boolean-false"
                          type="literal"
                          value="false"
                          backgroundColor="#d1ffd1"
                          disabled={isRunning}
                          onClick={() => {
                            const element = new ExpressionElement(
                              crypto.randomUUID(),
                              'literal',
                              'false'
                            );
                            addElementOnLeftClick(element);
                          }}
                          onRightClick={() => {
                            const element = new ExpressionElement(
                              crypto.randomUUID(),
                              'literal',
                              'false'
                            );
                            addElementOnRightClick(element);
                          }}
                        />
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
                
                <TabsContent value="functions" className="mt-0">
                  <div className="space-y-2">
                    {/* Conversion functions */}
                    {['integer', 'string', 'float', 'boolean'].map(func => (
                      <DraggablePaletteItem
                        key={`func-${func}`}
                        id={`func-${func}`}
                        type="function"
                        value={`${func}()`}
                        backgroundColor="#d1d1ff"
                        disabled={isRunning}
                        onClick={() => {
                          const element = new ExpressionElement(
                            crypto.randomUUID(),
                            'function',
                            func,
                            new Expression(undefined, [])
                          );
                          addElementOnLeftClick(element);
                        }}
                        onRightClick={() => {
                          const element = new ExpressionElement(
                            crypto.randomUUID(),
                            'function',
                            func,
                            new Expression(undefined, [])
                          );
                          addElementOnRightClick(element);
                        }}
                      />
                    ))}
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
                  onClick={() => {
                    const element = new ExpressionElement(
                      crypto.randomUUID(),
                      'operator',
                      op
                    );
                    addElementOnLeftClick(element);
                  }}
                  onRightClick={() => {
                    const element = new ExpressionElement(
                      crypto.randomUUID(),
                      'operator',
                      op
                    );
                    addElementOnRightClick(element);
                  }}
                />
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
      
      <DragOverlay>
        {activeDraggableItem ? (
          <div className={`
            px-2 py-1 m-1 rounded text-sm shadow-lg cursor-grabbing
            ${activeDraggableItem.type === 'variable' ? 'bg-blue-100' :
              activeDraggableItem.type === 'operator' ? 'bg-red-100' :
              activeDraggableItem.type === 'literal' && activeDraggableItem.value.includes('[') && activeDraggableItem.value.includes(']') ? 'bg-blue-100' :
              activeDraggableItem.type === 'literal' ? 'bg-green-100' : 'bg-purple-100'}
          `}>
            {activeDraggableItem.value}
          </div>
        ) : null}
      </DragOverlay>

      {/* Array index dialog */}
      <ArrayIndexDialog
        open={isIndexDialogOpen}
        variableName={arrayVariableForIndex?.name || ''}
        onCancel={handleDialogCancel}
        onSubmit={handleDialogSubmit}
        onSubmitRange={handleDialogSubmitRange}
        initialExpression={initialExpression || undefined}
        initialRangeStart={initialRangeStart || undefined}
        initialRangeEnd={initialRangeEnd || undefined}
        initialTab={initialTab}
      />
    </DndContext>
  );
};

export default ConditionalEditor; 