import { useReactFlow, Node } from "@xyflow/react";
import { useState, useCallback, useRef } from "react";
import { 
  toggleLockFlow,
  findStartNode,
  resetAllAnimations,
  toggleNodeAnimations,
  BFS,
  FlowExecutionContext
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

    const executionCounterRef = useRef(0); // track the number of execution to avoid unexpected future jumps if restarting (stop and start again before timeout finishes)
    const goNextRef = useRef(true); // track if the next node should be processed
    const animationCompletedRef = useRef(false); // track if the current animation has completed

    // Create a stable reference to the animation end handler (otherwise multiple callbacks will happen)
    const onAnimationEndRef = useRef<EventListener>((event) => {
        console.log("onAnimationEnd");
        
        // Unpause ref when the animation ends to continue execution
        animationCompletedRef.current = true;
        goNextRef.current = true;
        
        // Remove this listener now that the animation is complete
        if (event.target) {
            (event.target as SVGAnimateMotionElement).removeEventListener('endEvent', onAnimationEndRef.current);
        }
    });

    const stopExecution = useCallback(() => {
        setIsRunningState(false);
        isRunningRef.current = false;
        
        setIsPausedState(false);
        isPausedRef.current = false;

        resetAllAnimations(reactFlow);

        // Clean up any animation end listeners
        const animateMotionElements = document.querySelectorAll('animateMotion');
        animateMotionElements.forEach(el => {
            const element = el as SVGAnimateMotionElement;
            element.removeEventListener('endEvent', onAnimationEndRef.current);
        });

        setCurrentNode(null);
        currentNodeRef.current = null;

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

        // TODO: process node here

        // console.log("processed", node.type)

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
        
        toggleLockFlow(reactFlow, true);

        executionCounterRef.current++;

        const executionContext: FlowExecutionContext = {
            reactFlow,
            refs: {
                isRunning: isRunningRef,
                isPaused: isPausedRef,
                executionSpeed: executionSpeedRef,
                executionCounterRef,
                goNextRef,
                animationCompletedRef
            },
            callbacks: {
                processNodeCallback: processNode,
                stopExecutionCallback: stopExecution
            }
        }
        
        BFS(
            executionContext,
            startNode
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

        // Pause animations first to avoid race condition where animation end event is triggered after changing ref/state
        const svgElements = document.querySelectorAll('svg[id^="edge-animation-"]');
        svgElements.forEach(svg => {
            const svgElement = svg as SVGSVGElement;

            svgElement.pauseAnimations();
        });

        // Update both state and ref
        setIsPausedState(true);
        isPausedRef.current = true;

        // console.log("paused")
        goNextRef.current = false;

        // NOTE: this seems weird here and an event listener should be perhaps in start or like that
        // but in start, we dont have the animateMotion element yet
        // and this is only needed in the case goNextRef is false (by pausing), and it is true by default

        // Find all <animateMotion> elements
        const animateMotionElements = document.querySelectorAll('animateMotion');
        // console.log("animateMotionElements length:", animateMotionElements.length)
        
        animateMotionElements.forEach(el => {
            const element = el as SVGAnimateMotionElement;
            // https://developer.mozilla.org/en-US/docs/Web/API/SVGAnimationElement
            // NOTE: event beginEvent is not useful since this is not setting up events for the next edge animation
            
            element.removeEventListener('endEvent', onAnimationEndRef.current); // remove previous listener to prevent multiple calls
            element.addEventListener('endEvent', onAnimationEndRef.current);

            // element.beginElement() .beginElementAt() .endElement() .endElementAt()
        });

        // TODO: issue -> preemptively ending and processing next node when pausing/resuming multiple times in a row (pause/resume multiple times, then resume and it jumps)

        // TODO: tests for execution logic + pausing and resuming
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

        // Update both state and ref
        setIsPausedState(false);
        isPausedRef.current = false;
        

        goNextRef.current = false;
        
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
