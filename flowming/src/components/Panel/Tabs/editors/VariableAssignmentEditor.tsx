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
import { operators as expressionOperators } from '../../../../models/Expression';
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
  ExpressionDropArea 
} from './shared/DragAndDropComponents';
import ArrayIndexDialog from '@/components/ui/ArrayIndexDialog';

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
  isMainDropArea: boolean;
  isMainExpressionElement: boolean;
  isNestedDropArea: boolean;
  isNestedExpressionElement: boolean;
  funcId?: string; // ID of the parent function if nested
  funcIdPath?: string[]; // Full path of parent function IDs for deep nesting
  elementActualId?: string; // The ID of the element itself (if not a drop area or palette)
  item?: ExpressionElement; // The actual ExpressionElement if it's an existing one
  index?: number; // Index in its respective list (main or nested)
}

// Props for function expression element
interface FunctionExpressionElementProps {
  element: ExpressionElement;
  removeExpressionElement: (id: string) => void;
  disabled: boolean;
  onEdit?: (element: ExpressionElement) => void;
}

// Function block component for nesting
const FunctionExpressionElement: React.FC<FunctionExpressionElementProps> = ({ element, removeExpressionElement, disabled, onEdit }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: element.id, disabled });
  
  const nestedDropId = `nested-${element.id}`;
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
                    onEdit={onEdit}
                  />
                ) : (
                  <DraggableExpressionElement
                    key={nestedElem.id}
                    element={nestedElem}
                    index={idx}
                    removeExpressionElement={removeExpressionElement}
                    disabled={disabled}
                    onEdit={onEdit}
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

const VariableAssignmentEditor = () => {
  const { selectedNode } = useContext(SelectedNodeContext);
  const { getAllVariables } = useVariables();
  const [leftSideVariable, setLeftSideVariable] = useState<string>('');
  const isInitialLoadRef = useRef(true);
  const previousNodeIdRef = useRef<string | null>(null);
  const [expression, setExpression] = useState<Expression | null>(null);
  const [assignmentTab, setAssignmentTab] = useState<'variables' | 'literals' | 'functions'>('variables');
  const [_activeId, setActiveId] = useState<string | null>(null);
  const [activeDraggableItem, setActiveDraggableItem] = useState<ExpressionElement | null>(null);
  const [isIndexDialogOpen, setIsIndexDialogOpen] = useState(false);
  const [arrayVariableForIndex, setArrayVariableForIndex] = useState<Variable | null>(null);
  // Left-side (assignment target) index state
  const [leftSideIndexExprElems, setLeftSideIndexExprElems] = useState<ExpressionElement[] | null>(null);
  const [isEditingLeftSideIndex, setIsEditingLeftSideIndex] = useState(false);
  
  // State for editing existing array access elements
  const [editingElement, setEditingElement] = useState<ExpressionElement | null>(null);
  const [initialExpression, setInitialExpression] = useState<Expression | null>(null);
  const [initialTab, setInitialTab] = useState<'single'>('single');
  
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

        // Reset index state if variable type changed to non-array
        if (varInstance.type !== 'array' && leftSideIndexExprElems && leftSideIndexExprElems.length > 0) {
          setLeftSideIndexExprElems(null);
        }

        // Only update if the left side has changed or if the expression is null
        if (!expression || (expression.leftSide instanceof Variable && expression.leftSide.id !== varInstance.id)) {
          // Preserve right side and indexExpression if exists
          const varClone = varInstance.clone();
          if (leftSideIndexExprElems && leftSideIndexExprElems.length > 0) {
            (varClone as any).indexExpression = leftSideIndexExprElems.map(e => e.clone());
          }
          setExpression(new Expression(varClone, expression?.rightSide || []));
        }
      } else { // AssignVariable selected, but no variable chosen for its LHS, so reset expression
        if (expression !== null) setExpression(null);
      }
    }
  }, [leftSideVariable, selectedNode, getAllVariables, expression, leftSideIndexExprElems]);

  // Update the node data when expression changes
  useEffect(() => {
    if (selectedNode?.type === 'AssignVariable' && !isInitialLoadRef.current) {
      reactFlowInstance.updateNodeData(selectedNode.id, {
        expression: expression ? expression.toObject() : null,
      });
    }
  }, [expression, reactFlowInstance, selectedNode]);

  // Load assignment data when the selected node changes or when its data changes (for collaboration)
  useEffect(() => {
    // Reset initial load flag
    isInitialLoadRef.current = true;
    
    if (selectedNode && selectedNode.type === 'AssignVariable') {
      // Load assignment data if available or if data has changed (collaboration)
      const nodeChanged = previousNodeIdRef.current !== selectedNode.id;
      const hasExpressionData = selectedNode.data.expression;
      
      if (nodeChanged) {
        previousNodeIdRef.current = selectedNode.id;
      }
      
      // Always update if node changed OR if we have expression data (to handle collaborative updates)
      if (nodeChanged || hasExpressionData) {
        // Initialize with existing data if available
        if (selectedNode.data.expression) {
          const allVariables = getAllVariables();

          try {
            const exprObj = selectedNode.data.expression;
            const exprLoaded = Expression.fromObject(exprObj);

            // Verify variable still exists
            if (exprLoaded.leftSide instanceof Variable) {
              const varId = exprLoaded.leftSide.id;
              if (!allVariables.some(v => v.id === varId)) throw new Error("Variable no longer exists");
              setLeftSideVariable(varId);

              if (exprLoaded.leftSide.indexExpression && exprLoaded.leftSide.indexExpression.length > 0) {
                const clonedElems = exprLoaded.leftSide.indexExpression.map(e => e.clone());
                setLeftSideIndexExprElems(clonedElems);
              } else {
                setLeftSideIndexExprElems(null);
              }

              // Replace leftSide reference with current variable definition + keep indexExpression
              const currentVar = allVariables.find(v => v.id === varId)?.clone();
              if (currentVar) {
                if (exprLoaded.leftSide.indexExpression && currentVar.type === 'array') {
                  currentVar.indexExpression = exprLoaded.leftSide.indexExpression.map(e => e.clone());
                }
                exprLoaded.leftSide = currentVar;
              }

              setExpression(exprLoaded);
            }
          } catch (error) {
            console.error('Error creating expression:', error);
          }
        } else if (nodeChanged) {
          // Only reset form state when it's a new node (not when collaborative data is cleared)
          setLeftSideVariable('');
          setExpression(null);
          setLeftSideIndexExprElems(null);
        }
      }
    } else {
      previousNodeIdRef.current = null;
      setLeftSideVariable('');
      setExpression(null);
      setLeftSideIndexExprElems(null);
    }
    
    isInitialLoadRef.current = false;
  }, [selectedNode, selectedNode?.data?.expression, getAllVariables]);

  // Update indexExpression whenever the index string changes.
  useEffect(() => {
    if (!leftSideVariable) return;

    const selectedVar = getAllVariables().find(v => v.id === leftSideVariable);
    if (!selectedVar || selectedVar.type !== 'array') return;

    const idxExprElems = leftSideIndexExprElems ? leftSideIndexExprElems.map(e => e.clone()) : undefined;

    setExpression(prev => {
      if (!prev) return prev;

      if (!(prev.leftSide instanceof Variable)) return prev;

      // Only update when the index expression actually changed to avoid unnecessary re-renders
      const prevSerialized = JSON.stringify(prev.leftSide.indexExpression ?? []);
      const newSerialized = JSON.stringify(idxExprElems ?? []);
      if (prevSerialized === newSerialized) return prev;

      const newExpr = prev.clone();
      if (newExpr.leftSide instanceof Variable) {
        newExpr.leftSide.indexExpression = idxExprElems;
      }
      return newExpr;
    });
  }, [leftSideIndexExprElems, leftSideVariable]);

  // Expression building functions
  const addExpressionElement = (element: ExpressionElement) => {
    if (selectedNode?.type === 'AssignVariable' && expression && !isRunning) {
      setExpression(prev => {
        if (!prev) return null;
        const newExpr = prev.clone();
        newExpr.addElement(element);
        return newExpr;
      });
    }
  };
  
  const removeExpressionElement = (id: string) => {
    if (selectedNode?.type === 'AssignVariable' && expression && !isRunning) {
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
    
    if (expression?.rightSide) {
      determinedActiveElement = findActiveElementRecursive(expression.rightSide, active.id);
    }

    if (!determinedActiveElement) {
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

  // Helper function to create new expression element
  const createNewElement = (activeItem: ExpressionElement, getAllVars: () => Variable[]): ExpressionElement | null => {
    if (activeItem.type === 'variable') {
      const varId = activeItem.variable?.id || (activeItem.id.startsWith('var-') ? activeItem.id.replace('var-', '') : null);
      if (varId) {
        const variable = getAllVars().find(v => v.id === varId);
        if (variable) {
          return new ExpressionElement(uuid(), 'variable', variable.name, variable);
        }
      }
      if (activeItem.variable instanceof Variable) {
        return new ExpressionElement(uuid(), 'variable', activeItem.variable.name, activeItem.variable.clone());
      }
      return null;
    } else if (activeItem.type === 'function') {
      const nestedExpr = activeItem.nestedExpression ? activeItem.nestedExpression.clone() : new Expression(undefined, []);
      return new ExpressionElement(uuid(), 'function', activeItem.value, nestedExpr);
    } else {
      return new ExpressionElement(uuid(), activeItem.type, activeItem.value);
    }
  };

  const findElementLocationRecursive = (
    id: string, 
    elements: ExpressionElement[], 
    funcIdPath: string[]
  ): ElementLocation | null => {
    for (let index = 0; index < elements.length; index++) {
      const item = elements[index];
      if (item.id === id) {
        if (funcIdPath.length > 0) {
          return {
            id, isPaletteItem: false, isMainDropArea: false, isMainExpressionElement: false, isNestedDropArea: false, isNestedExpressionElement: true,
            funcId: funcIdPath[funcIdPath.length - 1], funcIdPath, elementActualId: id, item, index
          };
        } else {
          return {
            id, isPaletteItem: false, isMainDropArea: false, isMainExpressionElement: true, isNestedDropArea: false, isNestedExpressionElement: false,
            elementActualId: id, item, index, funcIdPath
          };
        }
      }
      if (item.isFunction() && item.nestedExpression) {
        const found = findElementLocationRecursive(id, item.nestedExpression.rightSide, [...funcIdPath, item.id]);
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
      if (id === 'expression-drop-area') {
        return { id, isPaletteItem: false, isMainDropArea: true, isMainExpressionElement: false, isNestedDropArea: false, isNestedExpressionElement: false };
      }
      if (id.startsWith('nested-')) {
        const funcId = id.replace('nested-', '');
        const funcElemPath = findElementLocationRecursive(funcId, expr.rightSide, []);
        return { 
            id, isPaletteItem: false, isMainDropArea: false, isMainExpressionElement: false, isNestedDropArea: true, isNestedExpressionElement: false, 
            funcId, funcIdPath: funcElemPath ? [...(funcElemPath.funcIdPath || []), funcId] : [funcId]
        };
      }
  
      const foundOnRight = findElementLocationRecursive(id, expr.rightSide, []);
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
    if (activeDraggableItem.type === 'variable' && activeDraggableItem.variable?.type === 'array' && (!activeDraggableItem.variable.indexExpression || activeDraggableItem.variable.indexExpression.length === 0)) {
      const overLocation = getElementLocationInfo(over.id, expression);
      // Check if it's a valid drop target
      if (overLocation && (overLocation.isMainDropArea || overLocation.isNestedDropArea || overLocation.isMainExpressionElement || overLocation.isNestedExpressionElement)) {
        setArrayVariableForIndex(activeDraggableItem.variable);
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
      
      const getList = (path: string[] = []): ExpressionElement[] | null => {
          let currentList: ExpressionElement[] = newExpr.rightSide;
          let currentFunc: ExpressionElement | undefined;
          for (const funcId of path) {
              currentFunc = currentList.find(e => e.id === funcId);
              if (!currentFunc || !currentFunc.isFunction() || !currentFunc.nestedExpression) return null;
              currentList = currentFunc.nestedExpression.rightSide;
          }
          return currentList;
      };

      if (active.id === over.id) {
          // No change
      } else if (
          !activeLocation.isPaletteItem &&
          JSON.stringify(activeLocation.funcIdPath) === JSON.stringify(overLocation.funcIdPath) &&
          (overLocation.isNestedExpressionElement || overLocation.isMainExpressionElement)
      ) {
          const list = getList(activeLocation.funcIdPath);
          if (list && activeLocation.index !== undefined && overLocation.index !== undefined) {
              const [movedItem] = list.splice(activeLocation.index, 1);
              list.splice(overLocation.index, 0, movedItem);
          }
      } else {
          // Move between different lists
          if (!activeLocation.isPaletteItem) {
              const sourceList = getList(activeLocation.funcIdPath);
              if (sourceList && activeLocation.index !== undefined) {
                  sourceList.splice(activeLocation.index, 1);
              }
          }

          let targetPath = overLocation.funcIdPath || [];
          let targetIndex = overLocation.index;
          
          if (overLocation.isNestedDropArea) {
              targetPath = overLocation.funcIdPath!;
              targetIndex = undefined;
          } else if (overLocation.isMainDropArea) {
              targetPath = [];
              targetIndex = undefined;
          }
          
          const targetList = getList(targetPath);
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

  // Handle drop/click for array variable
  const handleAddVariable = (variable: Variable) => {
    if (variable.type === 'array') {
      setArrayVariableForIndex(variable);
      setIsIndexDialogOpen(true);
    } else if (selectedNode?.type === 'AssignVariable' && expression && !isRunning) {
      const element = new ExpressionElement(
        crypto.randomUUID(),
        'variable',
        variable.name,
        variable
      );
      setExpression(prev => {
        if (!prev) return null;
        const newExpr = prev.clone();
        newExpr.addElement(element);
        return newExpr;
      });
    }
  };

  // Helper to derive a string representation when needed (UI only)
  const getIndexString = () =>
    leftSideIndexExprElems && leftSideIndexExprElems.length > 0
      ? new Expression(undefined, leftSideIndexExprElems).toString()
      : null;

  // Modify variable dropdown change handler to support array index dialog
  const handleLeftVariableChange = (value: string) => {
    if (value === '__CLEAR__') {
      setLeftSideVariable('');
      setLeftSideIndexExprElems(null);
      return;
    }

    const variable = getAllVariables().find(v => v.id === value);
    if (!variable) return;

    setLeftSideVariable(variable.id);

    if (variable.type === 'array') {
      // Open index dialog immediately
      setArrayVariableForIndex(variable);
      setIsEditingLeftSideIndex(true);
      // Prefill dialog with existing index if any
      if (leftSideIndexExprElems && leftSideIndexExprElems.length > 0) {
        setInitialTab('single');
        setInitialExpression(new Expression(undefined, leftSideIndexExprElems.map(e => e.clone())));
      } else {
        setInitialTab('single');
        setInitialExpression(new Expression(undefined, []));
      }
      setIsIndexDialogOpen(true);
    } else {
      setLeftSideIndexExprElems(null);
    }
  };

  // Override dialog submit handlers to manage left-side edits first
  const handleDialogSubmit = (_: 'single', expr: Expression) => {
    if (isEditingLeftSideIndex && arrayVariableForIndex) {
      if (expr.isEmpty()) {
        // Treat as cancel – clear variable selection
        setLeftSideVariable('');
        setLeftSideIndexExprElems(null);
      } else {
        setLeftSideIndexExprElems(expr.rightSide.map(e => e.clone()));
      }
      setIsEditingLeftSideIndex(false);
      setIsIndexDialogOpen(false);
      return;
    }
    if (arrayVariableForIndex) {
      if (expr.isEmpty()) {
        // Ignore empty index
        setEditingElement(null);
        setIsIndexDialogOpen(false);
        setArrayVariableForIndex(null);
        return;
      }
      const elemVar = arrayVariableForIndex as Variable;
      const idxExpr = expr.rightSide.map(e => e.clone());
      const variableClone = elemVar.clone();
      variableClone.indexExpression = idxExpr;

      if (editingElement) {
        // Replace existing element
        setExpression(prev => {
          if (!prev) return null;
          const newExpr = prev.clone();
          const elementToUpdate = newExpr.findElement(editingElement.id);
          if (elementToUpdate) {
            elementToUpdate.type = 'variable';
            elementToUpdate.setVariable(variableClone);
          }
          return newExpr;
        });
      } else {
        // Add new element
        const element = new ExpressionElement(crypto.randomUUID(), 'variable', '', variableClone);
        setExpression(prev => {
          if (!prev) return null;
          const newExpr = prev.clone();
          newExpr.addElement(element);
          return newExpr;
        });
      }
    }
    
    // Reset state
    setEditingElement(null);
    setInitialExpression(null);
    setIsIndexDialogOpen(false);
  };

  // Handle dialog cancel
  const handleDialogCancel = () => {
    setEditingElement(null);
    setInitialExpression(null);
    setIsIndexDialogOpen(false);

    if (isEditingLeftSideIndex && leftSideIndexExprElems && leftSideIndexExprElems.length === 0) {
      // User canceled before providing an index -> deselect variable
      setLeftSideVariable('');
      setIsEditingLeftSideIndex(false);
      setArrayVariableForIndex(null);
    }
  };

  // Handler to edit existing array access elements on RHS (dragged literals)
  const handleEditArrayAccess = (element: ExpressionElement) => {
    if (!element.variable || !(element.variable instanceof Variable)) return;
    if (element.variable.type !== 'array' || !element.variable.indexExpression || element.variable.indexExpression.length === 0) return;

    const elemVar = element.variable as Variable;
    const arrayVar = getAllVariables().find(v => v.id === elemVar.id && v.type === 'array') || elemVar;

    setEditingElement(element);
    setArrayVariableForIndex(arrayVar);

    setInitialTab('single');
    setInitialExpression(new Expression(undefined, elemVar.indexExpression!.map(e => e.clone())));

    setIsIndexDialogOpen(true);
  };

  // Don't render if not an AssignVariable node
  if (!selectedNode || selectedNode.type !== 'AssignVariable') return null;
  
  const allVariables = getAllVariables();
  
  return (
    <>
      <ArrayIndexDialog
        open={isIndexDialogOpen}
        variableName={arrayVariableForIndex?.name || ''}
        onCancel={handleDialogCancel}
        onSubmit={handleDialogSubmit}
        onSubmitRange={undefined as any}
        initialExpression={initialExpression || undefined}
        initialRangeStart={undefined as any}
        initialRangeEnd={undefined as any}
        initialTab={initialTab}
      />
      <DndContext
        sensors={sensors}
        collisionDetection={rectIntersection}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div key={selectedNode.id}>        
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
                  <div className="flex-none min-w-[200px] flex items-center gap-2">
                    <Select
                      value={leftSideVariable}
                      onValueChange={handleLeftVariableChange}
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
                    {/* Index display / edit button for arrays */}
                    {(() => {
                      const selectedVar = allVariables.find(v => v.id === leftSideVariable);
                      if (selectedVar && selectedVar.type === 'array') {
                        return (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isRunning}
                            onClick={() => {
                              setArrayVariableForIndex(selectedVar);
                              setIsEditingLeftSideIndex(true);
                              // Prefill dialog with existing index if any
                              if (leftSideIndexExprElems && leftSideIndexExprElems.length > 0) {
                                setInitialTab('single');
                                setInitialExpression(new Expression(undefined, leftSideIndexExprElems.map(e => e.clone())));
                              } else {
                                setInitialTab('single');
                                setInitialExpression(new Expression(undefined, []));
                              }
                              setIsIndexDialogOpen(true);
                            }}
                          >
                            {getIndexString() ? `[${getIndexString()}]` : '[]'}
                          </Button>
                        );
                      }
                      return null;
                    })()}
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
                          {expression.rightSide.map((element, index) => {
                            if (element.type === 'function') {
                              return (
                                <FunctionExpressionElement
                                  key={element.id}
                                  element={element}
                                  removeExpressionElement={removeExpressionElement}
                                  disabled={isRunning}
                                  onEdit={handleEditArrayAccess}
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
                          })}
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
                    <Tabs value={assignmentTab} onValueChange={(value) => setAssignmentTab(value as 'variables' | 'literals' | 'functions')} className="w-full">
                      <TabsList className="grid grid-cols-3 w-full">
                        <TabsTrigger value="variables">Variables</TabsTrigger>
                        <TabsTrigger value="literals">Literals</TabsTrigger>
                        <TabsTrigger value="functions">Functions</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </CardHeader>
                  <CardContent>
                    <Tabs value={assignmentTab} onValueChange={(value) => setAssignmentTab(value as 'variables' | 'literals' | 'functions')}>
                      <TabsContent value="variables" className="mt-0">
                        <div className="space-y-2">
                          {allVariables.map(variable => (
                            <DraggablePaletteItem
                              key={`var-${variable.id}`}
                              id={`var-${variable.id}`}
                              type="variable"
                              value={variable.type === 'array' ? `${variable.name}[]` : variable.name}
                              backgroundColor="#d1e7ff"
                              disabled={isRunning}
                              onClick={() => handleAddVariable(variable)}
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
                                onClick={() => {
                                  const element = new ExpressionElement(
                                    crypto.randomUUID(),
                                    'literal',
                                    'true'
                                  );
                                  addExpressionElement(element);
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
                                  addExpressionElement(element);
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
                                addExpressionElement(element);
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
                          addExpressionElement(element);
                        }}
                      />
                    ))}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
        
        <DragOverlay>
          {activeDraggableItem ? (
            <div className={`
              px-2 py-1 m-1 rounded text-sm shadow-lg cursor-grabbing
              ${activeDraggableItem.type === 'variable' ? 'bg-blue-100' :
                activeDraggableItem.type === 'operator' ? 'bg-red-100' :
                activeDraggableItem.type === 'literal' ? 'bg-green-100' : 'bg-purple-100'}
            `}>
              {activeDraggableItem.value}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </>
  );
};

export default VariableAssignmentEditor; 