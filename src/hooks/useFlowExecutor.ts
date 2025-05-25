import { useReactFlow, Node } from "@xyflow/react";
import { useState, useCallback, useRef } from "react";
import { 
  toggleLockFlow,
  findStartNode,
  resetAllAnimations,
  toggleNodeAnimations,
  BFS,
  FlowExecutionInterface
} from "../utils/flowExecutorUtils";
import { NodeProcessor } from "../components/Flow/Nodes/NodeTypes";
import { ValuedVariable } from "../models/ValuedVariable";
import { VariableType } from "../models/Variable";
import { decisionEdgeLabels } from "../components/Flow/Nodes/Conditional";

export interface IExecutor {
    isRunning: boolean;
    isPaused: boolean;
    currentNode: Node | null;
    getIsRunning(): boolean;
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
    const executionCounterRef = useRef(0); // track the number of execution to avoid unexpected future jumps if restarting (stop and start again before timeout finishes)

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

    const processNode = useCallback((node: Node): { targetNodeId: string | null, valuedVariables: ValuedVariable<VariableType>[] } => {
        if (!isRunningRef.current || isPausedRef.current) {
            return { targetNodeId: null, valuedVariables: [] };
        }

        // TODO: be careful with the currentNodeRef.current and others since this node is captured in time
        // and node changes are not reflected immediately here
        // however, the current node data being processed shouldnt change, so that should be fine

        if (currentNodeRef.current) {
            // Reset previous node highlight and animated edges (node.id was the previous target node id)
            toggleNodeAnimations(reactFlow, currentNodeRef.current!, node.id, false);
        }
        
        // Keep track of the active node
        currentNodeRef.current = node;
        setCurrentNode(node);

        // Process the node using its processor if available
        let valuedVariables: ValuedVariable<VariableType>[] = [];
        let processorResult: any = null;
        
        if (node.data && node.data.processor) {
            try {
                const processor = node.data.processor as NodeProcessor;
                processorResult = processor.process();

                if (node.type === "Conditional") {
                    // For condition nodes, extract the valuedVariables
                    if (processorResult && typeof processorResult === 'object' && 'valuedVariables' in processorResult) {
                        valuedVariables = processorResult.valuedVariables;
                    }
                } else if (Array.isArray(processorResult)) {
                    // For other nodes, use the array result directly (currentValuedVariables)
                    valuedVariables = processorResult;
                }
            } catch (error) {
                console.error(`Error processing node ${node.id}:`, error);
                // TODO: handle the error (e.g., stop execution)
            }
        }
        
        let targetNodeId: string = '';
        if (node.type === "Conditional") {
            // Special handling for condition nodes
 
            const conditionResult = processorResult && typeof processorResult === 'object' && 'result' in processorResult 
                ? processorResult.result 
                : false;
            
            const connections = reactFlow.getNodeConnections({ nodeId: node.id });
            const outgoingConnections = connections.filter(connection => connection.source === node.id);
            
            // Find the connection for Yes (true) or No (false) based on the condition result
            const targetLabel = conditionResult ? decisionEdgeLabels[1] : decisionEdgeLabels[0];

            // TODO: if both outgoing connections go to the same node, then we are not exactly choosing the correct one (Yes/No), but the first one
            
            // Find the edge with matching label
            const matchingConnection = outgoingConnections.find(connection => {
                const edge = reactFlow.getEdge(connection.edgeId);
                return edge?.data?.conditionalLabel === targetLabel;
            });
            
            if (matchingConnection) {
                targetNodeId = matchingConnection.target;
                console.log(`Condition evaluated to ${conditionResult}, following '${targetLabel}' path to node ${targetNodeId}`);
            } else {
                console.warn(`No edge labeled '${targetLabel}' found for condition result ${conditionResult}`);
                
                // Fallback: take any available edge if one with the right label doesn't exist
                if (outgoingConnections.length > 0) {
                    targetNodeId = outgoingConnections[0].target;
                    console.log(`Using fallback edge to node ${targetNodeId}`);
                }
            }
        } else {
            const connections = reactFlow.getNodeConnections({ nodeId: node.id });
            const outgoingConnections = connections.filter(connection => connection.source === node.id);
            if (outgoingConnections.length !== 1) {
                console.error(`Node ${node.id} has ${outgoingConnections.length} outgoing connections instead of 1`);
            }
            
            if (outgoingConnections.length > 0) {
                targetNodeId = outgoingConnections[0].target;
            }
        }
        
        toggleNodeAnimations(reactFlow, node, targetNodeId, true, executionSpeedRef.current);
        
        return { targetNodeId, valuedVariables };
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

        executionCounterRef.current++;

        const executionContext: FlowExecutionInterface = {
            reactFlow,
            refs: {
                isRunning: isRunningRef,
                isPaused: isPausedRef,
                executionSpeed: executionSpeedRef,
                pauseCounterRef,
                remainingTimeRef,
                lastResumingTimeRef,
                executionCounterRef
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

        // Update both state and ref
        setIsPausedState(true);
        isPausedRef.current = true;

        pauseCounterRef.current++;

        // TODO: tests for execution logic + pausing and resuming

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
        getIsRunning: () => isRunningState,
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
