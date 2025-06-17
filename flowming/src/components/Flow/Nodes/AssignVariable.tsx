import { Handle, Position, ReactFlowInstance } from '@xyflow/react';
import { memo } from 'react';
import { getNodeStyles } from '../../../utils/nodeStyles';
import { BaseNode, NodeProcessor } from './NodeTypes';
import { Expression, Variable } from '../../../models';
import { IValuedVariable, ValuedVariable } from '../../../models/ValuedVariable';
import { VariableType } from '../../../models/Variable';
import { Badge } from '@/components/ui/badge';
import BreakpointIndicator from './BreakpointIndicator';
import { ExpressionElement } from '@/models/ExpressionElement';

interface AssignVariableNode extends BaseNode {
  expression?: Expression;
  leftSideIndex?: string;
}

export class AssignVariableProcessor implements NodeProcessor {
  // @ts-ignore - _reactFlow is intentionally saved for future use (TODO)
  constructor(private reactFlow: ReactFlowInstance, private nodeId: string, private currentValuedVariables: ValuedVariable<VariableType>[], private expression: Expression | null) {}
  
  process(): ValuedVariable<VariableType>[] {
    if (!this.expression) {
      return []; // NOTE: returning [] will cause the currentValuedVariables to be returned unchanged
                 // do not return this.currentValuedVariables as its an array of objects and not class instances
    }

    const expressionInstance = this.expression instanceof Expression ? this.expression : Expression.fromObject(this.expression);
    console.log(`Processing AssignVariable node ${this.nodeId} with expression:`, expressionInstance.toString());

    // TODO: get all the data with getNode(nodeId) directly?
    
    let currentValuedVariables: ValuedVariable<VariableType>[] = [];
    // Get the current valued variables from the current node, which are stored as objects in node.data
    this.currentValuedVariables.forEach((valuedVariable: IValuedVariable<VariableType>) => {
      currentValuedVariables.push(ValuedVariable.fromObject(valuedVariable));
    });

    console.log("Current valued variables:")
    currentValuedVariables.forEach((valuedVariable: ValuedVariable<VariableType>) => {
      console.log(valuedVariable.toString());
    });

    // TODO: perfomance optimization needed?

    // Ensure that the expression leftSide variables is in the current valued variables
    if (this.expression?.leftSide instanceof Variable && !currentValuedVariables.some(v => v.id === (this.expression?.leftSide as Variable).id)) {
      console.error(`Variable ${this.expression?.leftSide.id} not found in current valued variables`);
      return [];
    }

    // Get the value of the expression as a new valued variables
    const valuedVariable = expressionInstance.assignValue(currentValuedVariables);
    console.log(`Assigned variable: ${valuedVariable.toString()}`);
    
    // Overwrite the existing variable
    const existingIndex = currentValuedVariables.findIndex(v => v.id === valuedVariable.id);
    if (existingIndex !== -1) {
      currentValuedVariables[existingIndex] = valuedVariable;
    } else {
      currentValuedVariables.push(valuedVariable);
    }

    return currentValuedVariables;
  }
}

const AssignVariable = memo(function AssignVariableComponent({ data, id: _nodeId }: { data: AssignVariableNode; id: string }) {
  const { isHovered, isSelected, isHighlighted, isCodeHighlighted, expression, width, height, visualId, isError, hasBreakpoint, isBreakpointTriggered, leftSideIndex } = data as AssignVariableNode & { leftSideIndex?: string };
  
  const buildDisplayString = () => {
    if (!expression) return null;
    const exprInstance = expression instanceof Expression ? expression : Expression.fromObject(expression);
    // For assign variable expressions, leftSide is a Variable
    if (exprInstance.leftSide instanceof Variable) {
      const leftName = exprInstance.leftSide.name;
      const leftDisplay = leftSideIndex ? `${leftName}[${leftSideIndex}]` : leftName;
      const right = exprInstance.rightSide.map((e: any) => (e as ExpressionElement).toString()).join(' ');
      return `${leftDisplay} = ${right}`;
    }
    // Fallback
    return exprInstance.toString();
  };

  const displayString = buildDisplayString();

  return (
    <div 
      className={`assign-variable-node`}
      style={getNodeStyles({
        isHovered,
        isSelected,
        isHighlighted,
        isCodeHighlighted,
        isError,
        hasBreakpoint,
        isBreakpointTriggered,
        minWidth: width ? `${width}px` : '250px',
        minHeight: height ? `${height}px` : '80px'
      })}
    >
      <div className="font-bold text-center mb-2.5">Assign variable</div>
      
      {visualId && (
        <div 
          style={{
            position: 'absolute',
            top: '4px',
            right: '8px',
            fontSize: '0.65rem',
            color: 'rgb(119, 119, 119)',
            fontWeight: 'bold',
            userSelect: 'none',
            zIndex: 1,
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
            borderRadius: '3px',
            padding: '1px 3px',
            lineHeight: '1',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {hasBreakpoint && <BreakpointIndicator />}
            {visualId}
          </div>
        </div>
      )}

      {expression ? (
        <div className="mb-1">
          <Badge variant="outline" className="font-mono text-sm w-full justify-center">
            {displayString}
          </Badge>
        </div>
      ) : (
        <div className="text-center text-muted-foreground px-2.5 py-1 italic text-sm mb-1">
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
