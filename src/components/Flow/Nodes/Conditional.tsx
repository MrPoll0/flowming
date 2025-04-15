import { Handle, Position } from '@xyflow/react';
import { memo } from 'react'; 
import { BaseNode } from './NodeTypes';
import { Expression } from '../../../models';
import { getNodeActionsStyles } from '../../../utils/nodeStyles';

// TODO: check https://codesandbox.io/s/react-flow-node-shapes-k47gz
// https://github.com/xyflow/xyflow/discussions/2608
// https://github.com/xyflow/xyflow/issues/700
// https://codesandbox.io/s/condescending-silence-lbzfd?file=/src/DiamondNode.js
// https://danieliser.com/react-flow-example-resources/


interface ConditionalNode extends BaseNode {
  expression?: Expression;
}

const Conditional = memo(function ConditionalComponent({ data, id: _nodeId }: { data: ConditionalNode; id: string }) {
  const { isHovered, isSelected, isHighlighted, width, height } = data;
  
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
    }),
  } as React.CSSProperties;
  
  const labelStyle = {
    zIndex: 10,
    position: "relative",
    fontSize: 12,
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

  return (
    <div className="conditional-node" style={diamondStyle}>
      <div style={labelStyle}>{data.label}</div>
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
