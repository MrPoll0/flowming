import { useContext, useState, useEffect, useRef, useCallback } from 'react';
import { SelectedNodeContext } from '../../../context/SelectedNodeContext';
import { useVariables } from '../../../context/VariablesContext';
import { useReactFlow } from '@xyflow/react';
import { ExpressionElement, ExpressionElementType } from '../../Flow/Nodes/AssignVariable';
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

// Interface for variable row in the editor
interface VariableRow {
  id: string;
  type: string;
  name: string;
}

// Available variable types
const variableTypes = [
  'string',
  'integer',
  'float',
  'boolean',
  'array'
];

// Available operators for expression building
const operators = [
  '+', '-', '*', '/', '%', '!', '==', '!=', '>', '<', '>=', '<=', '&&', '||', '(', ')'
];

// Define props interfaces for components
interface DraggableExpressionElementProps {
  element: ExpressionElement;
  index: number; // Keep this even if unused now, it might be needed later
  removeExpressionElement: (id: string) => void;
}

// Draggable expression element component
const DraggableExpressionElement = ({ element, removeExpressionElement }: DraggableExpressionElementProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: element.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    backgroundColor: 
      element.type === 'variable' ? '#d1e7ff' :
      element.type === 'operator' ? '#ffd1d1' : '#d1ffd1',
    padding: '4px 8px',
    margin: '4px',
    borderRadius: '4px',
    cursor: 'grab',
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
          cursor: 'pointer',
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
}

