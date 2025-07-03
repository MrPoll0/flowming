import { useContext, useState, useEffect, useRef } from 'react';
import { SelectedNodeContext } from '../../../../context/SelectedNodeContext';
import { useVariables } from '../../../../context/VariablesContext';
import { useReactFlow } from '@xyflow/react';
import { useFlowExecutorState } from '../../../../context/FlowExecutorContext';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import ArrayIndexDialog from "@/components/ui/ArrayIndexDialog";
import { Variable } from "../../../../models/Variable";
import { Expression, ExpressionElement } from "../../../../models";

const InputEditor = () => {
  const { selectedNode } = useContext(SelectedNodeContext);
  const { getAllVariables } = useVariables();
  const [leftSideVariable, setLeftSideVariable] = useState<string>('');
  const isInitialLoadRef = useRef(true);
  const previousNodeIdRef = useRef<string | null>(null);
  
  const reactFlowInstance = useReactFlow();
  const { isRunning } = useFlowExecutorState();

  // Additional state for array index handling
  // leftSideIndexExprElems stores the structured index expression (array element tokens)
  const [leftSideIndexExprElems, setLeftSideIndexExprElems] = useState<ExpressionElement[] | null>(null);
  const [isIndexDialogOpen, setIsIndexDialogOpen] = useState(false);
  const [arrayVariableForIndex, setArrayVariableForIndex] = useState<Variable | null>(null);
  const [initialExpression, setInitialExpression] = useState<Expression | null>(null);
  const [initialRangeStart, setInitialRangeStart] = useState<Expression | null>(null);
  const [initialRangeEnd, setInitialRangeEnd] = useState<Expression | null>(null);
  const [initialTab, setInitialTab] = useState<'single' | 'range'>('single');
  // Track whether the dialog is editing the index of the currently selected variable
  const [isEditingIndex, setIsEditingIndex] = useState(false);

  // Update the node data when variable changes for Input node
  useEffect(() => {
    if (selectedNode?.type === 'Input' && !isInitialLoadRef.current) {
      const allVariables = getAllVariables();
      const selectedVariable = allVariables.find(v => v.id === leftSideVariable);
      
      let updatedData;
      if (selectedVariable) {
        let variableClone = selectedVariable.clone();

        // Attach index expression if applicable (array variable with index)
        if (selectedVariable.type === 'array' && leftSideIndexExprElems && leftSideIndexExprElems.length > 0) {
          (variableClone as any).indexExpression = leftSideIndexExprElems.map(e => e.clone());
        }

        updatedData = {
          variable: variableClone,
        };
      } else {
        updatedData = { variable: null };
      }
      
      // Update the node data
      reactFlowInstance.updateNodeData(selectedNode.id, updatedData);
    }
  }, [leftSideVariable, leftSideIndexExprElems, reactFlowInstance, selectedNode, getAllVariables]);

  // Load input data when the selected node changes or when its data changes (for collaboration)
  useEffect(() => {
    // Reset initial load flag
    isInitialLoadRef.current = true;
    
    if (selectedNode && selectedNode.type === 'Input') {
      // Load input variable data if available or if data has changed (collaboration)
      const nodeChanged = previousNodeIdRef.current !== selectedNode.id;
      const hasVariableData = selectedNode.data.variable;
      
      if (nodeChanged) {
        previousNodeIdRef.current = selectedNode.id;
      }
      
      // Always update if node changed OR if we have variable data (to handle collaborative updates)
      if (nodeChanged || hasVariableData) {
        // Initialize with existing variable if available
        if (selectedNode.data.variable && selectedNode.data.variable.id) {
          setLeftSideVariable(selectedNode.data.variable.id);

          // Load stored index if present (array variables)
          if (selectedNode.data.variable.indexExpression && selectedNode.data.variable.indexExpression.length > 0) {
            try {
              // Ensure every element is an ExpressionElement instance (can be plain objects after Yjs sync)
              const elems = selectedNode.data.variable.indexExpression.map((e: any): ExpressionElement => {
                return e instanceof ExpressionElement ? e : ExpressionElement.fromObject(e);
              });
              setLeftSideIndexExprElems(elems.map((el: ExpressionElement) => el.clone()));
            } catch {
              setLeftSideIndexExprElems(null);
            }
          } else {
            setLeftSideIndexExprElems(null);
          }
        } else if (nodeChanged) {
          // Only reset when it's a new node (not when collaborative data is cleared)
          setLeftSideVariable('');
          setLeftSideIndexExprElems(null);
        }
      }
    } else {
      previousNodeIdRef.current = null;
      setLeftSideVariable('');
      setLeftSideIndexExprElems(null);
    }
    
    isInitialLoadRef.current = false;
  }, [selectedNode, selectedNode?.data?.variable]);

  // Updated handler for variable change to support arrays
  const handleVariableChange = (value: string) => {
    if (value === '__CLEAR__') {
      setLeftSideVariable('');
      setLeftSideIndexExprElems(null);
      if (selectedNode) {
        reactFlowInstance.updateNodeData(selectedNode.id, { variable: null });
      }
      return;
    }

    const variable = getAllVariables().find(v => v.id === value);
    if (!variable) return;

    setLeftSideVariable(variable.id);

    if (variable.type === 'array') {
      setArrayVariableForIndex(variable);
      setIsEditingIndex(true);

      // Prefill dialog if index already exists
      if (leftSideIndexExprElems && leftSideIndexExprElems.length > 0) {
        setInitialTab('single');
        setInitialExpression(new Expression(undefined, leftSideIndexExprElems.map(e => e.clone())));
        setInitialRangeStart(null);
        setInitialRangeEnd(null);
      } else {
        setInitialTab('single');
        setInitialExpression(new Expression(undefined, []));
      }

      // Defer opening the dialog until after the Select dropdown has closed
      setTimeout(() => setIsIndexDialogOpen(true), 0);
    } else {
      setLeftSideIndexExprElems(null);
      // Update node data immediately for non-array variables
      const variableClone = variable.clone();
      reactFlowInstance.updateNodeData(selectedNode!.id, { variable: variableClone });
    }
  };

  // Dialog submit handlers
  const handleDialogSubmitSingle = (_: 'single', expr: Expression) => {
    if (!arrayVariableForIndex || !selectedNode) return;

    if (expr.isEmpty()) {
      // Treat empty as cancel
      handleDialogCancel();
      return;
    }

    setLeftSideIndexExprElems(expr.rightSide.map(e => e.clone()));

    const variableClone = arrayVariableForIndex.clone();
    (variableClone as any).indexExpression = expr.rightSide.map(e => e.clone());

    reactFlowInstance.updateNodeData(selectedNode.id, { variable: variableClone });

    setIsIndexDialogOpen(false);
    setArrayVariableForIndex(null);
    setIsEditingIndex(false);
  };

  const handleDialogSubmitRange = (_: 'range', start: Expression, end: Expression) => {
    // For Input block we treat range the same as single expression string representation
    if (!arrayVariableForIndex || !selectedNode) return;

    if (start.isEmpty() || end.isEmpty()) {
      handleDialogCancel();
      return;
    }

    // Range not supported for actual element assignment in Input node; store as string only
    const variableClone = arrayVariableForIndex.clone();
    reactFlowInstance.updateNodeData(selectedNode.id, { variable: variableClone });

    setIsIndexDialogOpen(false);
    setArrayVariableForIndex(null);
    setIsEditingIndex(false);
  };

  const handleDialogCancel = () => {
    setIsIndexDialogOpen(false);
    setArrayVariableForIndex(null);

    if (isEditingIndex && (!leftSideIndexExprElems || leftSideIndexExprElems.length === 0)) {
      // User canceled before providing an index -> deselect variable
      setLeftSideVariable('');
    }

    setIsEditingIndex(false);
  };

  // Don't render if not an Input node
  if (!selectedNode || selectedNode.type !== 'Input') return null;
  
  const allVariables = getAllVariables();
  
  return (
    <>
      {/* Array index dialog */}
      <ArrayIndexDialog
        open={isIndexDialogOpen}
        variableName={arrayVariableForIndex?.name || ''}
        onCancel={handleDialogCancel}
        onSubmit={handleDialogSubmitSingle}
        onSubmitRange={handleDialogSubmitRange}
        initialExpression={initialExpression || undefined}
        initialRangeStart={initialRangeStart || undefined}
        initialRangeEnd={initialRangeEnd || undefined}
        initialTab={initialTab}
      />

      <div key={selectedNode.id}>
        
        {/* Variable selection */}
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Input Variable</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Select
                value={leftSideVariable}
                onValueChange={(value) => handleVariableChange(value)}
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
              {/* Index display / edit button for arrays */}
              {(() => {
                const selectedVar = allVariables.find(v => v.id === leftSideVariable);
                if (selectedVar && selectedVar.type === 'array') {
                  return (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isRunning}
                      onClick={() => {
                        setArrayVariableForIndex(selectedVar);
                        setIsEditingIndex(true);
                        // Prefill dialog with existing index if any
                        if (leftSideIndexExprElems && leftSideIndexExprElems.length > 0) {
                          setInitialTab('single');
                          setInitialExpression(new Expression(undefined, leftSideIndexExprElems.map(e => e.clone())));
                          setInitialRangeStart(null);
                          setInitialRangeEnd(null);
                        } else {
                          setInitialTab('single');
                          setInitialExpression(new Expression(undefined, []));
                        }
                        // Defer opening the dialog until after the Select dropdown has closed
                        setTimeout(() => setIsIndexDialogOpen(true), 0);
                      }}
                    >
                      {leftSideIndexExprElems && leftSideIndexExprElems.length > 0 ? `[${new Expression(undefined, leftSideIndexExprElems).toString()}]` : '[]'}
                    </Button>
                  );
                }
                return null;
              })()}
            </div>

            <div className="text-sm text-muted-foreground italic">
              During execution, the program will prompt for this variable's value.
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default InputEditor; 