import { Handle, Position, ReactFlowInstance } from '@xyflow/react';
import { memo } from 'react';
import { useVariables } from '../../../context/VariablesContext';
import { getNodeStyles } from '../../../utils/nodeStyles';
import { BaseNode, NodeProcessor } from './NodeTypes';
import { Variable, VariableType } from '../../../models/Variable';
import { IValuedVariable, ValuedVariable } from '../../../models/ValuedVariable';
import { Badge } from '@/components/ui/badge';

export class DeclareVariableProcessor implements NodeProcessor {
  // @ts-ignore - _reactFlow is intentionally saved for future use (TODO)
  constructor(private reactFlow: ReactFlowInstance, private nodeId: string, private currentValuedVariables: ValuedVariable<VariableType>[], private getNodeVariables: any) {} // TODO: proper typing for variables methods
  
  process(): ValuedVariable<VariableType>[] {
    // Get variables associated with this node
    const nodeVariables = this.getNodeVariables(this.nodeId);
    
    // Process the variable declarations (e.g., initialize variables in a runtime)
    // console.log(`Processing DeclareVariable node ${this.nodeId} with variables:`, nodeVariables);

    // TODO: we need to make sure the next node to be processed knows all the variables that came from here
    // and we also need to keep the ones that came before and all the pipe data
    // to pass the data, we could update the node.data and add it something (or use a context, another one...)
    // we CANNOT know which of the outGoers nodes is going to be processed next
    // so we could simply update all the outgoing node's data (min: 1, max: 2 if conditional)
    // it shouldnt interefere with anything because if we update the wrong one, it will be overwritten 
    // if its processed in the future
    // keep variables and expressions separated so that we can do an execution check if variable exists (e.g. throw error if it doesnt)
    // add them to data as lists and append every time (? any performance issues with this?)
    // => actually, we could just keep the defined variables, and their current values (assign variable parses its expression and applies the value according to 
    // its known variables and values)

    // KEEP AN EYE FOR THE FUTURE: debugging, collaboration, etc
    // => e.g. for debugging "history" of variables we could keep a history in each node.data or similar

    // with conditional, how to tell the execution which node to pick? (it will get the first in the queue and we cannot modify the queue... yet...? [if it was in the context...?])
    // or perhaps return (if anything) like true or false (only useful for conditional nodes) to now which way to go?
    // since that return will be picked up in flowExecutorUtils.ts:processCurrentNode which does have access to the queue (and it can modify it, obviously)




    // NOTE: inconsistencies between Variable and ValuedVariable (in type, id, etc) could be a problem
    // but since Variable cannot be modified during execution and ValuedVariable only exists during it, that wont be an issue
    

    // TODO: get all the data with getNode(nodeId) directly?

    let currentValuedVariables: ValuedVariable<VariableType>[] = [];
    const uniqueVariableIds = new Set<string>(); // Set to track unique variable IDs

    // Get the current valued variables from the current node, which are stored as objects in node.data
    this.currentValuedVariables.forEach((valuedVariable: IValuedVariable<VariableType>) => {
      currentValuedVariables.push(ValuedVariable.fromObject(valuedVariable));
      uniqueVariableIds.add(valuedVariable.id);
    });

    console.log("Current valued variables:")
    currentValuedVariables.forEach((valuedVariable: ValuedVariable<VariableType>) => {
      console.log(valuedVariable.toString());
    });

    // Update the current valued variables with the new ones. If the variable already exists, skip it (with the same id it cannot be any different)
    nodeVariables.forEach((variable: Variable) => {
      const newValuedVariable = ValuedVariable.fromVariable(variable, null);
      const existingIndex = currentValuedVariables.findIndex(v => v.id === newValuedVariable.id); // Check for existing variable

      if (existingIndex !== -1) {
        // Skip the existing variable and log a warning
        console.warn(`Variable with ID ${newValuedVariable.id} already exists. Skipping.`);
        // TODO: throw error, declaring variable already declared
      } else {
        // Add new variable
        currentValuedVariables.push(newValuedVariable);
        uniqueVariableIds.add(newValuedVariable.id);
      }
    });

    console.log("Updated valued variables:")
    currentValuedVariables.forEach((valuedVariable: ValuedVariable<VariableType>) => {
      console.log(valuedVariable.toString());
    });

    return currentValuedVariables;
  }
}

const DeclareVariable = memo(function DeclareVariableComponent({ data, id: nodeId }: { data: BaseNode; id: string }) {
  const { isHovered, isSelected, isHighlighted, isCodeHighlighted, width, height, visualId, isError } = data;
  const { getNodeVariables } = useVariables();
  const nodeVariables = getNodeVariables(nodeId);
  
  return (
    <div className="declare-variable-node" style={getNodeStyles({
      isHovered,
      isSelected,
      isHighlighted,
      isCodeHighlighted,
      isError,
      minWidth: width ? `${width}px` : '250px',
      minHeight: height ? `${height}px` : '80px'
    })}>
      <div className="font-bold text-center mb-2.5">Declare variable</div>

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
          {visualId}
        </div>
      )}
      
      {nodeVariables.length > 0 ? (
        <div className="py-1">
          {nodeVariables.map((variable) => (
            <div key={variable.id} className="mb-1 last:mb-0">
              <Badge variant="secondary" className="font-mono text-sm">
                {variable.type} {variable.name}
              </Badge>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center text-muted-foreground py-2.5 italic text-sm">
          No variables defined
        </div>
      )}

      {/* TODO: problem -> cycle/bidirectional edges (doesnt make sense) */}
      {/* could be "fixed" with floating edges */}
      {/* is this actually a problem? perhaps just validate that its not same handles
            but if they are different handles its just a loop between two nodes, which should be allowed
      */}

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