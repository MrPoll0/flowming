import { Handle, Position } from '@xyflow/react';
import { memo } from 'react';
import { getNodeStyles } from '../../../utils/nodeStyles';

interface EndNodeData {
  label?: string;
  isHovered?: boolean;
  isSelected?: boolean;
  isHighlighted?: boolean;
  [key: string]: any; // TODO: remove this?
}

function End({ data }: { data: EndNodeData }) {
  const { isHovered, isSelected, isHighlighted } = data;
  
  return (
    <div className="end-node" style={getNodeStyles({
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
      <div style={{ fontWeight: 'bold' }}>End</div>
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