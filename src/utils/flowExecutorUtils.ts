import { Node, getConnectedEdges, ReactFlowInstance, getOutgoers } from "@xyflow/react";
import { RefObject } from "react";
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
    
    for (const edge of outgoingEdges) {
      reactFlow.updateEdge(edge.id, {
        animated: animated,
      });
    }
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
export function toggleNodeHighlight(reactFlow: ReactFlowInstance, node: Node, highlight: boolean): void {
  reactFlow.updateNodeData(node.id, {
    isHighlighted: highlight
  });
}

/**
 * Reset all edge animations in the flow
 */
export function resetAllEdgeAnimations(reactFlow: ReactFlowInstance): void {
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
        data: {
            ...node.data,
            isHighlighted: false
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

/**
 * Toggles the animations of a node (outgoing edges and node highlight)
 */
export function toggleNodeAnimations(reactFlow: ReactFlowInstance, node: Node, animated: boolean): void {
  toggleNodeHighlight(reactFlow, node, animated);
  animateNodeOutgoingEdges(reactFlow, node, animated);
}

/**
 * Traverses the flow graph using Breadth-First Search (BFS) algorithm
 */
export function BFS(
  reactFlow: ReactFlowInstance,
  startNode: Node,
  processNodeCallback: (node: Node) => void,
  isRunning: RefObject<boolean>,
  isPaused: RefObject<boolean>,
  executionSpeed: RefObject<number>,
  stopExecutionCallback: () => void
): void {
  if (!isRunning.current || isPaused.current) {
      return;
  }

  const queue: Node[] = [startNode];
  const visited = new Set<string>();
  visited.add(startNode.id);

  const processCurrentNode = () => {
      const currentNode = queue.shift()!;          

      processNodeCallback(currentNode);

      // Get outgoers and add to queue
      const outgoingNodes = getOutgoers(currentNode, reactFlow.getNodes(), reactFlow.getEdges());
      outgoingNodes.forEach(node => {
          if (!visited.has(node.id)) {
              visited.add(node.id);
              queue.push(node);
          }
      });
  }

  const processNextNode = () => {
      if (queue.length === 0) {
          stopExecutionCallback();
          return;
      }

      if (!isRunning.current || isPaused.current) {
          return;
      }

      processCurrentNode();

      // Schedule next node processing with delay
      setTimeout(processNextNode, executionSpeed.current);
  };

  // Process the initial node immediately
  processCurrentNode();

  // Start processing nodes with a delay after the first one
  setTimeout(processNextNode, executionSpeed.current);
}
