import { Node, ReactFlowInstance } from "@xyflow/react";
import { RefObject } from "react";
import { IValuedVariable, ValuedVariable } from "../models/ValuedVariable";
import { VariableType } from "../models/Variable";

/**
 * Animates/deactivates outgoing edges from a node
 */
export function animateNodeOutgoingEdge(
  reactFlow: ReactFlowInstance,
  node: Node,
  targetNodeId: string,
  animated: boolean,
  executionSpeed?: number
): void {
    const edges = reactFlow.getEdges();
    const targetEdge = edges.find(edge => edge.source === node.id && edge.target === targetNodeId);

    if (targetEdge) {
      reactFlow.updateEdgeData(targetEdge.id, {
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
export function toggleNodeAnimations(reactFlow: ReactFlowInstance, node: Node, targetNodeId: string, animated: boolean, executionSpeed?: number): void {
  toggleNodeHighlight(reactFlow, node, animated);
  animateNodeOutgoingEdge(reactFlow, node, targetNodeId, animated, executionSpeed);
}

/**
 * Interface for the flow execution (used to pass around the execution context to the processCurrentNode and processNextNode functions)
 */
export interface FlowExecutionInterface {
  reactFlow: ReactFlowInstance;
  refs: {
    isRunning: RefObject<boolean>;
    isPaused: RefObject<boolean>;
    executionSpeed: RefObject<number>;
    pauseCounterRef: RefObject<number>;
    remainingTimeRef: RefObject<number>;
    lastResumingTimeRef: RefObject<number>;
    executionCounterRef: RefObject<number>;
  };
  lists?: {
    queue: string[];
    inQueue: Set<string>;
    processed: Set<string>;
  };
  callbacks: {
    processNodeCallback: (node: Node) => { targetNodeId: string | null, valuedVariables: ValuedVariable<VariableType>[] };
    stopExecutionCallback: () => void;
  };
}

/**
 * Processes the current node in the flow
 */
const processCurrentNode = (executionContext: FlowExecutionInterface) => {
  const { reactFlow } = executionContext;
  const { queue, inQueue, processed } = executionContext.lists!;
  const { processNodeCallback } = executionContext.callbacks;
  const { pauseCounterRef } = executionContext.refs;
  const currentNodeId = queue.shift()!;
  const currentNode = reactFlow.getNode(currentNodeId);

  if (!currentNode) {
    console.error(`Current node ${currentNodeId} not found`);
    return;
  }

  inQueue.delete(currentNodeId);
  processed.add(currentNodeId);
  
  // Reset pause counter (it is a counter for pauses in the same edge, so it should be reset every time a new node is processed)
  pauseCounterRef.current = 0;

  const { targetNodeId, valuedVariables } = processNodeCallback(currentNode);

  if (!targetNodeId) {
    console.log(`Target node not found for node ${currentNode.id}`);
    return;
  }

  const targetNode = reactFlow.getNode(targetNodeId);
  if(!targetNode) {
    console.error(`Target node ${targetNodeId} not found`);
    return;
  }

  // Convert the valued variables to objects to be stored in the node data
  let currentValuedVariables: IValuedVariable<VariableType>[] = [];
  valuedVariables.forEach((valuedVariable: ValuedVariable<VariableType>) => {
    currentValuedVariables.push(valuedVariable.toObject());
  });

  // If no valud variables returned by the processor, use the ones stored in the node data to keep them flowing
  if (currentValuedVariables.length == 0 && currentNode.data.currentValuedVariables) {
    currentValuedVariables = currentNode.data.currentValuedVariables as IValuedVariable<VariableType>[];
  }

  // Update the target node with the new valued variables
  reactFlow.updateNodeData(targetNode.id, {
    currentValuedVariables: currentValuedVariables
  });

  queue.push(targetNode.id);
  inQueue.add(targetNode.id);

  if (processed.has(targetNode.id)) {
    // console.log("Loop detected for node:", targetNode.id);
  }


  /* Get outgoers and add to queue
  const outgoingNodes = getOutgoers(currentNode, reactFlow.getNodes(), reactFlow.getEdges());
  outgoingNodes.forEach(node => {
    if (!inQueue.has(node.id)) { // to prevent duplicates
      queue.push(node);
      inQueue.add(node.id);
      
      if (processed.has(node.id)) {
          // console.log("Loop detected for node:", node.id);
      }
    }
  });*/
}

/**
 * Processes the next node in the flow by polling
 */
const processNextNode = (executionContext: FlowExecutionInterface, executionCounter: number) => {
    // NOTE: This function is going to be called even after pausing because of the setTimeout in here

    const { queue } = executionContext.lists!;
    const { stopExecutionCallback } = executionContext.callbacks;
    const { isRunning, isPaused, executionSpeed, pauseCounterRef, remainingTimeRef, lastResumingTimeRef, executionCounterRef } = executionContext.refs;

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
    
    if (isPaused.current) {
        // If paused, keep checking until unpaused or stopped
        setTimeout(() => processNextNode(executionContext, executionCounter), 100);
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

            processNextNode(executionContext, executionCounter);
        }, actualRemaningTime);
        return;
    }

    processCurrentNode(executionContext);

    // Schedule next node processing with delay
    setTimeout(() => processNextNode(executionContext, executionCounter), executionSpeed.current);
  };

/**
 * Traverses the flow graph using Breadth-First Search (BFS) algorithm
 */
export function BFS(
  executionContext: FlowExecutionInterface,
  startNode: Node
): void {
  const { isRunning, isPaused, executionSpeed, executionCounterRef } = executionContext.refs;

  // avoid future unexpected calls/jumps when stop and then start again before timeout finishes
  // by capturing the current execution counter and comparing it with the current execution counter when the timeout callback is called
  const currentExecutionCounter = executionCounterRef.current; 

  if (!isRunning.current || isPaused.current) {
      return;
  }

  const queue: string[] = [startNode.id];
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
