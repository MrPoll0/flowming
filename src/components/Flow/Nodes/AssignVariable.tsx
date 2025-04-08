import { Handle, Position } from '@xyflow/react';
import { memo } from 'react';
import { getNodeStyles } from '../../../utils/nodeStyles';
import { BaseNode } from './NodeTypes';

const AssignVariable = memo(function AssignVariableComponent({ data, id: __nodeId }: { data: BaseNode; id: string }) {
  const { isHovered, isSelected, isHighlighted, expression, width, height } = data;
  
  // Render the expression as a string for display
  const expressionString = expression?.elements?.map(e => e.value).join(' ') || '';
  
  return (
    <div className="assign-variable-node" style={getNodeStyles({
      isHovered,
      isSelected,
      isHighlighted,
      minWidth: width ? `${width}px` : '250px',
      minHeight: height ? `${height}px` : '80px'
    })}>
      <div style={{ fontWeight: 'bold', textAlign: 'center', marginBottom: '10px' }}>Assign variable</div>
      
      {expression ? (
        <div style={{ 
          padding: '5px 10px',
          backgroundColor: '#f5f5f5',
          borderRadius: '4px',
          fontSize: '14px',
          fontFamily: 'monospace',
          marginBottom: '4px'
        }}>
          <code>{expression.leftSide} = {expressionString}</code>
        </div>
      ) : (
        <div style={{ 
          textAlign: 'center', 
          color: '#888', 
          padding: '5px 10px',
          fontStyle: 'italic',
          fontSize: '14px',
          marginBottom: '4px'
        }}>
          No assignment defined
        </div>
      )}

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

export default AssignVariable;
