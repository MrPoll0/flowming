import { Handle, Position } from '@xyflow/react';
import { memo } from 'react';
import { useVariables } from '../../../context/VariablesContext';

interface DeclareVariableNodeData {
  label?: string;
  isHovered?: boolean;
  isSelected?: boolean;
}

const DeclareVariable = memo(function DeclareVariableComponent({ data, id: nodeId }: { data: DeclareVariableNodeData; id: string }) {
  const { isHovered, isSelected } = data;
  const { getNodeVariables } = useVariables();
  
  const nodeVariables = getNodeVariables(nodeId);

  return (
    <div className="declare-variable-node" style={{ 
      borderRadius: '0px', 
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
      alignItems: 'stretch',
      justifyContent: 'center',
      minWidth: '250px',
    }}>
      <div style={{ fontWeight: 'bold', textAlign: 'center', marginBottom: '10px' }}>Declare variable</div>
      
      {nodeVariables.length > 0 ? (
        <div style={{ padding: '5px 0' }}>
          {nodeVariables.map((variable) => (
            <div key={variable.id} style={{ 
              marginBottom: '4px',
              padding: '5px',
              backgroundColor: '#f5f5f5',
              borderRadius: '4px',
              fontSize: '14px'
            }}>
              <code>{variable.type} {variable.name}</code>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ 
          textAlign: 'center', 
          color: '#888', 
          padding: '10px 0',
          fontStyle: 'italic',
          fontSize: '14px'
        }}>
          No variables defined
        </div>
      )}

      {/* TODO: problem -> cycle/bidirectional edges (doesnt make sense) */}
      {/* could be "fixed" with floating edges */}
      {/* TODO: check outgoing edges limits */}

      {/* Top handle - both source and target */}
      <Handle 
        type="target" 
        position={Position.Top} 
        id="top-target"
      />
      <Handle 
        type="source" 
        position={Position.Top} 
        id="top-source"
      />
      
      {/* Bottom handle - both source and target */}
      <Handle 
        type="target" 
        position={Position.Bottom} 
        id="bottom-target"
      />
      <Handle 
        type="source" 
        position={Position.Bottom} 
        id="bottom-source"
      />
      
      {/* Right handle - both source and target */}
      <Handle 
        type="target" 
        position={Position.Right} 
        id="right-target"
      />
      <Handle 
        type="source" 
        position={Position.Right} 
        id="right-source"
      />
      
      {/* Left handle - both source and target */}
      <Handle 
        type="target" 
        position={Position.Left} 
        id="left-target"
      />
      <Handle 
        type="source" 
        position={Position.Left} 
        id="left-source"
      />
    </div>
  );
});

export default DeclareVariable;