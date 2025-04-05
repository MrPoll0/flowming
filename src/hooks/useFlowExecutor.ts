import { useReactFlow, Node } from "@xyflow/react";
import { useState, useCallback, useRef } from "react";
import { 
  toggleLockFlow,
  findStartNode,
  resetAllAnimations,
  toggleNodeAnimations,
  BFS
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
    const executionSpeedRef = useRef(2000);

    const remainingTimeRef = useRef(0); // track remaining time for the current edge to reach the next node
    const lastResumingTimeRef = useRef(0); // track last time the execution was resumed
    const pauseCounterRef = useRef(0); // track the number of pauses in the same edge

    const stopExecution = useCallback(() => {
        setIsRunningState(false);
        isRunningRef.current = false;
        
        setIsPausedState(false);
        isPausedRef.current = false;

        resetAllAnimations(reactFlow);

        setCurrentNode(null);
        currentNodeRef.current = null;

        pauseCounterRef.current = 0;

        toggleLockFlow(reactFlow, false);
    }, [reactFlow]);

    const processNode = useCallback((node: Node) => {
        if (!isRunningRef.current || isPausedRef.current) {
            return;
        }

        if (currentNodeRef.current) {
            // Reset previous node highlight and animated edges
            toggleNodeAnimations(reactFlow, currentNodeRef.current!, false);
        }
        
        // Keep track of the active node
        currentNodeRef.current = node;
        setCurrentNode(node);


        // TODO: set only 1 outgoing edge for normal nodes (with exceptions)


        if (node.type === "Condition") {
            
        }
        
        toggleNodeAnimations(reactFlow, node, true, executionSpeedRef.current);
        
    }, [reactFlow]);

    const start = useCallback(() => {
        const startNode = findStartNode(reactFlow.getNodes());
        
        if (!startNode) {
            throw new Error("No start node found"); // TODO: handle this
        }

        // First, reset all animations from previous runs
        resetAllAnimations(reactFlow); // TODO: this unconditionally updates all node data and edge data AND STYLING. be careful

        // Update both state and ref
        setIsRunningState(true);
        isRunningRef.current = true;
        
        setIsPausedState(false);
        isPausedRef.current = false;

        pauseCounterRef.current = 0;
        
        toggleLockFlow(reactFlow, true);

        BFS(
            reactFlow, 
            startNode, 
            processNode, 
            isRunningRef, 
            isPausedRef, 
            executionSpeedRef, 
            stopExecution,
            remainingTimeRef,
            lastResumingTimeRef,
            pauseCounterRef
        );
    }, [reactFlow, processNode, stopExecution]);

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

        pauseCounterRef.current++;

        // Pause the SVG edge(s) animation
        const svgElements = document.querySelectorAll('svg[id^="edge-animation-"]');
        svgElements.forEach(svg => {
            const svgElement = svg as SVGSVGElement;
            
            let currentTimeInMs = svgElement.getCurrentTime() * 1000;
            let remainingTimeInMs = executionSpeedRef.current - currentTimeInMs;
            
            // if this is done at currentTime 0 or exceeding executionTime, perhaps catch intersection between old and new circle and new is not paused?
            // => animations are handled in the same function in processNode, so this should not happen

            if (currentTimeInMs <= 100){
                // this is a hack to prevent the animation from stopping while fading in (motion.svg animation), which prevents from seeing the circle in a fixed position with offset

                setTimeout(() => {
                    if(isPausedRef.current) { // prevent this from running if the execution was resumed
                        svgElement.pauseAnimations();

                        remainingTimeRef.current = Math.abs(remainingTimeInMs - (100 - currentTimeInMs)); // abs just in case
                    }
                }, 100 - currentTimeInMs);
            } else {
                svgElement.pauseAnimations();

                remainingTimeRef.current = Math.abs(remainingTimeInMs); // abs just in case
            }
        });
    }, []);

    const resume = useCallback(() => {
        if (!isPausedRef.current || !isRunningRef.current) {
            return;
        }

        // Resume the SVG edge(s) animation
        const svgElements = document.querySelectorAll('svg[id^="edge-animation-"]');
        svgElements.forEach(svg => {
            const svgElement = svg as SVGSVGElement;
            svgElement.unpauseAnimations();
        });

        lastResumingTimeRef.current = Date.now();

        // Update both state and ref
        setIsPausedState(false);
        isPausedRef.current = false;
        
    }, [reactFlow, processNode, stopExecution]);

    const reset = useCallback(() => {
        stopExecution();
    }, [reactFlow, stopExecution]);

    const stepBackward = useCallback(() => {
        
    }, []);

    const stepForward = useCallback(() => {
        
    }, []);

    const stepTo = useCallback(() => {
        
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
