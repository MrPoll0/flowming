import { Handle, Position, useReactFlow, ReactFlowInstance } from '@xyflow/react';
import { memo, useEffect } from 'react';
import { useVariables } from '../../../context/VariablesContext';
import { getNodeStyles } from '../../../utils/nodeStyles';
import { BaseNode, NodeProcessor } from './NodeTypes';

class DeclareVariableProcessor implements NodeProcessor {
  // @ts-ignore - _reactFlow is intentionally saved for future use (TODO)
  constructor(private reactFlow: ReactFlowInstance, private nodeId: string, private variables: any) {} // TODO: proper typing for variables methods
  
  process(): void {
    // Get variables associated with this node
    const nodeVariables = this.variables.getNodeVariables(this.nodeId);
    
    // Process the variable declarations (e.g., initialize variables in a runtime)
    console.log(`Processing DeclareVariable node ${this.nodeId} with variables:`, nodeVariables);

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
    
    // For each variable, you could do actual initialization logic here
    nodeVariables.forEach((variable: { name: string; type: string }) => {
      console.log(`Initializing variable ${variable.name} of type ${variable.type}`);
      // Actual logic to register this variable with your runtime
    });
  }
}

const DeclareVariable = memo(function DeclareVariableComponent({ data, id: nodeId }: { data: BaseNode; id: string }) {
  const { isHovered, isSelected, isHighlighted, width, height } = data;
  const { getNodeVariables } = useVariables();
  const reactFlow = useReactFlow();
  
  const nodeVariables = getNodeVariables(nodeId);
  
  // Create the processor when the component mounts and update it when dependencies change
  useEffect(() => {
    const processor = new DeclareVariableProcessor(reactFlow, nodeId, {
      getNodeVariables
    });
    
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
  }, [nodeId, reactFlow, getNodeVariables]); // NOTE: getNodeVariables is needed for the processor to get the variables

  return (
    <div className="declare-variable-node" style={getNodeStyles({
      isHovered,
      isSelected,
      isHighlighted,
      minWidth: width ? `${width}px` : '250px',
      minHeight: height ? `${height}px` : '80px'
    })}>
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