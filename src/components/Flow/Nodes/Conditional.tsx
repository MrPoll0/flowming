import { Handle, Position, ReactFlowInstance } from '@xyflow/react';
import { memo } from 'react'; 
import { BaseNode, NodeProcessor } from './NodeTypes';
import { Expression, VariableType } from '../../../models';
import { getNodeActionsStyles } from '../../../utils/nodeStyles';
import { IValuedVariable } from '../../../models/ValuedVariable';
import { ValuedVariable } from '../../../models/ValuedVariable';
import BreakpointIndicator from './BreakpointIndicator';

// TODO: check https://codesandbox.io/s/react-flow-node-shapes-k47gz
// https://github.com/xyflow/xyflow/discussions/2608
// https://github.com/xyflow/xyflow/issues/700
// https://codesandbox.io/s/condescending-silence-lbzfd?file=/src/DiamondNode.js
// https://danieliser.com/react-flow-example-resources/

// Decision edge labels ([0] = False/No, [1] = True/Yes)
export const decisionEdgeLabels = ['No', 'Yes'];

interface ConditionalNode extends BaseNode {
  expression?: Expression;
}

export class ConditionalProcessor implements NodeProcessor {
  constructor(private reactFlow: ReactFlowInstance, private nodeId: string) {}
  
  process(): { valuedVariables: ValuedVariable<VariableType>[], result: boolean } {
    const node = this.reactFlow.getNode(this.nodeId)!;
    const data = node.data as ConditionalNode;
    console.log(`Processing Conditional node ${this.nodeId} with expression:`, data.expression);
    const expr = data.expression ? Expression.fromObject(data.expression) : null;
    if (!expr) {
      return { valuedVariables: [], result: false };
    }

    let currentValuedVariables: ValuedVariable<VariableType>[] = [];
    data.currentValuedVariables?.forEach((valuedVariable: IValuedVariable<VariableType>) => {
      currentValuedVariables.push(ValuedVariable.fromObject(valuedVariable));
    });

    console.log("Current valued variables:");
    currentValuedVariables.forEach((valuedVariable: ValuedVariable<VariableType>) => {
      console.log(valuedVariable.toString());
    });

    const evaluatedExpression = expr.evaluate(currentValuedVariables);
    console.log(`Evaluated expression: ${evaluatedExpression}`);

    return { 
      valuedVariables: currentValuedVariables, 
      result: evaluatedExpression 
    };
  }
}

const Conditional = memo(function ConditionalComponent({ data, id: _nodeId }: { data: ConditionalNode; id: string }) {
  const { isHovered, isSelected, isHighlighted, isCodeHighlighted, width, height, visualId, isError, hasBreakpoint, isBreakpointTriggered } = data;

  const diamondStyle = {
    width: width,
    height: height,
    transform: "rotate(45deg)",
    background: "white",
    border: "1px solid #222",
    borderRadius: 2,
    ...getNodeActionsStyles({
      isHovered,
      isSelected,
      isHighlighted,
      isCodeHighlighted,
      isError,
      hasBreakpoint,
      isBreakpointTriggered
    }),
  } as React.CSSProperties;
  
  const labelStyle = {
    zIndex: 10,
    position: "relative",
    fontSize: "0.75rem",
    fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    height: "100%",
    transform: "rotate(-45deg)"
  } as React.CSSProperties;
  
  const handleStyle = {
    zIndex: 1,
  } as React.CSSProperties;

  // Custom handle positioning styles to align with diamond corners (TODO: fix alignment handle/edge)
  const topHandleStyle = {
    ...handleStyle,
    left: '0%',
  } as React.CSSProperties;

  const rightHandleStyle = {
    ...handleStyle,
    top: '0%',
  } as React.CSSProperties;

  const bottomHandleStyle = {
    ...handleStyle,
    left: '100%',
  } as React.CSSProperties;

  const leftHandleStyle = {
    ...handleStyle,
    top: '100%',
  } as React.CSSProperties;

  const expr = data.expression ? Expression.fromObject(data.expression) : null;
  const label = (expr && !expr.isEmpty()) ? expr.toString() : 'Conditional';

  // TODO: fix styling wtr expression length

  return (
    <div className="conditional-node" style={diamondStyle}>
      <div style={labelStyle}>{label}</div>

      {visualId && (
        <div 
          style={{
            position: 'absolute',
            top: '-12px',
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: '0.65rem',
            color: 'rgb(119, 119, 119)',
            fontWeight: 'bold',
            userSelect: 'none',
            zIndex: 10,
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            borderRadius: '3px',
            padding: '1px 4px',
            lineHeight: '1',
            border: '1px solid #ddd',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {hasBreakpoint && <BreakpointIndicator />}
            {visualId}
          </div>
        </div>
      )}

      <Handle style={topHandleStyle} type="target" id="top-target" position={Position.Top} />
      <Handle style={topHandleStyle} type="source" id="top-source" position={Position.Top} />
      <Handle style={bottomHandleStyle} type="target" id="bottom-target" position={Position.Bottom} />
      <Handle style={bottomHandleStyle} type="source" id="bottom-source" position={Position.Bottom} />
      <Handle style={leftHandleStyle} type="target" id="left-target" position={Position.Left} />
      <Handle style={leftHandleStyle} type="source" id="left-source" position={Position.Left} />
      <Handle style={rightHandleStyle} type="target" id="right-target" position={Position.Right} />
      <Handle style={rightHandleStyle} type="source" id="right-source" position={Position.Right} />
    </div>
  );
});

export default Conditional;
