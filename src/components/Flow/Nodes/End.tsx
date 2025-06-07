import { Handle, Position } from '@xyflow/react';
import { memo } from 'react';
import { getNodeStyles } from '../../../utils/nodeStyles';
import { BaseNode } from './NodeTypes';

const End = memo(function EndComponent({ data }: { data: BaseNode }) {
  const { isHovered, isSelected, isHighlighted, isCodeHighlighted, isError, width, height, visualId } = data;
  
  return (
    <div className="end-node" style={getNodeStyles({
      isHovered,
      isSelected,
      isHighlighted,
      isCodeHighlighted,
      borderRadius: '50px',
      isError,
      minWidth: width ? `${width}px` : '100px',
      minHeight: height ? `${height}px` : '40px',
      additionalStyles: {
        alignItems: 'center',
        position: 'relative'
      }
    })}>
      <div className="font-bold">End</div>

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
});

export default End;