import { Handle, Position, ReactFlowInstance } from '@xyflow/react';
import { memo } from 'react';
import { getNodeStyles } from '../../../utils/nodeStyles';
import { BaseNode, NodeProcessor } from './NodeTypes';
import { IVariable, VariableType, Variable } from '../../../models/Variable';
import { IValuedVariable } from '../../../models/ValuedVariable';
import { ValuedVariable } from '../../../models/ValuedVariable';
import { Badge } from '@/components/ui/badge';

interface InputNode extends BaseNode {
  variable?: IVariable;
}

export class InputProcessor implements NodeProcessor {
  constructor(
    private reactFlow: ReactFlowInstance, 
    private nodeId: string,
    private showInputDialog: (title: string, variableType: 'string' | 'integer' | 'float' | 'boolean', description?: string, placeholder?: string) => Promise<string | null>
  ) {}
  
  async process(): Promise<ValuedVariable<VariableType>[]> {
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

    // Get input from user with dialog
    if (data.variable) {
      const input = await this.showInputDialog(
        `Enter value for ${data.variable.name}`,
        data.variable.type as 'string' | 'integer' | 'float' | 'boolean', // TODO: array
        `Please enter a ${data.variable.type} value for the variable "${data.variable.name}" (Block ID: ${data.visualId}).`,
        `Enter ${data.variable.type} value...`
      );
      
      if (input !== null && data.variable) {
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
    }

    return currentValuedVariables;
  }
}

const Input = memo(function InputComponent({ data, id: _nodeId }: { data: InputNode; id: string }) {
  const { isHovered, isSelected, isHighlighted, isCodeHighlighted, variable, width, height, visualId } = data;

  return (
    <div className="input-node" style={getNodeStyles({
      isHovered,
      isSelected,
      isHighlighted,
      isCodeHighlighted,
      minWidth: width ? `${width}px` : '150px',
      minHeight: height ? `${height}px` : '50px',
      additionalStyles: { transform: 'skewX(-20deg)', transformOrigin: '0 0' }
    })}>

      {visualId && (
        <div 
          style={{
            position: 'absolute',
            top: '4px',
            right: '8px',
            fontSize: '0.65rem',
            color: 'rgb(119, 119, 119)',
            fontWeight: 'bold',
            userSelect: 'none',
            zIndex: 1,
            transform: 'skewX(20deg)',
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
            borderRadius: '3px',
            padding: '1px 3px',
            lineHeight: '1',
          }}
        >
          {visualId}
        </div>
      )}
      
      <div style={{ transform: 'skewX(20deg)', transformOrigin: '50% 50%' }}>
        <div className="font-bold text-center mb-2.5">Input</div>

        {variable ? (
          <div className="text-center mb-1">
            <Badge variant="outline" className="font-mono text-sm">
              {variable.name} = {variable.type}(👤)
            </Badge>
          </div>
        ) : (
          <div className="text-center text-muted-foreground px-2.5 py-1 italic text-sm mb-1">
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