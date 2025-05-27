import { useFlowExecutorContext } from "../context/FlowExecutorContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Play, 
  Square, 
  Pause, 
  SkipBack, 
  SkipForward, 
  RotateCcw 
} from "lucide-react";

export default function ExecutionControl() {
    const {start, stop, pause, resume, reset, stepBackward, stepForward, isRunning, isPaused} = useFlowExecutorContext();

    return (
        <Card className="h-full">
            <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Execution Control</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                    <Button 
                        onClick={start} 
                        disabled={isRunning}
                        size="sm"
                        className="flex items-center gap-2"
                    >
                        <Play className="h-4 w-4" />
                        Start
                    </Button>
                    <Button 
                        onClick={stop} 
                        disabled={!isRunning}
                        variant="destructive"
                        size="sm"
                        className="flex items-center gap-2"
                    >
                        <Square className="h-4 w-4" />
                        Stop
                    </Button>
                    <Button 
                        onClick={pause} 
                        disabled={!isRunning || isPaused}
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2"
                    >
                        <Pause className="h-4 w-4" />
                        Pause
                    </Button>
                    <Button 
                        onClick={resume} 
                        disabled={!isPaused || !isRunning}
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2"
                    >
                        <Play className="h-4 w-4" />
                        Resume
                    </Button>
                    <Button 
                        onClick={stepBackward} 
                        disabled={!isRunning || !isPaused}
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2"
                    >
                        <SkipBack className="h-4 w-4" />
                        Step Back
                    </Button>
                    <Button 
                        onClick={stepForward} 
                        disabled={!isRunning || !isPaused}
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2"
                    >
                        <SkipForward className="h-4 w-4" />
                        Step Forward
                    </Button>
                    <Button 
                        onClick={reset} 
                        disabled={!isRunning}
                        variant="secondary"
                        size="sm"
                        className="flex items-center gap-2"
                    >
                        <RotateCcw className="h-4 w-4" />
                        Reset
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}