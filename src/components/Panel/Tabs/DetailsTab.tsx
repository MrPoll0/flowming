import { useContext, useState, useEffect, useRef, useCallback } from 'react';
import { SelectedNodeContext } from '../../../context/SelectedNodeContext';
import { useVariables } from '../../../context/VariablesContext';

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

// Component for Details tab that uses the context
const DetailsTab = () => {
  const { selectedNode } = useContext(SelectedNodeContext);
  const { getNodeVariables, updateNodeVariables } = useVariables();
  const [variables, setVariables] = useState<VariableRow[]>([]);
  const isInitialLoadRef = useRef(true);
  const updateTimeoutRef = useRef<number | null>(null);
  const previousNodeIdRef = useRef<string | null>(null);
  
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
  
  // Load variables when the selected node changes
  useEffect(() => {
    // Reset initial load flag
    isInitialLoadRef.current = true;
    
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
    } else {
      previousNodeIdRef.current = null;
      setVariables([]);
    }
    
    // Cleanup on component unmount or when selected node changes
    return () => {
      clearUpdateTimeout();
    };
  }, [selectedNode, getNodeVariables]);
  
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
    
  return (
    <>
      <h3>Details</h3>
      {selectedNode ? (
        <div>
          <p>Node ID: <strong>{selectedNode.id}</strong></p>
          <p>Type: {selectedNode.type || 'default'}</p>
          <p>Label: {selectedNode.data.label}</p>
          <p>Position: x={selectedNode.position.x.toFixed(2)}, y={selectedNode.position.y.toFixed(2)}</p>
          
          {/* Variable editor for DeclareVariable nodes */}
          {renderVariableEditor()}
    
        </div>
      ) : (
        <p>No node selected</p>
      )}
    </>
  );
};

export default DetailsTab;