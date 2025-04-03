import { Node, getConnectedEdges, ReactFlowInstance } from "@xyflow/react";

/**
 * Animates/deactivates outgoing edges from a node
 */
export function animateNodeOutgoingEdges(
  reactFlow: ReactFlowInstance,
  node: Node,
  animated: boolean
): void {
    const edges = reactFlow.getEdges();
    const connectedEdges = getConnectedEdges([node], edges);
    const outgoingEdges = connectedEdges.filter(edge => edge.source === node.id);
  
    const updatedEdges = edges.map(edge => {
      if (outgoingEdges.some(oe => oe.id === edge.id)) {
        return {
          ...edge,
          animated: animated,
          style: { 
            ...edge.style, 
            stroke: animated ? '#0066ff' : '#555', 
            strokeWidth: 1 
          }
        };
      }
      return edge;
    });

    reactFlow.setEdges(updatedEdges);
}

/**
 * Locks/unlocks all nodes in the flow to prevent editing during execution
 */
export function toggleLockFlow(reactFlow: ReactFlowInstance, lock: boolean): void {
    reactFlow.setNodes(nodes => 
        nodes.map(node => ({
        ...node,
        draggable: !lock,
        selectable: !lock,
        connectable: !lock,
        deletable: !lock
    })));
}

/**
 * Finds the start node in a flow
 */
export function findStartNode(nodes: Node[]): Node | undefined {
  return nodes.find(node => node.type === "Start");
} 

/**
 * Toggles the highlight state of a node
 */
export function toggleNodeHighlight(reactFlow: ReactFlowInstance, nodeId: string, highlight: boolean): void {
  // Use setNodes directly to ensure the update is applied
  /*reactFlow.setNodes(reactFlow.getNodes().map(node => ({
    ...node,
    highlighted: node.id === nodeId ? highlight : false
  })));

  // TODO: does this work?    ->   // TODO: refactor all nodes so that they use a common style for selected/hovered/highlighted
        //       add highlighted style to the node when so
  reactFlow.updateNodeData(nodeId, {
    highlighted: highlight
  });*/
  reactFlow.setNodes(nodes => 
    nodes.map(node => {
      if (node.id === nodeId) {
        return {
          ...node,
          style: {
            ...node.style,
            border: highlight ? '2px solid #0066ff' : undefined,
            boxShadow: highlight ? '0 0 10px rgba(0, 102, 255, 0.5)' : undefined
          },
          data: {
            ...node.data,
            highlighted: highlight
          }
        };
      }
      return node;
    })
  );
}

/**
 * Reset all edge animations in the flow
 */
export function resetAllEdgeAnimations(reactFlow: ReactFlowInstance): void {
    console.log("reset all edges")
    reactFlow.setEdges(edges => 
        edges.map(edge => ({
        ...edge,
        animated: false,
        style: {
            ...edge.style,
            stroke: '#555',
            strokeWidth: 1
        }
        }))
    );
}

/**
 * Reset all node highlights in the flow
 */
export function resetAllNodeHighlights(reactFlow: ReactFlowInstance): void {
    reactFlow.setNodes(nodes => 
        nodes.map(node => ({
        ...node,
        style: {
            ...node.style,
            border: undefined,
            boxShadow: undefined
        },
        data: {
            ...node.data,
            highlighted: false
        }
        }))
    );
}

/**
 * Reset all animations (both edges and nodes)
 */
export function resetAllAnimations(reactFlow: ReactFlowInstance): void {
    resetAllEdgeAnimations(reactFlow);
    resetAllNodeHighlights(reactFlow);
}

