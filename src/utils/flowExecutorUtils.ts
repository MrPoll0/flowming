import { Node, getConnectedEdges, ReactFlowInstance, getOutgoers } from "@xyflow/react";
import { RefObject } from "react";
/**
 * Animates/deactivates outgoing edges from a node
 */
export function animateNodeOutgoingEdges(
  reactFlow: ReactFlowInstance,
  node: Node,
  animated: boolean,
  executionSpeed?: number
): void {
    const edges = reactFlow.getEdges();
    const connectedEdges = getConnectedEdges([node], edges);
    const outgoingEdges = connectedEdges.filter(edge => edge.source === node.id);

    // TODO: instead of animating ALL outgoing edges, only animate the edge which has as target the next node to be processed in the queue
        // although parallel execution is not allowed and nodes with multiple outgoing edges are only conditionals which only will have 1 outcome branch...
    
    for (const edge of outgoingEdges) {
      reactFlow.updateEdgeData(edge.id, {
        isAnimated: animated,
        animationDuration: animated ? executionSpeed : undefined
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
            data: {
                ...edge.data,
                isAnimated: false
            },
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
export function toggleNodeAnimations(reactFlow: ReactFlowInstance, node: Node, animated: boolean, executionSpeed?: number): void {
  toggleNodeHighlight(reactFlow, node, animated);
  animateNodeOutgoingEdges(reactFlow, node, animated, executionSpeed);
}

/**
 * Context for the flow execution (used to pass around the execution context to the processCurrentNode and processNextNode functions)
 */
export interface FlowExecutionContext {
  reactFlow: ReactFlowInstance;
  refs: {
    isRunning: RefObject<boolean>;
    isPaused: RefObject<boolean>;
    executionSpeed: RefObject<number>;
    executionCounterRef: RefObject<number>;
    goNextRef: RefObject<boolean>;
    animationCompletedRef: RefObject<boolean>;
  };
  lists?: {
    queue: Node[];
    inQueue: Set<string>;
    processed: Set<string>;
  };
  callbacks: {
    processNodeCallback: (node: Node) => void;
    stopExecutionCallback: () => void;
  };
}

/**
 * Processes the current node in the flow
 */
const processCurrentNode = (executionContext: FlowExecutionContext) => {
    const { reactFlow } = executionContext;
    const { queue, inQueue, processed } = executionContext.lists!;
    const { processNodeCallback } = executionContext.callbacks;
    const currentNode = queue.shift()!;   

    inQueue.delete(currentNode.id);
    processed.add(currentNode.id);

    // console.log("processing current node...");
    processNodeCallback(currentNode);

    // Get outgoers and add to queue
    const outgoingNodes = getOutgoers(currentNode, reactFlow.getNodes(), reactFlow.getEdges());
    outgoingNodes.forEach(node => {
        if (!inQueue.has(node.id)) { // to prevent duplicates
            queue.push(node);
            inQueue.add(node.id);
            
            // If this node was already processed in this execution,
            // it means we've found a loop - we can handle loop-specific logic here if needed
            if (processed.has(node.id)) {
                // console.log("Loop detected for node:", node.id);
            }
        }
    });
}

/**
 * Processes the next node in the flow by polling
 */
const processNextNode = (executionContext: FlowExecutionContext, executionCounter: number) => {
    // NOTE: This function is going to be called even after pausing because of the setTimeout in here
    // console.log("processNextNode");

    const { queue } = executionContext.lists!;
    const { stopExecutionCallback } = executionContext.callbacks;
    const { isRunning, isPaused, executionSpeed, executionCounterRef, goNextRef, animationCompletedRef } = executionContext.refs;

    // ensure that the next node is processed only if in the same execution (i.e. not stopped and started again) to prevent immediate unexpected jumps
    if (executionCounter !== executionCounterRef.current) {
        return;
    }
    
    if (queue.length === 0) {
        stopExecutionCallback();
        return;
    }

    if (!isRunning.current) {
        return;
    }

    // check if the animation has completed and if so, set goNext to true (prevents getting stuck if pausing right after animation ends but processNextNode still not timeout callback)
    if (animationCompletedRef.current && !isPaused.current) {
        // console.log("animationCompletedRef, setting goNext to true...");
        goNextRef.current = true;
        animationCompletedRef.current = false;
    }

    if (!goNextRef.current) {
        //console.log("trying again...");
        // If paused, keep checking until unpaused or stopped
        setTimeout(() => processNextNode(executionContext, executionCounter), 100);
        return;
    }

    console.log("goes through", goNextRef.current, animationCompletedRef.current, isPaused.current)

    // cannot cancel the next node timeout since that will stop the execution -> it is the only one keeping BFS from running
    //                                                                       (TODO: refactor to WHILE [isRunning] instead of polling?)


    processCurrentNode(executionContext);

    // Schedule next node processing with delay
    setTimeout(() => processNextNode(executionContext, executionCounter), executionSpeed.current);
  };

/**
 * Traverses the flow graph using Breadth-First Search (BFS) algorithm
 */
export function BFS(
  executionContext: FlowExecutionContext,
  startNode: Node
): void {
  const { isRunning, isPaused, executionSpeed, executionCounterRef } = executionContext.refs;

  // avoid future unexpected calls/jumps when stop and then start again before timeout finishes
  // by capturing the current execution counter and comparing it with the current execution counter when the timeout callback is called
  const currentExecutionCounter = executionCounterRef.current; 

  if (!isRunning.current || isPaused.current) {
      return;
  }

  const queue: Node[] = [startNode];
  const inQueue = new Set<string>([startNode.id]);
  const processed = new Set<string>();

  executionContext.lists = {
    queue,
    inQueue,
    processed
  };

  // Process the initial node immediately
  processCurrentNode(executionContext);

  // Start processing nodes with a delay after the first one
  setTimeout(() => processNextNode(executionContext, currentExecutionCounter), executionSpeed.current);
}