// Draggable palette item component (non-sortable)
const DraggablePaletteItem = ({ id, value, backgroundColor }: DraggablePaletteItemProps) => {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: id,
  });

  const style = {
    backgroundColor: backgroundColor || '#e0e0e0',
    padding: '4px 8px',
    margin: '4px',
    borderRadius: '4px',
    cursor: 'grab',
    display: 'inline-block',
    fontSize: '14px',
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
const ExpressionDropArea = ({ id, children }: { id: string, children: React.ReactNode }) => {
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
        backgroundColor: isOver ? 'rgba(77, 156, 255, 0.1)' : 'transparent'
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
  const [variables, setVariables] = useState<VariableRow[]>([]);
  const [leftSideVariable, setLeftSideVariable] = useState<string>('');
  const [_rightSideExpression, setRightSideExpression] = useState<string>('');
  const [expressionElements, setExpressionElements] = useState<ExpressionElement[]>([]);
  const isInitialLoadRef = useRef(true);
  const updateTimeoutRef = useRef<number | null>(null);
  const previousNodeIdRef = useRef<string | null>(null);
  
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
  
  // Cleanup function for the debounce timeout
  const clearUpdateTimeout = () => {
    if (updateTimeoutRef.current !== null) {
      window.clearTimeout(updateTimeoutRef.current);
      updateTimeoutRef.current = null;
    }
  };
  
  // Debounced function to update node variables
  const debouncedUpdateNodeVariables = useCallback((nodeId: string, vars: VariableRow[]) => {
    clearUpdateTimeout();
    
    updateTimeoutRef.current = window.setTimeout(() => {
      updateNodeVariables(nodeId, vars);
    }, 100);
  }, [updateNodeVariables]);
  
  // Update the node data for AssignVariable nodes
  const updateAssignVariableNodeData = useCallback(() => {
    if (selectedNode && selectedNode.type === 'AssignVariable') {
      // Find the actual variable name if we have an ID
      const allVariables = getAllVariables();
      const selectedVariable = allVariables.find(v => v.id === leftSideVariable);
      const leftSide = selectedVariable ? selectedVariable.name : '';
      
      let updatedData;
      // Create updated node data based on whether a variable is selected
      if (leftSideVariable) {
        updatedData = {
          ...selectedNode.data,
          expression: {
            leftSide,
            leftSideVarId: leftSideVariable, // Store the variable ID
            elements: expressionElements // Use the elements array directly
          }
        };
      } else {
        // Clear the expression when no variable is selected
        updatedData = {
          ...selectedNode.data,
          expression: null
        };
      }

      // Update React Flow nodes state
      reactFlowInstance.setNodes(prevNodes => prevNodes.map(node => 
        node.id === selectedNode.id 
          ? { ...node, data: updatedData }
          : node
      ));
    }
  }, [reactFlowInstance, selectedNode, leftSideVariable, expressionElements, getAllVariables]);
  
  // Update node data when expression changes
  useEffect(() => {
    // We want to update both when a variable is selected or deselected
    if (!isInitialLoadRef.current && selectedNode && selectedNode.type === 'AssignVariable') {
      updateAssignVariableNodeData();
    }
  }, [leftSideVariable, expressionElements, selectedNode, updateAssignVariableNodeData]);
  
  // Load variables when the selected node changes
  useEffect(() => {
    // Reset initial load flag
    isInitialLoadRef.current = true;
    
    // Clear expressions if node type changes
    if (selectedNode && selectedNode.type !== 'AssignVariable') {
      setLeftSideVariable('');
      setRightSideExpression('');
      setExpressionElements([]);
    }
    
    // Only load if we have a DeclareVariable node selected
    if (selectedNode && selectedNode.type === 'DeclareVariable') {
      // Check if node changed
      if (previousNodeIdRef.current !== selectedNode.id) {
        previousNodeIdRef.current = selectedNode.id;
        const nodeVars = getNodeVariables(selectedNode.id);
        
        if (nodeVars.length > 0) {
          setVariables(nodeVars.map(v => ({ id: v.id, type: v.type, name: v.name })));
        } else {
          // Initialize with one empty variable if none exist
          setVariables([{ id: crypto.randomUUID(), type: 'string', name: '' }]);
        }
      }
    } else if (selectedNode && selectedNode.type === 'AssignVariable') {
      // Load assignment data if available
      if (previousNodeIdRef.current !== selectedNode.id) {
        previousNodeIdRef.current = selectedNode.id;
        
        // Initialize with existing data if available
        if (selectedNode.data.expression) {
          const allVariables = getAllVariables();
          
          // Check for leftSideVarId first (more reliable) and fall back to name matching
          if (selectedNode.data.expression.leftSideVarId) {
            const varId = selectedNode.data.expression.leftSideVarId;
            // Check if the variable with this ID still exists
            if (allVariables.some(v => v.id === varId)) {
              setLeftSideVariable(varId);
            }
          } else if (selectedNode.data.expression.leftSide) {
            // Find the variable ID by name (legacy support)
            const variable = allVariables.find(v => v.name === selectedNode.data.expression.leftSide);
            
            if (variable) {
              setLeftSideVariable(variable.id);
            }
          }
          
          // Use the structured elements directly if available, or parse legacy rightSide
          if (selectedNode.data.expression.elements) {
            setExpressionElements(selectedNode.data.expression.elements);
            // Also set the string representation for compatibility
            setRightSideExpression(selectedNode.data.expression.elements.map((e: ExpressionElement) => e.value).join(' '));
          } else if (selectedNode.data.expression.rightSide) {
            // Legacy support: parse the string into elements
            const rightSide = selectedNode.data.expression.rightSide;
            setRightSideExpression(rightSide);
            
            // Convert right side expression to elements (simple parsing)
            const parts = rightSide.split(' ');
            const elements: ExpressionElement[] = parts.map((part: string) => {
              // Determine element type
              let type: ExpressionElementType = 'literal';
              let variableId: string | undefined = undefined;
              
              if (operators.includes(part)) {
                type = 'operator';
              } else {
                // Check if it's a variable
                const matchingVar = allVariables.find(v => v.name === part);
                if (matchingVar) {
                  type = 'variable';
                  variableId = matchingVar.id;
                }
              }
              
              return {
                id: crypto.randomUUID(),
                type,
                value: part,
                variableId
              };
            });
            
            setExpressionElements(elements);
          } else {
            setExpressionElements([]);
            setRightSideExpression('');
          }
        } else {
          // Reset form state for a new or empty assignment
          setLeftSideVariable('');
          setRightSideExpression('');
          setExpressionElements([]);
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
  }, [selectedNode, getNodeVariables, getAllVariables]);
  
  // Save variables when they change
  useEffect(() => {
    // Skip the initial load
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
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
  }, [variables, selectedNode, debouncedUpdateNodeVariables]);
  
  // Variable management functions
  const addVariable = () => {
    if (selectedNode && selectedNode.type === 'DeclareVariable') {
      setVariables(prev => [...prev, { id: crypto.randomUUID(), type: 'string', name: '' }]);
    }
  };
  
  const updateVariable = (id: string, field: 'type' | 'name', value: string) => {
    if (selectedNode && selectedNode.type === 'DeclareVariable') {
      setVariables(prev => 
        prev.map(v => v.id === id ? { ...v, [field]: value } : v)
      );
    }
  };
  
  const deleteVariable = (id: string) => {
    if (selectedNode && selectedNode.type === 'DeclareVariable') {
      setVariables(prev => prev.filter(v => v.id !== id));
    }
  };
  
  // Expression building functions
  const addExpressionElement = (element: ExpressionElement) => {
    if (selectedNode && selectedNode.type === 'AssignVariable') {
      setExpressionElements(prev => [...prev, { ...element, id: crypto.randomUUID() }]);
    }
  };
  
  const removeExpressionElement = (id: string) => {
    if (selectedNode && selectedNode.type === 'AssignVariable') {
      setExpressionElements(prev => prev.filter(e => e.id !== id));
    }
  };
  
  // Handle drag start
  const handleDragStart = (event: any) => {
    const { active } = event;
    setActiveId(active.id);
    
    // Find the active item
    let foundItem: ExpressionElement | null = null;
    
    // Check if it's an existing expression element being reordered
    const isExistingElement = expressionElements.find(item => item.id === active.id);
    setIsReordering(!!isExistingElement); // Set state based on whether it's reordering

    if (isExistingElement) {
      foundItem = isExistingElement;
    } else if (active.id.startsWith('var-')) { // Check in variables (palette)
      const varId = active.id.replace('var-', '');
      const variable = getAllVariables().find(v => v.id === varId);
      if (variable) {
        foundItem = { 
          id: active.id, 
          type: 'variable' as ExpressionElementType, 
          value: variable.name,
          variableId: variable.id 
        };
      }
    } else if (active.id.startsWith('op-')) { // Check in operators (palette)
      const op = active.id.replace('op-', '');
      foundItem = { id: active.id, type: 'operator' as ExpressionElementType, value: op };
    } else if (active.id.startsWith('lit-')) { // Check in literals (palette)
      const parts = active.id.split('-'); // e.g., "lit-boolean-true"
      if (parts.length >= 3) {
          const value = parts.slice(2).join('-'); // e.g., "true"
          foundItem = { id: active.id, type: 'literal' as ExpressionElementType, value };
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

    // Find the index of the active element if it exists in the expression list
    const activeElementIndex = expressionElements.findIndex(e => e.id === activeId);

    // Check if the target ('over') is the drop area itself
    const overIsDropArea = overId === 'expression-drop-area';
    // Find the index of the element being dropped onto, if applicable
    const overElementIndex = expressionElements.findIndex(e => e.id === overId);


    // Case 1: Reordering existing expression elements
    if (activeElementIndex > -1 && activeId !== overId) {
      // Check if the drop target is another existing element
      if (overElementIndex > -1) {
         // Use arrayMove to update the order in the state
         setExpressionElements(items => arrayMove(items, activeElementIndex, overElementIndex));
      } else {
         // Handle cases where an existing item is dropped onto the container background,
         // not another item. SortableContext might handle visual positioning,
         // but state update might be needed if dropped at beginning/end.
      }
    }
    // Case 2: Adding a new element from the palette
    else if (activeElementIndex === -1 && overIsDropArea) {
      // This is a new element being added to the expression
      if (!activeItem) return; // Safety check

      // Get updated item with new UUID
      let newItem: ExpressionElement; 
      
      // Check if it's a variable and ensure the variableId is preserved
      if (activeItem.type === 'variable') {
        // For variables, extract the real variable ID from the palette ID
        let variableId = activeItem.variableId;
        if (!variableId) {
          // Try to extract from the ID if not present
          const varId = activeId.startsWith('var-') ? activeId.replace('var-', '') : null;
          if (varId) {
            const variable = getAllVariables().find(v => v.id === varId);
            if (variable) {
              variableId = variable.id;
            }
          }
        }
        
        newItem = {
          id: crypto.randomUUID(),
          type: 'variable',
          value: activeItem.value,
          variableId // Store the variable ID for resilience
        };
      } else {
        // For non-variables, just create a new item with a fresh ID
        newItem = {
          id: crypto.randomUUID(),
          type: activeItem.type,
          value: activeItem.value
        };
      }
      
      setExpressionElements(prev => [...prev, newItem]);
    }
    // Case 3: Adding an element at a specific position in the expression
    else if (activeElementIndex === -1 && overElementIndex > -1) {
      // This is a new element being inserted at a specific position
      if (!activeItem) return; // Safety check

      // Get updated item with new UUID
      let newItem: ExpressionElement;
      
      // Check if it's a variable and ensure the variableId is preserved
      if (activeItem.type === 'variable') {
        // For variables, extract the real variable ID from the palette ID
        let variableId = activeItem.variableId;
        if (!variableId) {
          // Try to extract from the ID if not present
          const varId = activeId.startsWith('var-') ? activeId.replace('var-', '') : null;
          if (varId) {
            const variable = getAllVariables().find(v => v.id === varId);
            if (variable) {
              variableId = variable.id;
            }
          }
        }
        
        newItem = {
          id: crypto.randomUUID(),
          type: 'variable',
          value: activeItem.value,
          variableId // Store the variable ID for resilience
        };
      } else {
        // For non-variables, just create a new item with a fresh ID
        newItem = {
          id: crypto.randomUUID(),
          type: activeItem.type,
          value: activeItem.value
        };
      }
      
      // Insert at the specified position
      setExpressionElements(prev => {
        const updated = [...prev];
        updated.splice(overElementIndex, 0, newItem);
        return updated;
      });
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
                border: '1px solid #ccc'
              }}
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
                border: '1px solid #ccc'
              }}
            />
            {variables.length > 1 && (
              <button 
                onClick={() => deleteVariable(variable.id)}
                style={{
                  marginLeft: '8px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '18px'
                }}
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
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%'
          }}
        >
          + Add variable
        </button>
      </div>
    );
  };
  
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
                // Clear expression elements when deselecting the variable
                if (!newValue) {
                  setExpressionElements([]);
                  setRightSideExpression('');
                }
              }}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '4px',
                border: '1px solid #ccc'
              }}
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
              {leftSideVariable ? (
                <>
                  <span style={{ fontWeight: 'bold', marginBottom: '10px', display: 'block' }}>
                    {allVariables.find(v => v.id === leftSideVariable)?.name || '(select variable)'} = 
                  </span>
                  
                  <ExpressionDropArea id="expression-drop-area">
                    <SortableContext 
                      items={expressionElements.map(item => item.id)}
                      strategy={horizontalListSortingStrategy}
                    >
                      {expressionElements.map((element, index) => (
                        <DraggableExpressionElement 
                          key={element.id}
                          element={element}
                          index={index}
                          removeExpressionElement={removeExpressionElement}
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
                  />
                  <button
                    onClick={() => {
                      const input = document.getElementById('string-literal-input') as HTMLInputElement;
                      if (input && input.value) {
                        const value = input.value;
                        addExpressionElement({ 
                          id: '', 
                          type: 'literal', 
                          value: `"${value}"` 
                        });
                        input.value = '';
                      }
                    }}
                    style={{ 
                      padding: '4px 8px',
                      backgroundColor: '#d1ffd1',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
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
                  />
                  <button
                    onClick={() => {
                      const input = document.getElementById('integer-literal-input') as HTMLInputElement;
                      if (input && input.value) {
                        const value = parseInt(input.value).toString(); // Ensure it's an integer
                        addExpressionElement({ 
                          id: '', 
                          type: 'literal', 
                          value
                        });
                        input.value = '';
                      }
                    }}
                    style={{ 
                      padding: '4px 8px',
                      backgroundColor: '#d1ffd1',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
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
                  />
                  <button
                    onClick={() => {
                      const input = document.getElementById('float-literal-input') as HTMLInputElement;
                      if (input && input.value) {
                        const value = parseFloat(input.value).toString();
                        addExpressionElement({ 
                          id: '', 
                          type: 'literal', 
                          value
                        });
                        input.value = '';
                      }
                    }}
                    style={{ 
                      padding: '4px 8px',
                      backgroundColor: '#d1ffd1',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
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
                    />
                    <DraggablePaletteItem
                      id="lit-boolean-false"
                      type="literal"
                      value="false"
                      backgroundColor="#d1ffd1"
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

          {/* Scrollable assignment editor */}
          <div style={{ 
            flex: 1,
            overflowY: 'auto',
            marginTop: '20px'
          }}>
            {renderAssignmentEditor()}
          </div>
        </div>
      ) : (
        <p>No node selected</p>
      )}
    </>
  );
};

export default DetailsTab;