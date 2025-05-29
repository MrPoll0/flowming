import { Handle, Position } from '@xyflow/react';
import { memo } from 'react';
import { getNodeStyles } from '../../../utils/nodeStyles';
import { BaseNode } from './NodeTypes';

function Start({ data }: { data: BaseNode }) {
  const { isHovered, isSelected, isHighlighted, width, height, visualId } = data;
  
  return (
    <div className="start-node" style={getNodeStyles({
      isHovered,
      isSelected,
      isHighlighted,
      borderRadius: '50px',
      minWidth: width ? `${width}px` : '100px',
      minHeight: height ? `${height}px` : '40px',
      additionalStyles: {
        alignItems: 'center',
        position: 'relative'
      }
    })}>
      <div className="font-bold">Start</div>

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
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
            borderRadius: '3px',
            padding: '1px 3px',
            lineHeight: '1',
          }}
        >
          {visualId}
        </div>
      )}

      <Handle 
        type="source" 
        position={Position.Top} 
        id="top"
      />
      <Handle 
        type="source" 
        position={Position.Bottom} 
        id="bottom"
      />
      <Handle 
        type="source" 
        position={Position.Right} 
        id="right"
      />
      <Handle 
        type="source" 
        position={Position.Left} 
        id="left"
      />
    </div>
  );
}
 
// Memoize the node component to prevent unnecessary re-renders
export default memo(Start);