import { Handle, Position } from '@xyflow/react';
 
function Start() {
  return (
    <div className="start-node" style={{ 
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
 
export default Start;