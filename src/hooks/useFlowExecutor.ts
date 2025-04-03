import { useReactFlow, Node, getOutgoers } from "@xyflow/react";
import { useState, useCallback, useRef } from "react";
import { 
  toggleLockFlow,
  findStartNode,
  animateNodeOutgoingEdges,
  toggleNodeHighlight,
  resetAllAnimations
} from "../utils/flowExecutorUtils";

interface IExecutor {
    isRunning: boolean;
    isPaused: boolean;
    currentNode: Node | null;
    start(): void;
    stop(): void;
    pause(): void;
    resume(): void;
    reset(): void;
    stepBackward(): void;
    stepForward(): void;
    stepTo(nodeId: string): void;
}

export function useFlowExecutor(): IExecutor {
    const reactFlow = useReactFlow();
    
    // State for UI purposes
    const [isRunningState, setIsRunningState] = useState(false);
    const [isPausedState, setIsPausedState] = useState(false);
    const [currentNode, setCurrentNode] = useState<Node | null>(null);
    
    // Use refs for immediate access in callbacks
    const isRunningRef = useRef(false);
    const isPausedRef = useRef(false);
    const currentNodeRef = useRef<Node | null>(null);

    // Execution speed (TODO: make this configurable)
    const executionSpeedRef = useRef(1000);

    const stopExecution = useCallback(() => {
        setIsRunningState(false);
        isRunningRef.current = false;
        
        setIsPausedState(false);
        isPausedRef.current = false;

        resetAllAnimations(reactFlow);

        setCurrentNode(null);
        currentNodeRef.current = null;

        toggleLockFlow(reactFlow, false);
    }, [reactFlow]);

    const processNode = useCallback((node: Node) => {
        if (!isRunningRef.current || isPausedRef.current) {
            return;
        }
        
        // Keep track of the active node
        currentNodeRef.current = node;
        setCurrentNode(node);


        // TODO: set only 1 outgoing edge for normal nodes (with exceptions)

        // TODO: animated edges are not being reset correctly when next node (but yes after end)
        //       + try animated with svg path animation with time as executionSpeed

        
        toggleNodeHighlight(reactFlow, node.id, true);
        animateNodeOutgoingEdges(reactFlow, node, true);

        if (node.type === "End") {
            return;
        }

        if (node.type === "Condition") {
            return;
        }
        
    }, [reactFlow]);

    const BFS = useCallback((startNode: Node) => {
        if (!isRunningRef.current || isPausedRef.current) {
            return;
        }

        const queue: Node[] = [startNode];
        const visited = new Set<string>();
        visited.add(startNode.id);

        const processCurrentNode = () => {
            const currentNode = queue.shift()!;

            console.log("Processing node:", currentNode.id);

            resetAllAnimations(reactFlow);

            processNode(currentNode);

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
                stopExecution();
            }

            if (!isRunningRef.current || isPausedRef.current) {
                return;
            }

            processCurrentNode();

            // Schedule next node processing with delay
            if (queue.length > 0) {
                setTimeout(processNextNode, executionSpeedRef.current);
            } else {
                // No more nodes to process, reset animations
                setTimeout(() => {
                    if (isRunningRef.current) {
                        stop();
                    }
                }, executionSpeedRef.current);
            }
        };

        // Process the initial node immediately
        processCurrentNode();

        // Start processing nodes with a delay after the first one
        setTimeout(processNextNode, executionSpeedRef.current);
    }, [reactFlow, processNode]);

    const start = useCallback(() => {
        const startNode = findStartNode(reactFlow.getNodes());
        
        if (!startNode) {
            throw new Error("No start node found"); // TODO: handle this
        }

        // First, reset all animations from previous runs
        resetAllAnimations(reactFlow);

        // Update both state and ref
        setIsRunningState(true);
        isRunningRef.current = true;
        
        setIsPausedState(false);
        isPausedRef.current = false;
        
        toggleLockFlow(reactFlow, true);

        // Reset any existing animations
        reactFlow.getEdges().forEach(edge => {
            if (edge.animated) {
                const sourceNode = reactFlow.getNode(edge.source);
                if (sourceNode) {
                    animateNodeOutgoingEdges(reactFlow, sourceNode, false);
                }
            }
        });

        BFS(startNode);
    }, [reactFlow, BFS]);

    const stop = useCallback(() => {
        if (!isRunningRef.current) {
            return;
        }

        stopExecution();
    }, [reactFlow, stopExecution]);

    const pause = useCallback(() => {
        if (!isRunningRef.current) {
            return;
        }

        // Update both state and ref
        setIsPausedState(true);
        isPausedRef.current = true;
    }, []);

    const resume = useCallback(() => {
        if (!isPausedRef.current || !isRunningRef.current) {
            return;
        }

        // Update both state and ref
        setIsPausedState(false);
        isPausedRef.current = false;
    }, []);

    const reset = useCallback(() => {
        stopExecution();
    }, [reactFlow, stopExecution]);

    const stepBackward = useCallback(() => {
        
    }, []);

    const stepForward = useCallback(() => {
        
    }, []);

    const stepTo = useCallback((nodeId: string) => {
        
    }, []);

    return {
        isRunning: isRunningState,
        isPaused: isPausedState,
        currentNode,
        start,
        stop,
        pause,
        resume,
        reset,
        stepBackward,
        stepForward,
        stepTo,
    };
}
