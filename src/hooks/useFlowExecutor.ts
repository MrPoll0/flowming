import { useReactFlow, Node, ReactFlowInstance } from "@xyflow/react";
import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { 
  toggleLockFlow,
  findStartNode,
  resetAllAnimations,
  toggleNodeAnimations,
  BFS,
  FlowExecutionInterface
} from "../utils/flowExecutorUtils";
import { NodeProcessor } from "../components/Flow/Nodes/NodeTypes";
import { ValuedVariable, IValuedVariable } from "../models/ValuedVariable";
import { VariableType } from "../models/Variable";
import { decisionEdgeLabels } from "../components/Flow/Nodes/Conditional";
import { useSystemSettings } from "../context/SystemSettingsContext";
import { useDebugger } from "../context/DebuggerContext";
import { DeclareVariableProcessor } from "@/components/Flow/Nodes/DeclareVariable";
import { useVariables } from "@/context/VariablesContext";
import { FlowNode } from "@/components/Flow/FlowTypes";
import { InputProcessor } from "@/components/Flow/Nodes/Input";
import { OutputProcessor } from "@/components/Flow/Nodes/Output";
import { AssignVariableProcessor } from "@/components/Flow/Nodes/AssignVariable";
import { ConditionalProcessor } from "@/components/Flow/Nodes/Conditional";
import { useInputDialog } from "@/context/InputDialogContext";
import { useCollaboration } from "@/context/CollaborationContext";

export interface IExecutorState {
    isRunning: boolean;
    isPaused: boolean;
    currentNode: Node | null;
}

export interface IExecutorActions {
    getIsRunning(): boolean;
    start(): void;
    stop(): void;
    pause(): void;
    resume(): void;
    reset(): void;
    stepBackward(): void;
    stepForward(): void;
    clearOutputNodes(): void;
    clearErrorIndicators(): void;
}

export interface IExecutor extends IExecutorState, IExecutorActions {}

function getNodeProcessor(reactFlow: ReactFlowInstance, valuedVariables: ValuedVariable<VariableType>[], node: FlowNode, showInputDialog: (title: string, variableType: 'string' | 'integer' | 'float' | 'boolean', description?: string, placeholder?: string) => Promise<string | null>, getNodeVariables: any): NodeProcessor | null {
    switch (node.type) {
        case "DeclareVariable":
            return new DeclareVariableProcessor(reactFlow, node.id, valuedVariables, getNodeVariables);
        case "AssignVariable":
            return new AssignVariableProcessor(reactFlow, node.id, valuedVariables, node.data.expression);
        case "Conditional":
            return new ConditionalProcessor(reactFlow, node.id);
        case "Input":
            return new InputProcessor(reactFlow, node.id, showInputDialog);
        case "Output":
            return new OutputProcessor(reactFlow, node.id);
        default:
            return null;
    }
}

