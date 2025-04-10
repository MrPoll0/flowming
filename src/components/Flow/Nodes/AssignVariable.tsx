import { Handle, Position, useReactFlow, ReactFlowInstance } from '@xyflow/react';
import { memo, useEffect } from 'react';
import { getNodeStyles } from '../../../utils/nodeStyles';
import { BaseNode, NodeProcessor } from './NodeTypes';
import { Expression, ExpressionElement } from '../../../models';

interface AssignVariableNode extends BaseNode {
  expression?: Expression;
}

class AssignVariableProcessor implements NodeProcessor {
  // @ts-ignore - _reactFlow is intentionally saved for future use (TODO)
  constructor(private reactFlow: ReactFlowInstance, private nodeId: string, private expression: Expression | null) {}
  
  process(): void {
    // Process the variable declarations (e.g., initialize variables in a runtime)
    console.log(`Processing AssignVariable node ${this.nodeId} with expression:`, this.expression?.toString());

    // For each variable, you could do actual initialization logic here
    this.expression?.rightSide.forEach((el: ExpressionElement) => {
      console.log(`Expression element:`, el.toString());
      // Actual logic to register this variable with your runtime
    });
  }
}

const AssignVariable = memo(function AssignVariableComponent({ data, id: nodeId }: { data: AssignVariableNode; id: string }) {
  const { isHovered, isSelected, isHighlighted, expression, width, height } = data;

  const reactFlow = useReactFlow();
  
  // Create the processor when the component mounts and update it when dependencies change
  useEffect(() => {
    const processor = new AssignVariableProcessor(reactFlow, nodeId, expression ? Expression.fromObject(expression) : null);

    // Set the processor to the node data to make it available for the flow executor to use 
    reactFlow.updateNodeData(nodeId, {
      processor: processor
    });

    // Clean up on unmount
    return () => {
      reactFlow.updateNodeData(nodeId, {
        processor: null
      });
    };
  }, [nodeId, reactFlow, expression]); // NOTE: assigning getNodeVariables here will cause the node to not be dynamically updated when variables change

  
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
          <code>{expression instanceof Expression ? expression.toString() : Expression.fromObject(expression).toString()}</code>
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
