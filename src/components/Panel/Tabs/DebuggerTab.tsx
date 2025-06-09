import React, { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDebugger } from '../../../context/DebuggerContext';
import { useFlowExecutorState } from '../../../context/FlowExecutorContext';
import { Clock, Variable, Play, Pause, Square, Bug, Monitor } from 'lucide-react';

const DebuggerTab = () => {
    const { 
        executionHistory, 
        variableHistories, 
        currentVariables, 
        outputHistory,
        isRecording 
    } = useDebugger();
    const { isRunning, isPaused, isPausedByBreakpoint } = useFlowExecutorState();

    const [activeTab, setActiveTab] = useState("variables");

    const formatTimestamp = (timestamp: number): string => {
        return new Date(timestamp).toLocaleTimeString();
    };

    const getStatusIcon = () => {
        if (isPausedByBreakpoint) {
            return <Bug className="h-4 w-4 text-red-500" />;
        } else if (isRunning && !isPaused) {
            return <Play className="h-4 w-4 text-green-500" />;
        } else if (isPaused) {
            return <Pause className="h-4 w-4 text-yellow-500" />;
        } else {
            return <Square className="h-4 w-4 text-gray-500" />;
        }
    };

    const getStatusText = () => {
        if (isPausedByBreakpoint) {
            return "Breakpoint";
        } else if (isRunning && !isPaused) {
            return "Running";
        } else if (isPaused) {
            return "Paused";
        } else {
            return "Stopped";
        }
    };

    return (
        <div className="h-full flex flex-col">
            {/* Status header */}
            <div className="p-4 border-b bg-muted/20">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Debugger</h3>
                    <div className="flex items-center gap-2">
                        {getStatusIcon()}
                        <span className="text-sm font-medium">{getStatusText()}</span>
                        {isRecording && (
                            <Badge variant="secondary" className="ml-2">
                                Recording
                            </Badge>
                        )}
                    </div>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
                <TabsList className="grid w-full grid-cols-3 mx-4 mt-4">
                    <TabsTrigger value="variables" className="flex items-center gap-2">
                        <Variable className="h-4 w-4" />
                        Variables
                    </TabsTrigger>
                    <TabsTrigger value="execution" className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Execution Chain
                    </TabsTrigger>
                    <TabsTrigger value="output" className="flex items-center gap-2">
                        <Monitor className="h-4 w-4" />
                        Global Output
                    </TabsTrigger>
                </TabsList>

                <div className="flex-1 overflow-hidden">
                    <TabsContent value="variables" className="h-full m-0 p-4 overflow-y-auto">
                        {currentVariables.size === 0 ? (
                            <Card>
                                <CardContent className="p-6 text-center text-muted-foreground">
                                    {isRecording ? (
                                        "No variables declared yet. Run the flow to see variable values."
                                    ) : (
                                        "No execution data available. Start the flow to begin debugging."
                                    )}
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="space-y-2">
                                <Accordion type="multiple" className="space-y-2">
                                    {Array.from(currentVariables.entries()).map(([variableId, variable]) => {
                                        const history = variableHistories.get(variableId);
                                        
                                        return (
                                            <AccordionItem key={variableId} value={variableId} className="border rounded-lg">
                                                <AccordionTrigger className="px-4 py-3 hover:no-underline">
                                                    <div className="flex items-center justify-between w-full mr-4">
                                                        <div className="flex items-center gap-3">
                                                            <Badge variant="outline" className="text-xs">
                                                                {variable.type}
                                                            </Badge>
                                                            <span className="font-medium">
                                                                {variable.name}:
                                                            </span>
                                                            <span className="font-mono text-sm bg-muted px-2 py-1 rounded">
                                                                {variable.value}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </AccordionTrigger>
                                                
                                                <AccordionContent className="px-4 pb-4">
                                                    <div className="space-y-2">
                                                        <h4 className="text-sm font-medium text-muted-foreground mb-3">
                                                            Variable History (newest to oldest)
                                                        </h4>
                                                        
                                                        {history && history.changes.length > 0 ? (
                                                            <div className="space-y-2">
                                                                {history.changes
                                                                    .slice()
                                                                    .reverse()
                                                                    .map((change, index) => (
                                                                        <div
                                                                            key={`${change.stepNumber}-${index}`}
                                                                            className="flex items-center justify-between p-3 bg-muted/30 rounded-md"
                                                                        >
                                                                            <div className="flex items-center gap-3">
                                                                                <Badge variant="secondary" className="text-xs">
                                                                                    #{change.stepNumber}
                                                                                </Badge>
                                                                                <span className="text-sm font-medium">
                                                                                    {change.nodeVisualId}
                                                                                </span>
                                                                                <span className="text-sm text-muted-foreground">
                                                                                    →
                                                                                </span>
                                                                                <span className="font-mono text-sm bg-background px-2 py-1 rounded">
                                                                                    {change.value}
                                                                                </span>
                                                                            </div>
                                                                            <span className="text-xs text-muted-foreground">
                                                                                {formatTimestamp(change.timestamp)}
                                                                            </span>
                                                                        </div>
                                                                    ))}
                                                            </div>
                                                        ) : (
                                                            <div className="text-sm text-muted-foreground italic">
                                                                No changes recorded for this variable.
                                                            </div>
                                                        )}
                                                    </div>
                                                </AccordionContent>
                                            </AccordionItem>
                                        );
                                    })}
                                </Accordion>
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="execution" className="h-full m-0 p-4 overflow-y-auto">
                        {executionHistory.length === 0 ? (
                            <Card>
                                <CardContent className="p-6 text-center text-muted-foreground">
                                    {isRecording ? (
                                        "No execution steps recorded yet. The execution chain will appear here as the flow runs."
                                    ) : (
                                        "No execution data available. Start the flow to see the execution chain."
                                    )}
                                </CardContent>
                            </Card>
                        ) : (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg">Execution Chain</CardTitle>
                                    <div className="text-sm text-muted-foreground">
                                        {executionHistory.length} step{executionHistory.length !== 1 ? 's' : ''} executed
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-3">
                                        {executionHistory
                                            .slice()
                                            .reverse()
                                            .map((step, index) => (
                                                <div key={step.stepNumber} className="flex items-center gap-3">
                                                    <Badge variant="outline" className="w-12 justify-center">
                                                        #{step.stepNumber}
                                                    </Badge>
                                                    
                                                    <div className="flex items-center gap-2 flex-1">
                                                        <span className="font-medium">
                                                            {step.visualId}
                                                        </span>
                                                        <span className="text-muted-foreground">
                                                            ({step.nodeLabel})
                                                        </span>
                                                        <Badge variant="secondary" className="text-xs ml-auto">
                                                            {step.nodeType}
                                                        </Badge>
                                                    </div>
                                                    
                                                    {index < executionHistory.length - 1 && (
                                                        <span className="text-muted-foreground text-sm">→</span>
                                                    )}
                                                </div>
                                            ))}
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </TabsContent>

                    <TabsContent value="output" className="h-full m-0 p-4 overflow-y-auto">
                        {outputHistory.length === 0 ? (
                            <Card>
                                <CardContent className="p-6 text-center text-muted-foreground">
                                    {isRecording ? (
                                        "No outputs generated yet. Run the flow and process output nodes to see results here."
                                    ) : (
                                        "No execution data available. Start the flow to see output results."
                                    )}
                                </CardContent>
                            </Card>
                        ) : (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg">Global Output</CardTitle>
                                    <div className="text-sm text-muted-foreground">
                                        {outputHistory.length} output{outputHistory.length !== 1 ? 's' : ''} generated
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-3">
                                        {outputHistory.map((output, index) => (
                                            <div key={`${output.stepNumber}-${output.nodeId}-${index}`} className="p-4 bg-muted/30 rounded-lg">
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex items-center gap-3">
                                                        <Badge variant="outline" className="text-xs">
                                                            #{output.stepNumber}
                                                        </Badge>
                                                        <span className="font-medium text-sm">
                                                            {output.visualId}
                                                        </span>
                                                    </div>
                                                    <span className="text-xs text-muted-foreground">
                                                        {formatTimestamp(output.timestamp)}
                                                    </span>
                                                </div>
                                                <div className="mt-3">
                                                    <div className="font-mono text-sm bg-background px-3 py-2 rounded border">
                                                        {String(output.value)}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </TabsContent>
                </div>
            </Tabs>
        </div>
    );
};

export default React.memo(DebuggerTab);
