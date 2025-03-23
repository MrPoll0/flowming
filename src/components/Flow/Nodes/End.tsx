import { Handle, Position } from '@xyflow/react';
 
function End() {
  return (
    <div className="end-node" style={{ 
      borderRadius: '50px', 
      padding: '10px 20px',
      border: '1px solid #000',
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
 
export default End;