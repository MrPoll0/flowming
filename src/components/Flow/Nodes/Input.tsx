import { Handle, Position, ReactFlowInstance, useReactFlow } from '@xyflow/react';
import { memo, useEffect } from 'react';
import { getNodeStyles } from '../../../utils/nodeStyles';
import { BaseNode, NodeProcessor } from './NodeTypes';
import { IVariable, VariableType, Variable } from '../../../models/Variable';
import { IValuedVariable } from '../../../models/ValuedVariable';
import { ValuedVariable } from '../../../models/ValuedVariable';

interface InputNode extends BaseNode {
  variable?: IVariable;
}

class InputProcessor implements NodeProcessor {
    constructor(private reactFlow: ReactFlowInstance, private nodeId: string) {}
    
    process(): ValuedVariable<VariableType>[] {
      const node = this.reactFlow.getNode(this.nodeId)!;
      const data = node.data as InputNode;
      console.log(`Processing Input node ${this.nodeId} with variable:`, data.variable);
  
      let currentValuedVariables: ValuedVariable<VariableType>[] = [];
      data.currentValuedVariables?.forEach((valuedVariable: IValuedVariable<VariableType>) => {
        currentValuedVariables.push(ValuedVariable.fromObject(valuedVariable));
      });
  
      console.log("Current valued variables:");
      currentValuedVariables.forEach((valuedVariable: ValuedVariable<VariableType>) => {
        console.log(valuedVariable.toString());
      });

      // TODO: input sanitization for XSS attacks

      // Get basic input from user with prompt (TODO: how to handle user input?)
      const input = prompt(data.variable?.name);
      if (input && data.variable) {
        // Convert IVariable to Variable before passing to fromVariable
        const variableObj = Variable.fromObject(data.variable);
        const newValuedVariable = ValuedVariable.fromVariable(variableObj, input);
        
        // Overwrite the existing variable
        const existingIndex = currentValuedVariables.findIndex(v => v.id === newValuedVariable.id);
        if (existingIndex !== -1) {
          currentValuedVariables[existingIndex] = newValuedVariable;
        } else {
          currentValuedVariables.push(newValuedVariable);
        }
      }
  
      return currentValuedVariables;
    }
  }

const Input = memo(function InputComponent({ data, id: nodeId }: { data: InputNode; id: string }) {
  const { isHovered, isSelected, isHighlighted, variable, width, height } = data;

  const reactFlow = useReactFlow();

  // Update processor only on mount/unmount to prevent infinite loops
  useEffect(() => {
    const processor = new InputProcessor(reactFlow, nodeId);

    // Set the processor to the node data to make it available for the flow executor to use 
    reactFlow.updateNodeData(nodeId, {
      processor: processor
    });

    // Clean up on unmount
    return () => {
      reactFlow.updateNodeData(nodeId, {
        processor: null
      });
    };
  }, [nodeId, reactFlow]);

  return (
    <div className="input-node" style={getNodeStyles({
      isHovered,
      isSelected,
      isHighlighted,
      minWidth: width ? `${width}px` : '150px',
      minHeight: height ? `${height}px` : '50px',
      additionalStyles: { transform: 'skewX(-20deg)', transformOrigin: '0 0' }
    })}>
      <div style={{ transform: 'skewX(20deg)', transformOrigin: '50% 50%' }}>
        <div style={{ fontWeight: 'bold', textAlign: 'center', marginBottom: '10px' }}>Input</div>

        {variable ? (
          <div style={{
            textAlign: 'center',
            padding: '5px 10px',
            backgroundColor: '#f5f5f5',
            borderRadius: '4px',
            fontSize: '14px',
            fontFamily: 'monospace',
            marginBottom: '4px'
          }}>
            <code>{variable.name}</code>
          </div>
        ) : (
          <div style={{
            textAlign: 'center', 
            color: '#888', 
            padding: '5px 10px',
            fontStyle: 'italic',
            fontSize: '14px',
            marginBottom: '4px'
          }}>
            No variable defined
          </div>
        )}
      </div>

      <div style={{ transform: 'skewX(20deg)', position: 'absolute', width: '100%', height: '100%', top: 0, left: 0 }}>
        <Handle type="target" position={Position.Top} id="top-target" />
        <Handle type="source" position={Position.Top} id="top-source" />
        <Handle type="target" position={Position.Bottom} id="bottom-target" />
        <Handle type="source" position={Position.Bottom} id="bottom-source" />
        <Handle type="target" position={Position.Left} id="left-target" />
        <Handle type="source" position={Position.Left} id="left-source" />
        <Handle type="target" position={Position.Right} id="right-target" />
        <Handle type="source" position={Position.Right} id="right-source" />
      </div>
    </div>
  );
});

export default Input; 