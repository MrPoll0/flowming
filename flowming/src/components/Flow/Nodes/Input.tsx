import { Handle, Position, ReactFlowInstance } from '@xyflow/react';
import { memo } from 'react';
import { getNodeStyles } from '../../../utils/nodeStyles';
import { BaseNode, NodeProcessor } from './NodeTypes';
import { VariableType, Variable } from '../../../models/Variable';
import { IVariable } from '../../../models/IVariable';
import { IValuedVariable, ValuedVariable } from '../../../models/ValuedVariable';
import { Badge } from '@/components/ui/badge';
import BreakpointIndicator from './BreakpointIndicator';
import { Expression } from '../../../models/Expression';
import { ExpressionElement } from '../../../models/ExpressionElement';

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
        (data.variable.type === 'array' ? data.variable.arraySubtype : data.variable.type) as 'string' | 'integer' | 'float' | 'boolean',
        `Please enter a ${data.variable.type} value for the variable "${data.variable.name}" (Block ID: ${data.visualId}).`,
        `Enter ${data.variable.type} value...`
      );
      
      if (input !== null && data.variable) {
        // Convert the raw string input to the correct type based on the variable definition
        let convertedValue: any = input;
        const valueType = data.variable.type === 'array' ? data.variable.arraySubtype : data.variable.type;
        switch (valueType) {
          case 'integer': {
            const parsed = parseInt(input, 10);
            if (isNaN(parsed)) {
              throw new Error(`Invalid integer value: '${input}'.`);
            }
            convertedValue = parsed;
            break;
          }
          case 'float': {
            const parsed = parseFloat(input);
            if (isNaN(parsed)) {
              throw new Error(`Invalid float value: '${input}'.`);
            }
            convertedValue = parsed;
            break;
          }
          case 'boolean': {
            const lowered = input.trim().toLowerCase();
            if (['true', '1', 'yes'].includes(lowered)) convertedValue = true;
            else if (['false', '0', 'no'].includes(lowered)) convertedValue = false;
            else {
              throw new Error(`Invalid boolean value: '${input}'. Expected true/false.`);
            }
            break;
          }
          case 'string':
          default:
            convertedValue = input;
        }

        // Convert IVariable to Variable before passing to fromVariable
        const variableObj = Variable.fromObject(data.variable);

        // If variable is an array and has an index expression, handle element assignment
        if (variableObj.type === 'array' && variableObj.indexExpression && variableObj.indexExpression.length > 0) {
          try {
            // Evaluate index expression (must resolve to integer)
            const indexExpr = new Expression(undefined, variableObj.indexExpression);
            const idx = indexExpr.calculateValue(variableObj.indexExpression, 'integer', currentValuedVariables);

            if (typeof idx !== 'number' || !Number.isInteger(idx)) {
              throw new Error(`Array index for variable "${variableObj.name}" must evaluate to an integer.`);
            }

            // Locate existing valued variable or create a default one
            let existingVarIdx = currentValuedVariables.findIndex(v => v.id === variableObj.id);
            let existingValuedVar: ValuedVariable<VariableType>;
            if (existingVarIdx !== -1) {
              existingValuedVar = currentValuedVariables[existingVarIdx];
            } else {
              existingValuedVar = ValuedVariable.fromVariable(variableObj, null);
            }

            // Ensure array is initialized with correct size
            const arraySize = variableObj.arraySize || (Array.isArray(existingValuedVar.value) ? existingValuedVar.value.length : 0);
            if (idx < 0 || idx >= arraySize) {
              throw new Error(`Array index ${idx} is out of bounds for "${variableObj.name}" (size ${arraySize}).`);
            }

            // Create updated array value
            const updatedArray = Array.isArray(existingValuedVar.value) ? [...existingValuedVar.value] : new Array(arraySize).fill(null);
            updatedArray[idx] = convertedValue;

            const newValuedVariable = new ValuedVariable(variableObj.id, variableObj.type, variableObj.name, variableObj.nodeId, updatedArray, variableObj.arraySubtype, variableObj.arraySize);

            if (existingVarIdx !== -1) {
              currentValuedVariables[existingVarIdx] = newValuedVariable;
            } else {
              currentValuedVariables.push(newValuedVariable);
            }
          } catch (err) {
            console.error(err);
            throw err;
          }
        } else {
          // Scalar variable assignment
          const newValuedVariable = ValuedVariable.fromVariable(variableObj, convertedValue);

          // Overwrite the existing variable
          const existingIndex = currentValuedVariables.findIndex(v => v.id === newValuedVariable.id);
          if (existingIndex !== -1) {
            currentValuedVariables[existingIndex] = newValuedVariable;
          } else {
            currentValuedVariables.push(newValuedVariable);
          }
        }
      }
    }

    return currentValuedVariables;
  }
}
  
const Input = memo(function InputComponent({ data, id: _nodeId }: { data: InputNode; id: string }) {
  const { isHovered, isSelected, isHighlighted, isCodeHighlighted, variable, width, height, visualId, isError, hasBreakpoint, isBreakpointTriggered } = data;
  
  // Helper to stringify index expression for display
  const getIndexString = (indexExpr?: any[]): string | null => {
    if (!indexExpr || indexExpr.length === 0) return null;
    try {
      // Ensure all elements are ExpressionElement instances
      const elems = (indexExpr as any[]).map((e: any): ExpressionElement =>
        e instanceof ExpressionElement ? e : ExpressionElement.fromObject(e)
      );
      return new Expression(undefined, elems as any).toString();
    } catch {
      return null;
    }
  };

  return (
    <div 
      className={`input-node`}
      style={getNodeStyles({
        isHovered,
        isSelected,
        isHighlighted,
        isCodeHighlighted,
        isError,
        hasBreakpoint,
        isBreakpointTriggered,
        minWidth: width ? `${width}px` : '150px',
        minHeight: height ? `${height}px` : '50px',
        additionalStyles: { transform: 'skewX(-20deg)', transformOrigin: '0 0' }
      })}
    >

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
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {hasBreakpoint && <BreakpointIndicator />}
            {visualId}
          </div>
        </div>
      )}
      
      <div style={{ transform: 'skewX(20deg)', transformOrigin: '50% 50%' }}>
        <div className="font-bold text-center mb-2.5">Input</div>

        {variable ? (
          <div className="text-center mb-1">
            <Badge variant="outline" className="font-mono text-sm">
              {variable.name}
              {variable.type === 'array' && (
                <>
                  [
                  {getIndexString(variable.indexExpression) || ''}
                  ]
                </>
              )}
              {' '}= {(variable.type === 'array' ? variable.arraySubtype : variable.type)}(👤)
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