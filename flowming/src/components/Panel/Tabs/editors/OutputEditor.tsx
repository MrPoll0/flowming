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

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { CSS } from '@dnd-kit/utilities';
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

const OutputEditor = () => {
  const { selectedNode } = useContext(SelectedNodeContext);
  const { getAllVariables } = useVariables();
  const isInitialLoadRef = useRef(true);
  const previousNodeIdRef = useRef<string | null>(null);
  const [expression, setExpression] = useState<Expression | null>(null);
  const [isIndexDialogOpen, setIsIndexDialogOpen] = useState(false);
  const [arrayVariableForIndex, setArrayVariableForIndex] = useState<Variable | null>(null);
  const [outputTab, setOutputTab] = useState<'variables' | 'literals' | 'functions'>('variables');
  const [_activeId, setActiveId] = useState<string | null>(null);
  const [activeDraggableItem, setActiveDraggableItem] = useState<ExpressionElement | null>(null);
  
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

  // Update the node data when expression changes
  useEffect(() => {
    if (selectedNode?.type === 'Output' && !isInitialLoadRef.current) {
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

  // Load output data when the selected node changes or when its data changes (for collaboration)
  useEffect(() => {
    // Reset initial load flag
    isInitialLoadRef.current = true;
    
    if (selectedNode && selectedNode.type === 'Output') {
      // Load output data if available or if data has changed (collaboration)
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
            const rightSide = selectedNode.data.expression.rightSide?.map((elem: any) => 
              ExpressionElement.fromObject(elem)
            ) || [];
            setExpression(new Expression(undefined, rightSide));
          } catch (error) {
            console.error('Error creating expression:', error);
          }
        } else if (nodeChanged) {
          // For Output, initialize with empty expression only when it's a new node
          setExpression(new Expression(undefined, []));
        }
      }
    } else {
      previousNodeIdRef.current = null;
      setExpression(null);
    }
    
    isInitialLoadRef.current = false;
  }, [selectedNode, selectedNode?.data?.expression]);

  // Expression building functions
  const addExpressionElement = (element: ExpressionElement) => {
    if (selectedNode?.type === 'Output' && expression && !isRunning) {
      setExpression(prev => {
        if (!prev) return null;
        const newExpr = prev.clone();
        newExpr.addElement(element);
        return newExpr;
      });
    }
  };
  
  const removeExpressionElement = (id: string) => {
    if (selectedNode?.type === 'Output' && expression && !isRunning) {
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

  // Handle add variable with array support
  const handleAddVariable = (variable: Variable) => {
    if (variable.type === 'array') {
      setArrayVariableForIndex(variable);
      setIsIndexDialogOpen(true);
    } else if (selectedNode?.type === 'Output' && expression && !isRunning) {
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

  // Handle editing array access elements
  const handleEditArrayAccess = (element: ExpressionElement) => {
    if (!element.variable || !(element.variable instanceof Variable)) return;
    const elemVar = element.variable as Variable;
    if (elemVar.type !== 'array') return;

    const arrayVar = getAllVariables().find(v => v.id === elemVar.id && v.type === 'array') || elemVar;
 
    setEditingElement(element);
    setArrayVariableForIndex(arrayVar);
    setInitialTab('single');
    const idxExpr = elemVar.indexExpression && elemVar.indexExpression.length > 0
      ? elemVar.indexExpression.map(e => e.clone())
      : [];
    setInitialExpression(new Expression(undefined, idxExpr));

    setIsIndexDialogOpen(true);
  };

  // Handle dialog submission for editing
  const handleDialogSubmit = (_: 'single', expr: Expression) => {
    if (arrayVariableForIndex) {
      if (expr.isEmpty()) {
        // Ignore empty index
        // TODO: ideally error message and block action
        setEditingElement(null);
        setIsIndexDialogOpen(false);
        setArrayVariableForIndex(null);
        return;
      }
      // Build variable clone with index expression directly
      const idxExpr = expr.rightSide.map(e => e.clone());
      const variableClone = arrayVariableForIndex.clone();
      (variableClone as any).indexExpression = idxExpr;

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
  };

  // Don't render if not an Output node
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

        {/* Expression display box */}
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Expression</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="min-h-[50px] p-2 bg-muted/30 border rounded">
              <ExpressionDropArea id="expression-drop-area" disabled={isRunning}>
                <SortableContext 
                  items={expression.rightSide.map(e => e.id)} 
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
            </div>
          </CardContent>
        </Card>

        {/* Building blocks section */}
        <div className="grid grid-cols-2 gap-4">
          {/* Left column: Tabbed Variables and Literals */}
          <Card>
            <CardHeader className="pb-2">
              <Tabs value={outputTab} onValueChange={(value) => setOutputTab(value as 'variables' | 'literals' | 'functions')} className="w-full">
                <TabsList className="grid grid-cols-3 w-full">
                  <TabsTrigger value="variables">Variables</TabsTrigger>
                  <TabsTrigger value="literals">Literals</TabsTrigger>
                  <TabsTrigger value="functions">Functions</TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>
            <CardContent>
              <Tabs value={outputTab} onValueChange={(value) => setOutputTab(value as 'variables' | 'literals' | 'functions')}>
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

      {/* Render dialog */}
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
    </DndContext>
  );
};

export default OutputEditor; 