import { Handle, Position } from '@xyflow/react';
import { memo } from 'react';

// Define expression element types
export type ExpressionElementType = 'variable' | 'operator' | 'literal';

// Define an expression element structure
export interface ExpressionElement {
  id: string;
  type: ExpressionElementType;
  value: string; // The display value
  variableId?: string; // For variables, store the ID for resilience
}

interface AssignVariableNodeData {
  label?: string;
  isHovered?: boolean;
  isSelected?: boolean;
  expression?: {
    leftSide: string;
    leftSideVarId?: string;
    elements: ExpressionElement[]; // Store expression as structured elements
  };
}

const AssignVariable = memo(function AssignVariableComponent({ data, id: __nodeId }: { data: AssignVariableNodeData; id: string }) {
  const { isHovered, isSelected, expression } = data;
  
  // Render the expression as a string for display
  const expressionString = expression?.elements?.map(e => e.value).join(' ') || '';
  
  return (
    <div className="assign-variable-node" style={{ 
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
      <div style={{ fontWeight: 'bold', textAlign: 'center', marginBottom: '10px' }}>Assign variable</div>
      
      {expression ? (
        <div style={{ 
          padding: '5px 10px',
          backgroundColor: '#f5f5f5',
          borderRadius: '4px',
          fontSize: '14px',
          fontFamily: 'monospace'
        }}>
          <code>{expression.leftSide} = {expressionString}</code>
        </div>
      ) : (
        <div style={{ 
          textAlign: 'center', 
          color: '#888', 
          padding: '10px 0',
          fontStyle: 'italic',
          fontSize: '14px'
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
