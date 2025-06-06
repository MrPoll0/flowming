import { Handle, Position, ReactFlowInstance } from '@xyflow/react';
import { memo } from 'react';
import { getNodeStyles } from '../../../utils/nodeStyles';
import { BaseNode, NodeProcessor, } from './NodeTypes';
import { Expression, VariableType } from '../../../models';
import { IValuedVariable } from '../../../models/ValuedVariable';
import { ValuedVariable } from '../../../models/ValuedVariable';
import { Badge } from '@/components/ui/badge';

interface OutputNode extends BaseNode {
  expression?: Expression;
}

export class OutputProcessor implements NodeProcessor {
  constructor(private reactFlow: ReactFlowInstance, private nodeId: string) {}
  
  process(): ValuedVariable<VariableType>[] {
    const node = this.reactFlow.getNode(this.nodeId)!;
    const data = node.data as OutputNode;
    console.log(`Processing Output node ${this.nodeId} with expression:`, data.expression);

    let currentValuedVariables: ValuedVariable<VariableType>[] = [];
    data.currentValuedVariables?.forEach((valuedVariable: IValuedVariable<VariableType>) => {
      currentValuedVariables.push(ValuedVariable.fromObject(valuedVariable));
    });

    console.log("Current valued variables:");
    currentValuedVariables.forEach((valuedVariable: ValuedVariable<VariableType>) => {
      console.log(valuedVariable.toString());
    });

    // TODO: output sanitization for XSS attacks?

    if(data.expression) {
      const expr = data.expression && !(data.expression instanceof Expression) ? Expression.fromObject(data.expression) : null;
      if(expr) {
        const value = expr.calculateValue(expr.rightSide, null, currentValuedVariables);
        console.log(`Output value: ${value}`);
      }
    }

    return currentValuedVariables;
  }
}

const Output = memo(function OutputComponent({ data, id: _nodeId }: { data: OutputNode; id: string }) {
  const { isHovered, isSelected, isHighlighted, isCodeHighlighted, expression, width, height, visualId } = data;

  const expr = expression && !(expression instanceof Expression) ? Expression.fromObject(expression) : null;

  return (
    <div className="output-node" style={getNodeStyles({
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
        <div className="font-bold text-center mb-2.5">Output</div>

        {expr && !expr.isEmpty() ? (
          <Badge variant="outline" className="font-mono text-sm">
            {expr.toString()}
          </Badge>
        ) : (
          <div className="text-center text-muted-foreground px-2.5 py-1 italic text-sm">
            No output defined
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

export default Output; 