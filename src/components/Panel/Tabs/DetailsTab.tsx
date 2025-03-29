import { useContext, useState, useEffect, useRef, useCallback } from 'react';
import { SelectedNodeContext } from '../../../context/SelectedNodeContext';
import { useVariables } from '../../../context/VariablesContext';
import { useReactFlow } from '@xyflow/react';

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
  '+', '-', '*', '/', '%', '==', '!=', '>', '<', '>=', '<=', '&&', '||'
];

// Interface for expression elements
interface ExpressionElement {
  id: string;
  type: 'variable' | 'literal' | 'operator';
  value: string;
}

// Component for Details tab that uses the context
const DetailsTab = () => {
  const { selectedNode } = useContext(SelectedNodeContext);
  const { getNodeVariables, updateNodeVariables, getAllVariables } = useVariables();
  const [variables, setVariables] = useState<VariableRow[]>([]);
  const [leftSideVariable, setLeftSideVariable] = useState<string>('');
  const [rightSideExpression, setRightSideExpression] = useState<string>('');
  const [expressionElements, setExpressionElements] = useState<ExpressionElement[]>([]);
  const isInitialLoadRef = useRef(true);
  const updateTimeoutRef = useRef<number | null>(null);
  const previousNodeIdRef = useRef<string | null>(null);
  
  const reactFlowInstance = useReactFlow();
  
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
      
      // Create updated node data
      const updatedData = {
        ...selectedNode.data,
        expression: {
          leftSide,
          rightSide: rightSideExpression
        }
      };

      // Update React Flow nodes state
      reactFlowInstance.setNodes(prevNodes => prevNodes.map(node => 
        node.id === selectedNode.id 
          ? { ...node, data: updatedData }
          : node
      ));
    }
  }, [reactFlowInstance, selectedNode, leftSideVariable, rightSideExpression, getAllVariables]);
  
  // Update right side expression when expression elements change
  useEffect(() => {
    if (selectedNode && selectedNode.type === 'AssignVariable') {
      const expressionString = expressionElements.map(e => e.value).join(' ');
      setRightSideExpression(expressionString);
    }
  }, [expressionElements, selectedNode]);
  
  // Update node data when expression changes
  useEffect(() => {
    if (!isInitialLoadRef.current && selectedNode && selectedNode.type === 'AssignVariable') {
      updateAssignVariableNodeData();
    }
  }, [leftSideVariable, rightSideExpression, selectedNode, updateAssignVariableNodeData]);
  
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
          // Find the variable ID by name
          const allVariables = getAllVariables();
          const variable = allVariables.find(v => v.name === selectedNode.data.expression.leftSide);
          
          if (variable) {
            setLeftSideVariable(variable.id);
          }
          
          // Parse the right side expression if available
          if (selectedNode.data.expression.rightSide) {
            setRightSideExpression(selectedNode.data.expression.rightSide);
            
            // Convert right side expression to elements (simple parsing)
            const parts = selectedNode.data.expression.rightSide.split(' ');
            const elements: ExpressionElement[] = parts.map((part: string) => {
              // Determine element type
              let type: 'variable' | 'literal' | 'operator' = 'literal';
              
              if (operators.includes(part)) {
                type = 'operator';
              } else {
                // Check if it's a variable
                const matchingVar = allVariables.find(v => v.name === part);
                if (matchingVar) {
                  type = 'variable';
                }
              }
              
              return {
                id: crypto.randomUUID(),
                type,
                value: part
              };
            });
            
            setExpressionElements(elements);
          } else {
            setExpressionElements([]);
          }
        } else {
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
    
    // Styles for drag elements
    const dragElementStyle = {
      padding: '4px 8px',
      margin: '4px',
      borderRadius: '4px',
      backgroundColor: '#e0e0e0',
      cursor: 'pointer',
      display: 'inline-block',
      fontSize: '14px',
    };
    
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
      <div key={selectedNode.id} style={{ 
        marginTop: '20px',
        maxHeight: 'calc(100vh - 300px)',  // Add max height
        overflowY: 'auto'                 // Enable vertical scrolling
      }}>
        <h4>Variable Assignment</h4>
        
        {/* Left side (variable selection) */}
        <div style={sectionStyle}>
          <h5 style={{ marginTop: 0, marginBottom: '10px' }}>Select Variable to Assign (Left-hand side)</h5>
          <select
            value={leftSideVariable}
            onChange={(e) => setLeftSideVariable(e.target.value)}
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
                <span style={{ fontWeight: 'bold' }}>
                  {allVariables.find(v => v.id === leftSideVariable)?.name || '(select variable)'} = 
                </span>
                
                {expressionElements.length > 0 ? (
                  <div style={{ display: 'inline', marginLeft: '5px' }}>
                    {expressionElements.map((element, index) => (
                      <div key={element.id} style={{ 
                        ...dragElementStyle, 
                        display: 'inline-block',
                        backgroundColor: 
                          element.type === 'variable' ? '#d1e7ff' :
                          element.type === 'operator' ? '#ffd1d1' : '#d1ffd1',
                      }}>
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
                    ))}
                  </div>
                ) : (
                  <span style={{ color: '#888', fontStyle: 'italic' }}>Empty expression</span>
                )}
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
              {allVariables.map(variable => (
                <div
                  key={variable.id}
                  style={dragElementStyle}
                  onClick={() => addExpressionElement({ id: '', type: 'variable', value: variable.name })}
                >
                  {variable.name}
                </div>
              ))}
              {allVariables.length === 0 && (
                <div style={{ color: '#888', fontStyle: 'italic' }}>No variables declared</div>
              )}
            </div>
            
            {/* Operators section */}
            <div style={sectionStyle}>
              <h5 style={{ marginTop: 0, marginBottom: '10px' }}>Operators</h5>
              {operators.map(op => (
                <div
                  key={op}
                  style={{ ...dragElementStyle, backgroundColor: '#ffd1d1' }}
                  onClick={() => addExpressionElement({ id: '', type: 'operator', value: op })}
                >
                  {op}
                </div>
              ))}
            </div>
            
            {/* Literals section */}
            <div style={sectionStyle}>
              <h5 style={{ marginTop: 0, marginBottom: '10px' }}>Literals</h5>
              {/* String literal */}
              <div>
                <input 
                  type="text" 
                  placeholder="String value" 
                  style={{ width: '70%', padding: '4px', marginRight: '5px' }}
                />
                <button
                  onClick={(e) => {
                    const input = (e.target as HTMLButtonElement).previousElementSibling as HTMLInputElement;
                    if (input && input.value) {
                      addExpressionElement({ id: '', type: 'literal', value: `"${input.value}"` });
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
              
              {/* Number literal */}
              <div style={{ marginTop: '5px' }}>
                <input 
                  type="number" 
                  placeholder="Number value" 
                  style={{ width: '70%', padding: '4px', marginRight: '5px' }}
                />
                <button
                  onClick={(e) => {
                    const input = (e.target as HTMLButtonElement).previousElementSibling as HTMLInputElement;
                    if (input && input.value) {
                      addExpressionElement({ id: '', type: 'literal', value: input.value });
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
                  Add Number
                </button>
              </div>
              
              {/* Boolean literals */}
              <div style={{ marginTop: '5px' }}>
                <button
                  onClick={() => addExpressionElement({ id: '', type: 'literal', value: 'true' })}
                  style={{ 
                    padding: '4px 8px',
                    marginRight: '5px',
                    backgroundColor: '#d1ffd1',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  true
                </button>
                <button
                  onClick={() => addExpressionElement({ id: '', type: 'literal', value: 'false' })}
                  style={{ 
                    padding: '4px 8px',
                    backgroundColor: '#d1ffd1',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  false
                </button>
              </div>
            </div>
          </>
        )}
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