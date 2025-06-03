import { useContext, useState, useEffect, useRef, useCallback } from 'react';
import { SelectedNodeContext } from '../../../../context/SelectedNodeContext';
import { useVariables } from '../../../../context/VariablesContext';
import { Variable } from '../../../../models';
import { variableTypes } from '../../../../models';
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

const VariableDeclarationEditor = () => {
  const { selectedNode } = useContext(SelectedNodeContext);
  const { getNodeVariables, updateNodeVariables } = useVariables();
  const [variables, setVariables] = useState<Variable[]>([]);
  const isInitialLoadRef = useRef(true);
  const updateTimeoutRef = useRef<number | null>(null);
  const previousNodeIdRef = useRef<string | null>(null);

  const { isRunning } = useFlowExecutorContext();

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
          setVariables(nodeVars);
        } else {
          // Initialize with one empty variable if none exist
          const newVar = new Variable(crypto.randomUUID(), 'integer', '', selectedNode.id);
          setVariables([newVar]);
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
  }, [selectedNode, getNodeVariables]);
  
  // Save variables when they change
  useEffect(() => {
    // Skip the initial load
    if (isInitialLoadRef.current) {
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
      const newVar = new Variable(
        crypto.randomUUID(), 
        'integer', 
        '', 
        selectedNode.id
      );

      setVariables(prev => [...prev, newVar]);
    }
  };
  
  const updateVariable = (id: string, field: 'type' | 'name', value: string) => {
    if (selectedNode && selectedNode.type === 'DeclareVariable' && !isRunning) {
      setVariables(prev => 
        prev.map(v => v.id === id ? v.update({ [field]: value }) : v)
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
          <div key={variable.id} className="flex items-center gap-2">
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