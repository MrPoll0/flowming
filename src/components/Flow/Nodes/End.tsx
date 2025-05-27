import { Handle, Position } from '@xyflow/react';
import { memo } from 'react';
import { getNodeStyles } from '../../../utils/nodeStyles';
import { BaseNode } from './NodeTypes';

function End({ data }: { data: BaseNode }) {
  const { isHovered, isSelected, isHighlighted, width, height } = data;
  
  return (
    <div className="end-node" style={getNodeStyles({
      isHovered,
      isSelected,
      isHighlighted,
      borderRadius: '50px',
      minWidth: width ? `${width}px` : '100px',
      minHeight: height ? `${height}px` : '40px',
      additionalStyles: {
        alignItems: 'center'
      }
    })}>
      <div className="font-bold">End</div>
      <Handle 
        type="target" 
        position={Position.Top} 
        id="top"
      />
      <Handle 
        type="target" 
        position={Position.Bottom} 
        id="bottom"
      />
      <Handle 
        type="target" 
        position={Position.Right} 
        id="right"
      />
      <Handle 
        type="target" 
        position={Position.Left} 
        id="left"
      />
    </div>
  );
}
 
// Memoize the node component to prevent unnecessary re-renders
export default memo(End);