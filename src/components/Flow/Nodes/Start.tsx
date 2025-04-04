import { Handle, Position } from '@xyflow/react';
import { memo } from 'react';
import { getNodeStyles } from '../../../utils/nodeStyles';

interface StartNodeData {
  label?: string;
  isHovered?: boolean;
  isSelected?: boolean;
  isHighlighted?: boolean;
  [key: string]: any; // TODO: remove this?
}

function Start({ data }: { data: StartNodeData }) {
  const { isHovered, isSelected, isHighlighted } = data;
  
  return (
    <div className="start-node" style={getNodeStyles({
      isHovered,
      isSelected,
      isHighlighted,
      borderRadius: '50px',
      minWidth: '100px',
      minHeight: '40px',
      additionalStyles: {
        alignItems: 'center'
      }
    })}>
      <div style={{ fontWeight: 'bold' }}>Start</div>
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