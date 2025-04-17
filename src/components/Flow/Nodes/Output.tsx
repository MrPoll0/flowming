import { Handle, Position } from '@xyflow/react';
import { memo } from 'react';
import { getNodeStyles } from '../../../utils/nodeStyles';
import { BaseNode, } from './NodeTypes';
import { Expression } from '../../../models';

interface OutputNode extends BaseNode {
  expression?: Expression;
}

const Output = memo(function OutputComponent({ data, id: nodeId }: { data: OutputNode; id: string }) {
  const { isHovered, isSelected, isHighlighted, expression, width, height } = data;

  // TODO: expression is not Expression but ExpressionElement[]
  // or just Expression without leftSide? (setup in constructor)

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

        {expression ? (
          <div style={{
            padding: '5px 10px',
            backgroundColor: '#f5f5f5',
            borderRadius: '4px',
            fontSize: '14px',
            fontFamily: 'monospace',
          }}>
            <code>{expression instanceof Expression ? expression.toString() : Expression.fromObject(expression).toString()}</code>
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