import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { DraggablePaletteItem } from '@/components/Panel/Tabs/editors/shared/DragAndDropComponents';
import { Expression, ExpressionElement, Variable } from '../../models';
import ExpressionBuilder from './ExpressionBuilder';
import {
  DndContext,
  useSensors,
  useSensor,
  PointerSensor,
  DragOverlay,
  rectIntersection,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import { useVariables } from '../../context/VariablesContext';
import { operators as expressionOperators } from '../../models/Expression';

const uuid = () => crypto.randomUUID();

// Operators list for quick lookup inside dialog
const operators = [...expressionOperators];

// Interface to describe the location of an element for drag & drop logic
interface ElementLocation {
  id: string;
  isPaletteItem: boolean;
  isMainDropArea: boolean;
  isMainExpressionElement: boolean;
  isNestedDropArea: boolean;
  isNestedExpressionElement: boolean;
  dropAreaId?: string; // Which expression builder (single-index-drop, range-start-drop, etc.)
  funcId?: string;
  funcIdPath?: string[];
  elementActualId?: string;
  item?: ExpressionElement;
  index?: number;
}

interface ArrayIndexDialogProps {
  open: boolean;
  variableName: string;
  onCancel: () => void;
  onSubmit: (type: 'single', expr: Expression) => void;
  onSubmitRange?: (type: 'range', start: Expression, end: Expression) => void;
  initialExpression?: Expression;
  initialRangeStart?: Expression;
  initialRangeEnd?: Expression;
  initialTab?: 'single' | 'range';
}

const ArrayIndexDialog: React.FC<ArrayIndexDialogProps> = ({ 
  open, 
  variableName, 
  onCancel, 
  onSubmit, 
  onSubmitRange,
  initialExpression,
  initialRangeStart,
  initialRangeEnd,
  initialTab = 'single'
}) => {
  const { getAllVariables } = useVariables();
  const [tab, setTab] = useState<'single' | 'range'>(initialTab);
  
  const [singleExpr, setSingleExpr] = useState<Expression>(initialExpression || new Expression(undefined, []));
  const [rangeStart, setRangeStart] = useState<Expression>(initialRangeStart || new Expression(undefined, []));
  const [rangeEnd, setRangeEnd] = useState<Expression>(initialRangeEnd || new Expression(undefined, []));

  const [_activeId, setActiveId] = useState<string | null>(null);
  const [activeItem, setActiveItem] = useState<ExpressionElement | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  // Reset expressions when dialog opens or when initial values change
  React.useEffect(() => {
    if (open) {
      setTab(initialTab);
      setSingleExpr(initialExpression || new Expression(undefined, []));
      setRangeStart(initialRangeStart || new Expression(undefined, []));
      setRangeEnd(initialRangeEnd || new Expression(undefined, []));
    }
  }, [open, initialExpression, initialRangeStart, initialRangeEnd, initialTab]);

  // Reset expressions when dialog is cancelled or closed
  const handleCancel = () => {
    setSingleExpr(new Expression(undefined, []));
    setRangeStart(new Expression(undefined, []));
    setRangeEnd(new Expression(undefined, []));
    setTab('single');
    onCancel();
  };

  // Helper function to create new expression element (same as editors)
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

  // Recursive element location finder (same as editors)
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
            id, isPaletteItem: false, isMainDropArea: false, isMainExpressionElement: false, 
            isNestedDropArea: false, isNestedExpressionElement: true,
            funcId: funcIdPath[funcIdPath.length - 1], funcIdPath, elementActualId: id, item, index
          };
        } else {
          return {
            id, isPaletteItem: false, isMainDropArea: false, isMainExpressionElement: true, 
            isNestedDropArea: false, isNestedExpressionElement: false,
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

  // Element location detection (adapted from editors)
  const getElementLocationInfo = (id: string): ElementLocation | null => {
    if (id.startsWith('var-') || id.startsWith('op-') || id.startsWith('lit-') || id.startsWith('func-')) {
      return { id, isPaletteItem: true, isMainDropArea: false, isMainExpressionElement: false, isNestedDropArea: false, isNestedExpressionElement: false };
    }
    
    // Main drop areas
    if (id === 'single-index-drop') {
      return { id, isPaletteItem: false, isMainDropArea: true, isMainExpressionElement: false, isNestedDropArea: false, isNestedExpressionElement: false, dropAreaId: 'single-index-drop' };
    }
    if (id === 'range-start-drop') {
      return { id, isPaletteItem: false, isMainDropArea: true, isMainExpressionElement: false, isNestedDropArea: false, isNestedExpressionElement: false, dropAreaId: 'range-start-drop' };
    }
    if (id === 'range-end-drop') {
      return { id, isPaletteItem: false, isMainDropArea: true, isMainExpressionElement: false, isNestedDropArea: false, isNestedExpressionElement: false, dropAreaId: 'range-end-drop' };
    }
    
    // Nested drop areas
    if (id.startsWith('nested-')) {
      const funcId = id.replace('nested-', '');
      let dropAreaId = '';
      let funcElemPath: ElementLocation | null = null;
      
      // Try to find in each expression
      const allExpressions = [
        { expr: singleExpr, areaId: 'single-index-drop' },
        { expr: rangeStart, areaId: 'range-start-drop' },
        { expr: rangeEnd, areaId: 'range-end-drop' }
      ];
      
      for (const { expr, areaId } of allExpressions) {
        funcElemPath = findElementLocationRecursive(funcId, expr.rightSide, []);
        if (funcElemPath) {
          dropAreaId = areaId;
          break;
        }
      }
      
      return { 
        id, isPaletteItem: false, isMainDropArea: false, isMainExpressionElement: false, 
        isNestedDropArea: true, isNestedExpressionElement: false, 
        dropAreaId, funcId, funcIdPath: funcElemPath ? [...(funcElemPath.funcIdPath || []), funcId] : [funcId]
      };
    }

    // Check for expression elements in each expression
    const allExpressions = [
      { expr: singleExpr, areaId: 'single-index-drop' },
      { expr: rangeStart, areaId: 'range-start-drop' },
      { expr: rangeEnd, areaId: 'range-end-drop' }
    ];
    
    for (const { expr, areaId } of allExpressions) {
      const found = findElementLocationRecursive(id, expr.rightSide, []);
      if (found) {
        return { ...found, dropAreaId: areaId };
      }
    }
    
    return null;
  };


  
  const getExpressionStateUpdater = (dropAreaId: string): React.Dispatch<React.SetStateAction<Expression>> | null => {
    if (dropAreaId === 'single-index-drop') return setSingleExpr;
    if (dropAreaId === 'range-start-drop') return setRangeStart;
    if (dropAreaId === 'range-end-drop') return setRangeEnd;
    return null;
  };
  
  const handleAddExpressionElement = (dropAreaId: string, type: 'literal' | 'variable' | 'operator' | 'function', value: string) => {
    const setState = getExpressionStateUpdater(dropAreaId);
    if (!setState) return;

    let newElement: ExpressionElement;
    if (type === 'variable') {
        const variable = getAllVariables().find(v => v.id === value);
        if (!variable) return;
        newElement = new ExpressionElement(uuid(), 'variable', variable.name, variable);
    } else if (type === 'function') {
        newElement = new ExpressionElement(uuid(), 'function', value, new Expression(undefined, []));
    } else {
        newElement = new ExpressionElement(uuid(), type, value);
    }

    setState(prev => prev.clone().addElement(newElement));
  };
  
  const handleRemoveExpressionElement = (dropAreaId: string, elementId: string) => {
    const setState = getExpressionStateUpdater(dropAreaId);
    if (setState) {
      setState(prev => prev.clone().removeElement(elementId));
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveId(active.id as string);

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
    };
    
    let determinedActiveElement: ExpressionElement | null = null;
    
    // Check all expressions for the active element
    const allExpressions = [singleExpr, rangeStart, rangeEnd];
    for (const expr of allExpressions) {
      determinedActiveElement = findActiveElementRecursive(expr.rightSide, active.id as string);
      if (determinedActiveElement) break;
    }

    if (!determinedActiveElement) {
      // Element is from palette
      if ((active.id as string).startsWith('var-')) {
        const varId = (active.id as string).replace('var-', '');
        const variable = getAllVariables().find(v => v.id === varId);
        if (variable) {
          determinedActiveElement = new ExpressionElement(active.id as string, 'variable', variable.name, variable);
          if (variable.type === 'array') {
            determinedActiveElement.value = `${variable.name}[]`;
          }
        }
      } else if ((active.id as string).startsWith('op-')) {
        const op = (active.id as string).replace('op-', '');
        determinedActiveElement = new ExpressionElement(active.id as string, 'operator', op);
      } else if ((active.id as string).startsWith('lit-')) {
        const parts = (active.id as string).split('-');
        if (parts.length >= 3) {
          const value = parts.slice(2).join('-');
          determinedActiveElement = new ExpressionElement(active.id as string, 'literal', value);
        }
      } else if ((active.id as string).startsWith('func-')) {
        const funcName = (active.id as string).replace('func-', '');
        determinedActiveElement = new ExpressionElement(active.id as string, 'function', funcName, new Expression(undefined, []));
      }
    }
    
    setActiveItem(determinedActiveElement);
  };
  
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setActiveItem(null);

    if (!over || !active || !activeItem) {
      return;
    }

    const activeLocation = getElementLocationInfo(active.id as string);
    const overLocation = getElementLocationInfo(over.id as string);

    if (!activeLocation || !overLocation) {
      return;
    }

    // Determine which expression to update
    const targetDropAreaId = overLocation.dropAreaId || activeLocation.dropAreaId;
    if (!targetDropAreaId) return;

    const setState = getExpressionStateUpdater(targetDropAreaId);
    if (!setState) return;

    setState(prevExpr => {
      const newExpr = prevExpr.clone();
      
      const itemToMove = activeLocation.isPaletteItem
        ? createNewElement(activeItem, getAllVariables)
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
        // Reorder within the same list
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
  };



  // Utility function to convert an expression string back into an Expression object
  const parseExpressionString = (exprStr: string): Expression => {
    const elements: ExpressionElement[] = [];

    const vars = getAllVariables();

    const splitTokens = (s: string): string[] => {
      const toks: string[] = [];
      let current = '';
      let depth = 0;
      for (let i = 0; i < s.length; i++) {
        const ch = s[i];
        if (ch === ' ' && depth === 0) {
          if (current !== '') { toks.push(current); current = ''; }
          continue;
        }
        if (ch === '(') depth++;
        if (ch === ')') depth--;
        current += ch;
      }
      if (current.trim() !== '') toks.push(current);
      return toks;
    };

    const tokens = splitTokens(exprStr.trim());
    const functionRegex = /^(integer|string|float|boolean)\((.*)\)$/;

    tokens.forEach(tok => {
      const funcMatch = tok.match(functionRegex);
      if (funcMatch) {
        const funcName = funcMatch[1];
        const inner = funcMatch[2];
        const nestedExpr = parseExpressionString(inner);
        elements.push(new ExpressionElement(uuid(), 'function', funcName, nestedExpr));
        return;
      }

      if (operators.includes(tok as any)) {
        elements.push(new ExpressionElement(uuid(), 'operator', tok));
        return;
      }

      const variable = vars.find(v => v.name === tok);
      if (variable) {
        elements.push(new ExpressionElement(uuid(), 'variable', variable.name, variable));
      } else {
        elements.push(new ExpressionElement(uuid(), 'literal', tok));
      }
    });

    return new Expression(undefined, elements);
  };

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val) handleCancel(); }}>
      <DndContext sensors={sensors} collisionDetection={rectIntersection} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Index for: {variableName}</DialogTitle>
          </DialogHeader>

          <Tabs value={tab} onValueChange={(value) => setTab(value as 'single' | 'range')}>
            <TabsList>
              <TabsTrigger value="single">Single Position</TabsTrigger>
              <TabsTrigger value="range">Range</TabsTrigger>
            </TabsList>
            
            <TabsContent value="single">
              <ExpressionBuilder
                expression={singleExpr}
                addExpressionElement={(type, value) => handleAddExpressionElement('single-index-drop', type, value)}
                removeExpressionElement={(id) => handleRemoveExpressionElement('single-index-drop', id)}
                dropAreaId="single-index-drop"
                excludeVariables={(v: Variable) => v.type !== 'array'}
              />
            </TabsContent>

            <TabsContent value="range">
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium mb-2">Start Index</h4>
                    <ExpressionBuilder
                      expression={rangeStart}
                      addExpressionElement={(type, value) => handleAddExpressionElement('range-start-drop', type, value)}
                      removeExpressionElement={(id) => handleRemoveExpressionElement('range-start-drop', id)}
                      dropAreaId="range-start-drop"
                      excludeVariables={(v: Variable) => v.type !== 'array'}
                      showPalette={false}
                    />
                  </div>
                  <div>
                    <h4 className="text-sm font-medium mb-2">End Index</h4>
                    <ExpressionBuilder
                      expression={rangeEnd}
                      addExpressionElement={(type, value) => handleAddExpressionElement('range-end-drop', type, value)}
                      removeExpressionElement={(id) => handleRemoveExpressionElement('range-end-drop', id)}
                      dropAreaId="range-end-drop"
                      excludeVariables={(v: Variable) => v.type !== 'array'}
                      showPalette={false}
                    />
                  </div>
                </div>

                {/* Shared palette */}
                <div className="mt-4">
                  <Tabs defaultValue="variables">
                    <TabsList className="grid w-full grid-cols-4">
                      <TabsTrigger value="variables">Variables</TabsTrigger>
                      <TabsTrigger value="literals">Literals</TabsTrigger>
                      <TabsTrigger value="operators">Operators</TabsTrigger>
                      <TabsTrigger value="functions">Functions</TabsTrigger>
                    </TabsList>

                    {/* Variables */}
                    <TabsContent value="variables" className="mt-4">
                      <div className="flex flex-wrap gap-2">
                        {getAllVariables().filter(v=>v.type!=='array').map(variable => (
                          <DraggablePaletteItem
                            key={`var-${variable.id}`}
                            id={`var-${variable.id}`}
                            type="variable"
                            value={variable.name}
                            backgroundColor="#d1e7ff"
                            disabled={false}
                            onClick={() => handleAddExpressionElement('range-start-drop','variable',variable.id)}
                            onRightClick={() => handleAddExpressionElement('range-end-drop','variable',variable.id)}
                          />
                        ))}
                      </div>
                    </TabsContent>

                    {/* Literals */}
                    <TabsContent value="literals" className="mt-4">
                      <div className="space-y-3">
                        {/* Boolean literals */}
                        <div className="space-y-1">
                          <Label className="text-xs font-medium">Boolean</Label>
                          <div className="flex gap-1">
                            {['true','false'].map(val=> (
                              <DraggablePaletteItem
                                key={`lit-bool-${val}`}
                                id={`lit-bool-${val}`}
                                type="literal"
                                value={val}
                                backgroundColor="#d1ffd1"
                                disabled={false}
                                onClick={() => handleAddExpressionElement('range-start-drop','literal',val)}
                                onRightClick={() => handleAddExpressionElement('range-end-drop','literal',val)}
                              />
                            ))}
                          </div>
                        </div>

                        {/* Integer literal */}
                        <div className="space-y-1">
                          <Label className="text-xs font-medium">Integer</Label>
                          <div className="flex gap-1">
                            <Input type="number" step="1" placeholder="Integer" id="range-int-lit" className="flex-1 text-sm" />
                            <Button variant="outline" size="sm" onClick={() => {
                              const input=document.getElementById('range-int-lit') as HTMLInputElement; if(input&&input.value){
                                handleAddExpressionElement('range-start-drop','literal',parseInt(input.value).toString()); input.value='';}
                            }}>←Start</Button>
                            <Button variant="outline" size="sm" onClick={() => {
                              const input=document.getElementById('range-int-lit') as HTMLInputElement; if(input&&input.value){
                                handleAddExpressionElement('range-end-drop','literal',parseInt(input.value).toString()); input.value='';}
                            }}>End→</Button>
                          </div>
                        </div>

                        {/* String literal */}
                        <div className="space-y-1">
                          <Label className="text-xs font-medium">String</Label>
                          <div className="flex gap-1">
                            <Input type="text" placeholder="String" id="range-str-lit" className="flex-1 text-sm" />
                            <Button variant="outline" size="sm" onClick={() => {
                              const input=document.getElementById('range-str-lit') as HTMLInputElement; if(input&&input.value){
                                handleAddExpressionElement('range-start-drop','literal',`"${input.value}"`); input.value='';}
                            }}>←Start</Button>
                            <Button variant="outline" size="sm" onClick={() => {
                              const input=document.getElementById('range-str-lit') as HTMLInputElement; if(input&&input.value){
                                handleAddExpressionElement('range-end-drop','literal',`"${input.value}"`); input.value='';}
                            }}>End→</Button>
                          </div>
                        </div>
                      </div>
                    </TabsContent>

                    {/* Operators */}
                    <TabsContent value="operators" className="mt-4">
                      <div className="flex flex-wrap gap-2">
                        {operators.map(op => (
                          <DraggablePaletteItem
                            key={`op-${op}`}
                            id={`op-${op}`}
                            type="operator"
                            value={op}
                            backgroundColor="#ffd1d1"
                            disabled={false}
                            onClick={() => handleAddExpressionElement('range-start-drop','operator',op)}
                            onRightClick={() => handleAddExpressionElement('range-end-drop','operator',op)}
                          />
                        ))}
                      </div>
                    </TabsContent>

                    {/* Functions */}
                    <TabsContent value="functions" className="mt-4">
                      <div className="flex flex-wrap gap-2">
                        {['integer','string','float','boolean'].map(func=> (
                          <DraggablePaletteItem
                            key={`func-${func}`}
                            id={`func-${func}`}
                            type="function"
                            value={`${func}()`}
                            backgroundColor="#d1d1ff"
                            disabled={false}
                            onClick={() => handleAddExpressionElement('range-start-drop','function',func)}
                            onRightClick={() => handleAddExpressionElement('range-end-drop','function',func)}
                          />
                        ))}
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="ghost" onClick={handleCancel}>Cancel</Button>
            <Button onClick={() => tab === 'single' ? onSubmit('single', singleExpr) : (onSubmitRange && onSubmitRange('range', rangeStart, rangeEnd))}>Submit</Button>
          </DialogFooter>
        </DialogContent>
        <DragOverlay>
            {activeItem ? (
                <div className={`px-2 py-1 m-1 rounded text-sm shadow-lg cursor-grabbing
                    ${activeItem.type === 'variable' ? 'bg-blue-100' :
                      activeItem.type === 'operator' ? 'bg-red-100' :
                      activeItem.type === 'literal' && activeItem.value.includes('[') && activeItem.value.includes(']') ? 'bg-blue-100' :
                      activeItem.type === 'literal' ? 'bg-green-100' : 'bg-purple-100'}`}>
                    {activeItem.value}
                </div>
            ) : null}
        </DragOverlay>
      </DndContext>
    </Dialog>
  );
};

export default ArrayIndexDialog; 