import { Handle, Position } from '@xyflow/react';
import { memo } from 'react';

interface EndNodeData {
  label?: string;
  isHovered?: boolean;
  isSelected?: boolean;
  [key: string]: any;
}

function End({ data }: { data: EndNodeData }) {
  const { isHovered, isSelected } = data;
  
  return (
    <div className="end-node" style={{ 
      borderRadius: '50px', 
      padding: '10px 20px',
      border: isSelected 
        ? '1px solid #1a73e8' 
        : isHovered 
          ? '1px solid #4d9cff' 
          : '1px solid #000',
      boxShadow: isSelected 
        ? '0 0 8px rgba(26, 115, 232, 0.6)' 
        : isHovered 
          ? '0 0 5px rgba(77, 156, 255, 0.5)' 
          : 'none',
      backgroundColor: '#fff',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: '100px',
      minHeight: '40px'
    }}>
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