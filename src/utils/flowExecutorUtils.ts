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


const processCurrentNode = (queue: Node[], inQueue: Set<string>, processed: Set<string>, processNodeCallback: (node: Node) => void, reactFlow: ReactFlowInstance, stopExecutionCallback: () => void, pauseCounterRef: RefObject<number>) => {
    const currentNode = queue.shift()!;   

    inQueue.delete(currentNode.id);
    processed.add(currentNode.id);
    
    // Reset pause counter (it is a counter for pauses in the same edge, so it should be reset every time a new node is processed)
    pauseCounterRef.current = 0;

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

const processNextNode = (queue: Node[], inQueue: Set<string>, processed: Set<string>, processNodeCallback: (node: Node) => void, reactFlow: ReactFlowInstance, stopExecutionCallback: () => void, isRunning: RefObject<boolean>, isPaused: RefObject<boolean>, executionSpeed: RefObject<number>, remainingTimeRef: RefObject<number>, lastResumingTimeRef: RefObject<number>, pauseCounterRef: RefObject<number>) => {
    // NOTE: This function is going to be called even after pausing because of the setTimeout in here

    if (queue.length === 0) {
        stopExecutionCallback();
        return;
    }

    if (!isRunning.current) {
        return;
    }
    
    if (isPaused.current) {
        // If paused, keep checking until unpaused or stopped
        setTimeout(() => processNextNode(queue, inQueue, processed, processNodeCallback, reactFlow, stopExecutionCallback, isRunning, isPaused, executionSpeed, remainingTimeRef, lastResumingTimeRef, pauseCounterRef)
            , 100);
        return;
    }

    // (TODO) Potential problems: timers overlapping (should be fixed by lastResumingTimeRef?) -> retry timer, actualRemaningTime timer (shouldnt be a problem cause !isPaused to modify refs), nextNode timer (will always be called even after pausing cause it comes from the previous call)
    //                     exactly currentTime 0 or exceeding executionTime when pausing
    // (this should be fixed now)

    // cannot cancel the next node timeout since that will stop the execution -> it is the only one keeping BFS from running
    //                                                                       (TODO: refactor to WHILE [isRunning] instead of polling?)

    if (!isPaused.current && remainingTimeRef.current > 0) {
        // handle case where the execution was paused and then resumed by substracting the actual time difference between resuming and now
        let actualRemaningTime = remainingTimeRef.current - (Date.now() - lastResumingTimeRef.current);

        let currentPauseCount = pauseCounterRef.current;
        setTimeout(() => {
            // pause counter ensures that the timeout is not called if the execution was paused and resumed AFTER the timeout was set and BEFORE the timeout finishes
            // so that the next node is not processed earlier than expected
            if (!isPaused.current && currentPauseCount === pauseCounterRef.current) {
                remainingTimeRef.current = 0;
                lastResumingTimeRef.current = 0;
            }

            processNextNode(queue, inQueue, processed, processNodeCallback, reactFlow, stopExecutionCallback, isRunning, isPaused, executionSpeed, remainingTimeRef, lastResumingTimeRef, pauseCounterRef)
        }, actualRemaningTime);
        return;
    }

    processCurrentNode(queue, inQueue, processed, processNodeCallback, reactFlow, stopExecutionCallback, pauseCounterRef);

    // Schedule next node processing with delay
    setTimeout(() => processNextNode(queue, inQueue, processed, processNodeCallback, reactFlow, stopExecutionCallback, isRunning, isPaused, executionSpeed, remainingTimeRef, lastResumingTimeRef, pauseCounterRef), executionSpeed.current);
  };

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
  stopExecutionCallback: () => void,
  remainingTimeRef: RefObject<number>,
  lastResumingTimeRef: RefObject<number>,
  pauseCounterRef: RefObject<number>
): void {
  if (!isRunning.current || isPaused.current) {
      return;
  }

  const queue: Node[] = [startNode];
  const inQueue = new Set<string>([startNode.id]);
  const processed = new Set<string>();

  // Process the initial node immediately
  processCurrentNode(queue, inQueue, processed, processNodeCallback, reactFlow, stopExecutionCallback, pauseCounterRef);

  // Start processing nodes with a delay after the first one
  setTimeout(() => processNextNode(queue, inQueue, processed, processNodeCallback, reactFlow, stopExecutionCallback, isRunning, isPaused, executionSpeed, remainingTimeRef, lastResumingTimeRef, pauseCounterRef), executionSpeed.current);
}
