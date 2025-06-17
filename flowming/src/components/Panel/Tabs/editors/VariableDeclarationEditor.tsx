import { useContext, useState, useEffect, useRef, useCallback } from 'react';
import { SelectedNodeContext } from '../../../../context/SelectedNodeContext';
import { useVariables } from '../../../../context/VariablesContext';
import { Variable, arraySubtypes } from '../../../../models';
import { variableTypes } from '../../../../models';
import { useFlowExecutorState } from '../../../../context/FlowExecutorContext';

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

const VariableDeclarationEditor = () => {
  const { selectedNode } = useContext(SelectedNodeContext);
  const { updateNodeVariables, getAllVariables } = useVariables();
  const [variables, setVariables] = useState<Variable[]>([]);
  const [arraySizeInputs, setArraySizeInputs] = useState<Record<string, string>>({});
  const [arraySizeErrors, setArraySizeErrors] = useState<Record<string, boolean>>({});
  const isInitialLoadRef = useRef(true);
  const updateTimeoutRef = useRef<number | null>(null);
  const previousNodeIdRef = useRef<string | null>(null);

  const { isRunning } = useFlowExecutorState();
  const allVariables = getAllVariables();

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
  
  // Load variables when the selected node changes or when the global variable list changes
  useEffect(() => {
    isInitialLoadRef.current = true;

    if (!selectedNode || selectedNode.type !== 'DeclareVariable') {
      previousNodeIdRef.current = null;
      setVariables([]);
    } else {
      const nodeChanged = previousNodeIdRef.current !== selectedNode.id;
      const nodeVars = allVariables.filter(v => v.nodeId === selectedNode.id);

      if (nodeChanged) {
        previousNodeIdRef.current = selectedNode.id;
        if (nodeVars.length > 0) {
          setVariables(nodeVars);
        } else {
          // Show placeholder if no variables are declared
          const newVar = new Variable(crypto.randomUUID(), 'integer', '', selectedNode.id, undefined, undefined);
          setVariables([newVar]);
        }
      } else {
        // Sync local state if context variables have changed
        if (JSON.stringify(nodeVars) !== JSON.stringify(variables.filter(v => v.name.trim() !== ''))) {
          if (nodeVars.length > 0) {
            setVariables(nodeVars);
          } else {
            setVariables([]);
          }
        }
      }
    }

    isInitialLoadRef.current = false;

    return () => {
      clearUpdateTimeout();
    };
  }, [selectedNode, allVariables]);
  
  // Save variables when they change
  useEffect(() => {
    if (isInitialLoadRef.current) {
      return;
    }
    
    if (selectedNode && selectedNode.type === 'DeclareVariable') {
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
      const newVar = new Variable(
        crypto.randomUUID(), 
        'integer', 
        '', 
        selectedNode.id,
        undefined,
        undefined
      );

      setVariables(prev => [...prev, newVar]);
    }
  };
  
  const updateVariable = (id: string, field: 'type' | 'name' | 'arraySubtype' | 'arraySize', value: string | number) => {
    if (selectedNode && selectedNode.type === 'DeclareVariable' && !isRunning) {
      setVariables(prev => 
        prev.map(v => {
          if (v.id === id) {
            const updates: Partial<Variable> = { [field]: value };
            
            // When changing from array to non-array type, clear array properties
            if (field === 'type' && value !== 'array') {
              updates.arraySubtype = undefined;
              updates.arraySize = undefined;
            }
            
            // When changing to array type, set default array properties if not set
            if (field === 'type' && value === 'array') {
              updates.arraySubtype = v.arraySubtype || 'integer';
              updates.arraySize = v.arraySize !== undefined && v.arraySize > 0 ? v.arraySize : 10;
            }
            
            return v.update(updates);
          }
          return v;
        })
      );
    }
  };
  
  const deleteVariable = (id: string) => {
    if (selectedNode && selectedNode.type === 'DeclareVariable' && !isRunning) {
      setVariables(prev => prev.filter(v => v.id !== id));
    }
  };

  // Don't render if not a DeclareVariable node
  if (!selectedNode || selectedNode.type !== 'DeclareVariable') return null;
  
  return (
    <Card className="mt-5">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Variable Declaration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {variables.map((variable) => (
          <div key={variable.id} className="space-y-2">
            <div className="flex items-center gap-2">
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
            
            {/* Array configuration - only show when type is 'array' */}
            {variable.type === 'array' && (
              <div className="flex items-center gap-2 ml-4 p-2 bg-muted/50 rounded">
                <span className="text-sm text-muted-foreground min-w-fit">Array of:</span>
                <Select
                  value={variable.arraySubtype || 'integer'}
                  onValueChange={(value) => updateVariable(variable.id, 'arraySubtype', value)}
                  disabled={isRunning}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {arraySubtypes.map(subtype => (
                      <SelectItem key={subtype} value={subtype}>{subtype}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <span className="text-sm text-muted-foreground min-w-fit">Size:</span>
                <Input
                  type="number"
                  value={arraySizeInputs[variable.id] ?? (variable.arraySize !== undefined ? variable.arraySize.toString() : '10')}
                  onChange={(e) => {
                    const inputValue = e.target.value;
                    // Update the local input state immediately for responsive UI
                    setArraySizeInputs(prev => ({
                      ...prev,
                      [variable.id]: inputValue
                    }));

                    const size = parseInt(inputValue);
                    const isValid = !isNaN(size) && size >= 1;
                    setArraySizeErrors(prev => ({
                      ...prev,
                      [variable.id]: !isValid
                    }));
                    
                    if (isValid) {
                      updateVariable(variable.id, 'arraySize', size);
                    }
                  }}
                  onBlur={(e) => {
                    const inputValue = e.target.value;
                    const size = parseInt(inputValue);
                    const isValid = !isNaN(size) && size >= 1;
                    if (!isValid) {
                      // Reset to minimum value if empty or invalid
                      const newSize = 1;
                      updateVariable(variable.id, 'arraySize', newSize);
                      setArraySizeInputs(prev => ({
                        ...prev,
                        [variable.id]: newSize.toString()
                      }));
                      setArraySizeErrors(prev => ({
                        ...prev,
                        [variable.id]: false
                      }));
                    } else {
                      // Clear local input state if valid
                      setArraySizeInputs(prev => {
                        const newState = { ...prev };
                        delete newState[variable.id];
                        return newState;
                      });
                      setArraySizeErrors(prev => ({
                        ...prev,
                        [variable.id]: false
                      }));
                    }
                  }}
                  placeholder="Size"
                  className={`w-20 ${arraySizeErrors[variable.id] ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                  disabled={isRunning}
                  min="1"
                />
                {arraySizeErrors[variable.id] && (
                  <span className="text-destructive text-xs ml-2">Enter &gt; 0</span>
                )}
              </div>
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

export default VariableDeclarationEditor; 