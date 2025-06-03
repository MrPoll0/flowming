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
import { operators as expressionOperators, equalities, IEquality } from '../../../../models/Expression';
import { useFlowExecutorContext } from '../../../../context/FlowExecutorContext';

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

// Available operators for expression building
const operators = [
  ...expressionOperators
];

const ConditionalEditor = () => {
  const { selectedNode } = useContext(SelectedNodeContext);
  const { getAllVariables } = useVariables();
  const isInitialLoadRef = useRef(true);
  const previousNodeIdRef = useRef<string | null>(null);
  const [expression, setExpression] = useState<Expression | null>(null);
  const [conditionalTab, setConditionalTab] = useState<'variables' | 'literals'>('variables');
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

  // Load conditional data when the selected node changes
  useEffect(() => {
    // Reset initial load flag
    isInitialLoadRef.current = true;
    
    if (selectedNode && selectedNode.type === 'Conditional') {
      // Load conditional data if available
      if (previousNodeIdRef.current !== selectedNode.id) {
        previousNodeIdRef.current = selectedNode.id;
        
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
        } else {
          // For Conditional, initialize with empty expression
          setExpression(new Expression([], [], '=='));
        }
      }
    } else {
      previousNodeIdRef.current = null;
      setExpression(null);
    }
    
    isInitialLoadRef.current = false;
  }, [selectedNode, getAllVariables]);

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
          newExpr.addElement(element);
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
        
        // For conditional nodes, check both left and right sides
        if (Array.isArray(newExpr.leftSide)) {
          // Check if the element to remove is in the left side
          const leftIndex = (newExpr.leftSide as ExpressionElement[]).findIndex(e => e.id === id);
          if (leftIndex > -1) {
            const newLeftSide = [...(newExpr.leftSide as ExpressionElement[])];
            newLeftSide.splice(leftIndex, 1);
            newExpr.leftSide = newLeftSide;
            return newExpr;
          }
        }
        
        // Otherwise remove from right side
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
    const isExistingElement = expression?.rightSide.find(item => item.id === active.id) ||
                             (Array.isArray(expression?.leftSide) && expression.leftSide.find(item => item.id === active.id));

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

    if (selectedNode?.type === 'Conditional') {
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
      // Handle reordering or insertion in left/right expression areas
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
                    {getAllVariables().map(variable => (
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
                          addElementOnLeftClick(element);
                        }}
                        onRightClick={() => {
                          const element = new ExpressionElement(
                            crypto.randomUUID(),
                            'variable',
                            variable.name,
                            variable
                          );
                          addElementOnRightClick(element);
                        }}
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

export default ConditionalEditor; 