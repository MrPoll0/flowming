import { Handle, Position, ReactFlowInstance, useReactFlow } from '@xyflow/react';
import { memo, useEffect } from 'react';
import { getNodeStyles } from '../../../utils/nodeStyles';
import { BaseNode, NodeProcessor, } from './NodeTypes';
import { Expression, VariableType } from '../../../models';
import { IValuedVariable } from '../../../models/ValuedVariable';
import { ValuedVariable } from '../../../models/ValuedVariable';

interface OutputNode extends BaseNode {
  expression?: Expression;
}

class OutputProcessor implements NodeProcessor {
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

const Output = memo(function OutputComponent({ data, id: nodeId }: { data: OutputNode; id: string }) {
  const { isHovered, isSelected, isHighlighted, expression, width, height } = data;

  // TODO: expression is not Expression but ExpressionElement[]
  // or just Expression without leftSide? (setup in constructor)
  // but it may be an extension of Expression or somewhat because it can also have string concatenation, commas, etc (e.g. variable1, variable2?)

  const reactFlow = useReactFlow();

  // Update processor only on mount/unmount to prevent infinite loops
  useEffect(() => {
    const processor = new OutputProcessor(reactFlow, nodeId);

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

  const expr = expression && !(expression instanceof Expression) ? Expression.fromObject(expression) : null;

  return (
    <div className="output-node" style={getNodeStyles({
      isHovered,
      isSelected,
      isHighlighted,
      minWidth: width ? `${width}px` : '150px',
      minHeight: height ? `${height}px` : '50px',
      additionalStyles: { transform: 'skewX(-20deg)', transformOrigin: '0 0' }
    })}>
      <div style={{ transform: 'skewX(20deg)', transformOrigin: '50% 50%' }}>
        <div style={{ fontWeight: 'bold', textAlign: 'center', marginBottom: '10px' }}>Output</div>

        {expr && !expr.isEmpty() ? (
          <div style={{
            padding: '5px 10px',
            backgroundColor: '#f5f5f5',
            borderRadius: '4px',
            fontSize: '14px',
            fontFamily: 'monospace',
          }}>
            <code>{expr.toString()}</code>
          </div>
        ) : (
          <div style={{
            textAlign: 'center', 
            color: '#888', 
            padding: '5px 10px',
            fontStyle: 'italic',
            fontSize: '14px',
          }}>
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