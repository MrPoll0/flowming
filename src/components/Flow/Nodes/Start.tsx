import { Handle, Position } from '@xyflow/react';
import { memo } from 'react';

interface StartNodeData {
  label?: string;
  isHovered?: boolean;
  isSelected?: boolean;
  [key: string]: any;
}

function Start({ data }: { data: StartNodeData }) {
  const { isHovered, isSelected } = data;
  
  return (
    <div className="start-node" style={{ 
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