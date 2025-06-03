import { useContext, useState, useEffect, useRef } from 'react';
import { SelectedNodeContext } from '../../../../context/SelectedNodeContext';
import { useVariables } from '../../../../context/VariablesContext';
import { useReactFlow } from '@xyflow/react';
import { useFlowExecutorContext } from '../../../../context/FlowExecutorContext';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const InputEditor = () => {
  const { selectedNode } = useContext(SelectedNodeContext);
  const { getAllVariables } = useVariables();
  const [leftSideVariable, setLeftSideVariable] = useState<string>('');
  const isInitialLoadRef = useRef(true);
  const previousNodeIdRef = useRef<string | null>(null);
  
  const reactFlowInstance = useReactFlow();
  const { isRunning } = useFlowExecutorContext();

  // Update the node data when variable changes for Input node
  useEffect(() => {
    if (selectedNode?.type === 'Input' && !isInitialLoadRef.current) {
      const allVariables = getAllVariables();
      const selectedVariable = allVariables.find(v => v.id === leftSideVariable);
      
      let updatedData;
      if (selectedVariable) {
        updatedData = {
          variable: selectedVariable
        };
      } else {
        updatedData = { variable: null };
      }
      
      // Update the node data
      reactFlowInstance.updateNodeData(selectedNode.id, updatedData);
    }
  }, [leftSideVariable, reactFlowInstance, selectedNode, getAllVariables]);

  // Load input data when the selected node changes
  useEffect(() => {
    // Reset initial load flag
    isInitialLoadRef.current = true;
    
    if (selectedNode && selectedNode.type === 'Input') {
      // Load input variable data if available
      if (previousNodeIdRef.current !== selectedNode.id) {
        previousNodeIdRef.current = selectedNode.id;
        
        // Initialize with existing variable if available
        if (selectedNode.data.variable && selectedNode.data.variable.id) {
          setLeftSideVariable(selectedNode.data.variable.id);
        } else {
          setLeftSideVariable('');
        }
      }
    } else {
      previousNodeIdRef.current = null;
      setLeftSideVariable('');
    }
    
    isInitialLoadRef.current = false;
  }, [selectedNode]);

  // Don't render if not an Input node
  if (!selectedNode || selectedNode.type !== 'Input') return null;
  
  const allVariables = getAllVariables();
  
  return (
    <div key={selectedNode.id}>
      <h4>Input Configuration</h4>
      
      {/* Variable selection */}
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Select Input Variable</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select
            value={leftSideVariable}
            onValueChange={(value) => setLeftSideVariable(value === '__CLEAR__' ? '' : value)}
            disabled={isRunning}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="No variable" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__CLEAR__">No variable</SelectItem>
              {allVariables.map(variable => (
                <SelectItem key={variable.id} value={variable.id}>
                  {variable.name} ({variable.type})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <div className="text-sm text-muted-foreground italic">
            During execution, the program will prompt for this variable's value.
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default InputEditor; 