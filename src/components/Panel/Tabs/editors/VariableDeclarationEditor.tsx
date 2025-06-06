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
  const { getNodeVariables, updateNodeVariables, getAllVariables } = useVariables();
  const [variables, setVariables] = useState<Variable[]>([]);
  const isInitialLoadRef = useRef(true);
  const updateTimeoutRef = useRef<number | null>(null);
  const previousNodeIdRef = useRef<string | null>(null);

  const { isRunning } = useFlowExecutorContext();
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
    
    if (selectedNode && selectedNode.type === 'DeclareVariable') {
      const nodeChanged = previousNodeIdRef.current !== selectedNode.id;
      if (nodeChanged) {
        previousNodeIdRef.current = selectedNode.id;
      }

      const nodeVars = allVariables.filter(v => v.nodeId === selectedNode.id);

      // Only update local state if it differs from the context state
      if (JSON.stringify(nodeVars) !== JSON.stringify(variables.filter(v => v.name.trim() !== ''))) {
        if (nodeVars.length > 0) {
          setVariables(nodeVars);
        } else if (nodeChanged) {
          // If a new node is selected and it has no variables, show a placeholder
          const newVar = new Variable(crypto.randomUUID(), 'integer', '', selectedNode.id);
          setVariables([newVar]);
        } else {
          // If variables were deleted by another user, clear the list
          setVariables([]);
        }
      }
    } else {
      previousNodeIdRef.current = null;
      setVariables([]);
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