import { useContext, useState, useEffect, useRef } from 'react';
import { SelectedNodeContext } from '../../../../context/SelectedNodeContext';
import { useVariables } from '../../../../context/VariablesContext';
import { useReactFlow } from '@xyflow/react';
import { Expression, ExpressionElement } from '../../../../models';
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
  arrayMove
} from '@dnd-kit/sortable';
import { operators as expressionOperators } from '../../../../models/Expression';
import { useFlowExecutorContext } from '../../../../context/FlowExecutorContext';

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

// Available operators for expression building
const operators = [
  ...expressionOperators
];

const OutputEditor = () => {
  const { selectedNode } = useContext(SelectedNodeContext);
  const { getAllVariables } = useVariables();
  const isInitialLoadRef = useRef(true);
  const previousNodeIdRef = useRef<string | null>(null);
  const [expression, setExpression] = useState<Expression | null>(null);
  const [outputTab, setOutputTab] = useState<'variables' | 'literals'>('variables');
  const [_activeId, setActiveId] = useState<string | null>(null);
  const [activeItem, setActiveItem] = useState<ExpressionElement | null>(null);
  
  const reactFlowInstance = useReactFlow();
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const { isRunning } = useFlowExecutorContext();

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
    
    // Find the active item
    let foundItem: ExpressionElement | null = null;
    
    // Check if it's an existing expression element being reordered
    const isExistingElement = expression?.rightSide.find(item => item.id === active.id);

    if (isExistingElement) {
      foundItem = isExistingElement;
    } else if (active.id.startsWith('var-')) {
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
    } else if (active.id.startsWith('op-')) {
      const op = active.id.replace('op-', '');
      foundItem = new ExpressionElement(active.id, 'operator', op);
    } else if (active.id.startsWith('lit-')) {
      const parts = active.id.split('-');
      if (parts.length >= 3) {
        const value = parts.slice(2).join('-');
        foundItem = new ExpressionElement(active.id, 'literal', value);
      }
    }
    
    setActiveItem(foundItem);
  };

  // Handle drag end
  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    setActiveId(null);
    setActiveItem(null);

    // Exit if dropped outside a valid droppable area
    if (!over) {
      return;
    }

    const activeId = active.id;
    const overId = over.id;

    if (expression && selectedNode?.type === 'Output') {
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
        if (!activeItem) return;

        // Create a new element with a fresh UUID
        let newElement: ExpressionElement; 
        
        // Create proper ExpressionElement based on the type
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
        addExpressionElement(newElement);
      }
      // Case 3: Adding an element at a specific position in the expression
      else if (activeElementIndex === -1 && overElementIndex > -1) {
        if (!activeItem) return;

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
                        onClick={() => {
                          const element = new ExpressionElement(
                            crypto.randomUUID(),
                            'variable',
                            variable.name,
                            variable
                          );
                          addExpressionElement(element);
                        }}
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

export default OutputEditor; 