export function useFlowExecutor(): { state: IExecutorState, actions: IExecutorActions } {
    const reactFlow = useReactFlow();
    const { settings } = useSystemSettings();
    const { addExecutionStep, updateVariables, startRecording, stopRecording } = useDebugger();
    const { showInputDialog } = useInputDialog();
    const { getNodeVariables } = useVariables();
    const { awareness, users } = useCollaboration();

    // Local state for UI purposes (only used by host)
    const [isRunningState, setIsRunningState] = useState(false);
    const [isPausedState, setIsPausedState] = useState(false);
    const [currentNode, setCurrentNode] = useState<Node | null>(null);
    
    // Shared state from host (only used by non-hosts)
    const [sharedIsRunning, setSharedIsRunning] = useState(false);
    const [sharedIsPaused, setSharedIsPaused] = useState(false);
    const sharedIsPausedRef = useRef(false);
    
    // Use refs for immediate access in callbacks
    const isRunningRef = useRef(false);
    const isPausedRef = useRef(false);
    const currentNodeRef = useRef<Node | null>(null);
    const executingHostRef = useRef<number | null>(null); // Track the host who started execution

    // Get execution speed from settings
    const executionSpeedRef = useRef(settings.executionSpeed);
    
    // Update execution speed ref when settings change
    executionSpeedRef.current = settings.executionSpeed;

    const remainingTimeRef = useRef(0); // track remaining time for the current edge to reach the next node
    const lastResumingTimeRef = useRef(0); // track last time the execution was resumed
    const pauseCounterRef = useRef(0); // track the number of pauses in the same edge
    const executionCounterRef = useRef(0); // track the number of execution to avoid unexpected future jumps if restarting (stop and start again before timeout finishes)

    // Check if current user is host
    const hostUser = users.length > 0 ? users.reduce((prev, curr) => (prev.joinedAt <= curr.joinedAt ? prev : curr)) : null;
    const isHost = hostUser?.clientID === awareness?.clientID;

    // Share execution state through awareness when host
    useEffect(() => {
        if (isHost && awareness) {
            awareness.setLocalStateField('executionState', {
                isRunning: isRunningState,
                isPaused: isPausedState
            });
            
            // Track the executing host when execution starts
            if (isRunningState && !executingHostRef.current) {
                executingHostRef.current = awareness.clientID;
            }
            
            // Clear executing host when execution stops
            if (!isRunningState && executingHostRef.current === awareness.clientID) {
                executingHostRef.current = null;
            }
        }
    }, [isHost, awareness, isRunningState, isPausedState]);

    // Read execution state from awareness when not host
    // TODO: awareness or doc?
    useEffect(() => {
        if (!isHost && awareness) {
            const onChange = () => {
                if (!isHost) { // only non-hosts need to read the host's state
                    const states = Array.from(awareness.getStates().entries()) as [number, any][];
                    const hostState = states.find(([clientID]) => clientID === hostUser?.clientID);
                    
                    if (hostState) {
                        const executionState = hostState[1].executionState;
                        if (executionState) {
                            setSharedIsRunning(executionState.isRunning);
                            setSharedIsPaused(executionState.isPaused);
                            sharedIsPausedRef.current = executionState.isPaused;
                            
                            // Track the executing host for cleanup purposes
                            if (executionState.isRunning && !executingHostRef.current) {
                                executingHostRef.current = hostUser?.clientID || null;
                            }
                            
                            // Clear executing host when execution stops
                            if (!executionState.isRunning && executingHostRef.current === hostUser?.clientID) {
                                executingHostRef.current = null;
                            }
                        }
                    }
                }
            };

            awareness.on('change', onChange);
            onChange(); // Initial read

            return () => {
                awareness.off('change', onChange);
            };
        }
    }, [isHost, awareness, hostUser?.clientID]);

    // Clean up execution state when executing host leaves
    useEffect(() => {
        if (!awareness) return;

        const onExecutionHostLeave = (changes: { added: number[]; updated: number[]; removed: number[] }) => {
            // Only check for removed users
            if (changes.removed.length === 0) return;

            // Check if the executing host was among the removed users
            const wasExecutingHostRemoved = executingHostRef.current && changes.removed.includes(executingHostRef.current);
            
            if (wasExecutingHostRemoved && (sharedIsRunning || sharedIsPaused || isRunningState || isPausedState)) {
                console.log('[FlowExecutor] Host left during execution, cleaning up...');
                
                // Reset shared execution state
                setSharedIsRunning(false);
                setSharedIsPaused(false);
                sharedIsPausedRef.current = false;
                
                // Reset local execution state
                setIsRunningState(false);
                isRunningRef.current = false;
                setIsPausedState(false);
                isPausedRef.current = false;
                
                // Clean up animations and unlock flow
                resetAllAnimations(reactFlow);
                toggleLockFlow(reactFlow, false);
                
                // Stop any ongoing SVG animations
                const svgElements = document.querySelectorAll('svg[id^="edge-animation-"]');
                svgElements.forEach(svg => {
                    const svgElement = svg as SVGSVGElement;
                    svgElement.pauseAnimations();
                });
                
                // Reset current node
                setCurrentNode(null);
                currentNodeRef.current = null;
                
                // Reset execution tracking refs
                pauseCounterRef.current = 0;
                remainingTimeRef.current = 0;
                lastResumingTimeRef.current = 0;
                executingHostRef.current = null;
                
                // Stop debugger recording if it was active
                stopRecording();
            }
        };

        awareness.on('change', onExecutionHostLeave);

        return () => {
            awareness.off('change', onExecutionHostLeave);
        };
    }, [awareness, sharedIsRunning, sharedIsPaused, isRunningState, isPausedState, reactFlow, stopRecording]);

    // Pause/Resume SVG animations for collaborators based on host's state
    useEffect(() => {
        if (!isHost) {
            const svgElements = document.querySelectorAll('svg[id^="edge-animation-"]');
            
            if (sharedIsPaused) {
                svgElements.forEach(svg => {
                    const svgElement = svg as SVGSVGElement;
                    const currentTimeInMs = svgElement.getCurrentTime() * 1000;
                    
                    if (currentTimeInMs <= 100) {
                        setTimeout(() => {
                            if (sharedIsPausedRef.current) {
                                svgElement.pauseAnimations();
                            }
                        }, 100 - currentTimeInMs);
                    } else {
                        svgElement.pauseAnimations();
                    }
                });
            } else {
                svgElements.forEach(svg => {
                    const svgElement = svg as SVGSVGElement;
                    svgElement.unpauseAnimations();
                });
            }
        }
    }, [isHost, sharedIsPaused]);

    // Helper to get the effective running/paused state
    const getEffectiveState = useCallback(() => {
        if (isHost) {
            return { isRunning: isRunningState, isPaused: isPausedState };
        } else {
            return { isRunning: sharedIsRunning, isPaused: sharedIsPaused };
        }
    }, [isHost, isRunningState, isPausedState, sharedIsRunning, sharedIsPaused]);
    
    const getIsRunning = useCallback(() => {
        return isRunningRef.current;
    }, []);

    const clearErrorIndicators = useCallback(() => {
        reactFlow.setNodes(nodes =>
            nodes
                .filter(n => n.type !== 'ErrorNode')
                .map(n => {
                    if (n.data.isError) {
                        const { isError, ...restData } = n.data;
                        return { ...n, data: restData };
                    }
                    return n;
                })
        );
    }, [reactFlow]);

    const clearOutputNodes = useCallback(() => {
        reactFlow.setNodes(nodes => nodes.filter(n => n.type !== 'ValueOutput'));
    }, [reactFlow]);

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
        
        // Stop debugger recording
        stopRecording();
    }, [reactFlow, stopRecording]);

    const processNode = useCallback(async (node: Node): Promise<{ targetNodeId: string | null, valuedVariables: ValuedVariable<VariableType>[] }> => {
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

        // Track execution step for debugger
        addExecutionStep(node);

        // Process the node using its processor if available
        let valuedVariables: ValuedVariable<VariableType>[] = [];
        let processorResult: any = null;
        
        if (node.data) {
            try {
                // Retrieve existing valued variables from node data, ensuring it's an array of IValuedVariable objects
                const existingValuedVariables: IValuedVariable<VariableType>[] = Array.isArray(node.data.currentValuedVariables)
                    ? node.data.currentValuedVariables
                    : [];
                
                // Convert existing plain objects to ValuedVariable instances for the processor
                const existingValuedVariableInstances = existingValuedVariables.map(v => ValuedVariable.fromObject(v));

                // TODO: in processors, directly use this existingValuedVariableInstances instead of the node.data.currentValuedVariables? (optimization)
                
                const processor = getNodeProcessor(reactFlow, existingValuedVariableInstances, node as FlowNode, showInputDialog, getNodeVariables);
                if (processor) {
                    processorResult = await processor.process();

                    if (node.type === "Conditional") {
                        // For condition nodes, extract the valuedVariables
                        if (processorResult && typeof processorResult === 'object' && 'valuedVariables' in processorResult) {
                            valuedVariables = processorResult.valuedVariables;
                        }
                    } else if (Array.isArray(processorResult)) {
                        // For other nodes, use the array result directly (currentValuedVariables)
                        valuedVariables = processorResult;
                    }
                    
                    // Track variable changes for debugger
                    if (valuedVariables.length > 0) {
                        if (node.type === "DeclareVariable" || node.type === "AssignVariable" || node.type === "Input") {
                            updateVariables(node, valuedVariables);
                        }
                    }
                }
            } catch (error) {
                console.error(`Error processing node ${node.id}:`, error);
                
                // Stop execution
                stopExecution();

                // Highlight node in red
                reactFlow.updateNodeData(node.id, { isError: true });

                // Add error node
                const errorNode: Node = {
                    id: `error-${node.id}-${Date.now()}`,
                    type: 'ErrorNode',
                    position: { x: node.position.x + (node.measured?.width ?? node.width ?? 150) + 20, y: node.position.y },
                    data: {
                        visualId: node.data.visualId,
                        errorMessage: (error as Error).message,
                    },
                };
                reactFlow.addNodes(errorNode);
                
                return { targetNodeId: null, valuedVariables: [] };
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
            // (should be already fixed)
            
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
    }, [reactFlow, addExecutionStep, updateVariables, showInputDialog, getNodeVariables]);

    const start = useCallback(() => {
        const startNode = findStartNode(reactFlow.getNodes());
        
        if (!startNode) {
            throw new Error("No start node found"); // TODO: handle this
        }

        // Clear previous output nodes from the diagram before starting a new run.
        clearOutputNodes();
        clearErrorIndicators();

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

        // Start debugger recording
        startRecording();

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
    }, [reactFlow, processNode, stopExecution, startRecording, clearOutputNodes, clearErrorIndicators]);

    const stop = useCallback(() => {
        if (!isRunningRef.current) {
            return;
        }

        stopExecution();
        clearErrorIndicators();
        clearOutputNodes();
    }, [stopExecution, clearErrorIndicators, clearOutputNodes]);

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
        
    }, []);

    const reset = useCallback(() => {
        stopExecution();
        setTimeout(() => {
            start();
        }, 100);
    }, [stopExecution, start]);

    const stepBackward = useCallback(() => {
        
    }, []);

    const stepForward = useCallback(() => {
        
    }, []);

    const state = {
        isRunning: getEffectiveState().isRunning,
        isPaused: getEffectiveState().isPaused,
        currentNode: currentNode
    };

    const actions = useMemo(() => ({
        getIsRunning,
        start,
        stop,
        pause,
        resume,
        reset,
        stepBackward,
        stepForward,
        clearOutputNodes,
        clearErrorIndicators
    }), [getIsRunning, start, stop, pause, resume, reset, stepBackward, stepForward, clearOutputNodes, clearErrorIndicators]);
    
    return {
        state,
        actions
    };
}
