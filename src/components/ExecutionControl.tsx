import { useFlowExecutorState, useFlowExecutorActions } from "../context/FlowExecutorContext";
import { useCollaboration } from "../context/CollaborationContext";
import { useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Play, 
  Square, 
  Pause, 
  RotateCcw,
  Eraser
} from "lucide-react";

export default function ExecutionControl() {
    const { isRunning, isPaused } = useFlowExecutorState();
    const { start, stop, pause, resume, reset, clearOutputNodes } = useFlowExecutorActions();
    const { awareness, users } = useCollaboration();
    const hostUser = useMemo(() => {
        if (!users.length) return null;
        return users.reduce((prev, curr) => (prev.joinedAt <= curr.joinedAt ? prev : curr));
    }, [users]);
    const localClientID = awareness?.clientID;
    const isHost = hostUser?.clientID === localClientID;

    return (
        <Card className="h-full">
            <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Execution Control</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                    <Button 
                        onClick={start} 
                        disabled={!isHost || isRunning}
                        size="sm"
                        className="flex items-center gap-2"
                    >
                        <Play className="h-4 w-4" />
                        Start
                    </Button>
                    <Button 
                        onClick={stop} 
                        disabled={!isHost || !isRunning}
                        variant="destructive"
                        size="sm"
                        className="flex items-center gap-2"
                    >
                        <Square className="h-4 w-4" />
                        Stop
                    </Button>
                    <Button 
                        onClick={pause} 
                        disabled={!isHost || !isRunning || isPaused}
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2"
                    >
                        <Pause className="h-4 w-4" />
                        Pause
                    </Button>
                    <Button 
                        onClick={resume} 
                        disabled={!isHost || !isPaused || !isRunning}
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2"
                    >
                        <Play className="h-4 w-4" />
                        Resume
                    </Button>
                    <Button 
                        onClick={reset} 
                        disabled={!isHost || !isRunning}
                        variant="secondary"
                        size="sm"
                        className="flex items-center gap-2"
                    >
                        <RotateCcw className="h-4 w-4" />
                        Reset
                    </Button>
                    <Button 
                        onClick={clearOutputNodes} 
                        disabled={!isHost}
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2"
                    >
                        <Eraser className="h-4 w-4" />
                        Clear
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}