import { useFlowExecutorContext } from "../context/FlowExecutorContext";

export default function ExecutionControl() {
    const {start, stop, pause, resume, reset, stepBackward, stepForward, isRunning, isPaused, currentNode} = useFlowExecutorContext();

    return (
        <div className="bottom-content">
            <button onClick={start} disabled={isRunning}>Start</button>
            <button onClick={stop} disabled={!isRunning}>Stop</button>
            <button onClick={pause} disabled={!isRunning || isPaused}>Pause</button>
            <button onClick={resume} disabled={!isPaused || !isRunning}>Resume</button>
            <button onClick={reset} disabled={isRunning}>Reset</button>
            <button onClick={stepBackward} disabled={!isRunning || !isPaused}>Step Backward</button>
            <button onClick={stepForward} disabled={!isRunning || !isPaused}>Step Forward</button>

            <div>Current Node: {currentNode?.id}</div>
        </div>
    );
}