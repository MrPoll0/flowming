import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useCollaboration } from "@/context/CollaborationContext";
import { FlowNode } from "@/components/Flow/FlowTypes";
import { Edge, useReactFlow } from "@xyflow/react";
import exercisesData from "@/data/exercises.json";
import { runFlowTest } from "@/utils/flowTestRunner";
import SolutionDialog from "@/components/SolutionDialog";

interface Exercise {
  id: string;
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";
  description: string;
  testCases?: Array<{
    input: string;
    expectedOutput: string;
  }>;
}

interface TestResult {
  passed: number;
  total: number;
  details: Array<{
    input: string;
    expected: string;
    actual: string;
    passed: boolean;
  }>;
}

const difficultyColor = (diff: Exercise["difficulty"]) => {
  switch (diff) {
    case "Easy":
      return "bg-green-100 text-green-800 border-green-200";
    case "Medium":
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
    case "Hard":
      return "bg-red-100 text-red-800 border-red-200";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
};

const ExercisesTab: React.FC = () => {
  const { ySharedNodes, ySharedEdges } = useCollaboration();
  const reactFlowInstance = useReactFlow<FlowNode, Edge>();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [solutionData, setSolutionData] = useState<{ nodes: FlowNode[]; edges: Edge[] } | null>(null);
  const [solveStatus, setSolveStatus] = useState<
    Record<string, { result: TestResult; evaluated: boolean }>
  >(() => {
    const stored = localStorage.getItem("exerciseSolveStatus");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // Validate the structure and clean up old format data
        const cleaned: Record<string, { result: TestResult; evaluated: boolean }> = {};
        Object.entries(parsed).forEach(([key, value]: [string, any]) => {
          if (value && typeof value === 'object' && value.result && value.evaluated !== undefined) {
            cleaned[key] = value;
          }
        });
        return cleaned;
      } catch {
        // Clear corrupted data
        localStorage.removeItem("exerciseSolveStatus");
        return {};
      }
    }
    return {};
  });
  const [isSolving, setIsSolving] = useState(false);

  const exercises = useMemo<Exercise[]>(() => exercisesData as Exercise[], []);
  const solutionModules = useMemo(() => import.meta.glob("/src/data/solutions/*.json"), []);

  useEffect(() => {
    localStorage.setItem("exerciseSolveStatus", JSON.stringify(solveStatus));
  }, [solveStatus]);

  const getCurrentDiagram = (): { nodes: FlowNode[]; edges: Edge[] } => {
    // Prioritize collaborative state if available and populated
    if (ySharedNodes && ySharedNodes.size > 0 && ySharedEdges) {
      const nodes = Array.from(ySharedNodes.values()) as FlowNode[];
      const edges = Array.from(ySharedEdges.values()) as Edge[];
      return { nodes, edges };
    }
    // Fallback to local React Flow state for single-user mode
    return {
      nodes: reactFlowInstance.getNodes(),
      edges: reactFlowInstance.getEdges(),
    };
  };

  const handleShowSolution = async (exerciseId: string) => {
    const path = `/src/data/solutions/${exerciseId}.json`;
    if (solutionModules[path]) {
      const module: any = await (solutionModules[path] as any)();
      setSolutionData(module.default || module);
    } else {
      console.error(`Solution file not found at ${path}`);
    }
  };

  const hasSolution = (exerciseId: string) => {
    const path = `/src/data/solutions/${exerciseId}.json`;
    return !!solutionModules[path];
  };

  const handleSolve = async (exercise: Exercise) => {
    if (!exercise.testCases || exercise.testCases.length === 0) return;
    setIsSolving(true);

    const { nodes, edges } = getCurrentDiagram();

    if (!nodes.some(n => n.type === "Start")) {
      const testResult: TestResult = {
        passed: 0,
        total: exercise.testCases.length,
        details: exercise.testCases.map(tc => ({
          input: tc.input,
          expected: tc.expectedOutput,
          actual: "Diagram missing Start node",
          passed: false,
        })),
      };
      setSolveStatus(prev => ({ ...prev, [exercise.id]: { result: testResult, evaluated: true } }));
      setIsSolving(false);
      return;
    }

    const details: TestResult["details"] = [];

    for (const tc of exercise.testCases) {
      try {
        const inputs = tc.input ? tc.input.split("\n") : [];
        const result = await runFlowTest(nodes, edges, inputs);
        const actualOutput = result.outputs.join("\n");
        const passed = actualOutput.trim() === tc.expectedOutput.trim();
        details.push({
          input: tc.input,
          expected: tc.expectedOutput,
          actual: actualOutput,
          passed,
        });
      } catch (err) {
        details.push({
          input: tc.input,
          expected: tc.expectedOutput,
          actual: `Error: ${(err as Error).message}`,
          passed: false,
        });
      }
    }

    const passedCount = details.filter((d) => d.passed).length;
    const testResult: TestResult = {
      passed: passedCount,
      total: exercise.testCases.length,
      details,
    };

    setSolveStatus((prev) => ({
      ...prev,
      [exercise.id]: { result: testResult, evaluated: true },
    }));
    setIsSolving(false);
  };

  if (selectedId) {
    const exercise = exercises.find((e) => e.id === selectedId)!;
    const status = solveStatus[exercise.id];
    
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => setSelectedId(null)}>
            ← Back to Exercises
          </Button>
        </div>
        
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl">{exercise.title}</CardTitle>
              <Badge variant="outline" className={`${difficultyColor(exercise.difficulty)} border`}>
                {exercise.difficulty}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <CardDescription className="text-sm leading-relaxed whitespace-pre-wrap">
              {exercise.description}
            </CardDescription>
            
            {exercise.testCases && exercise.testCases.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Button 
                    disabled={isSolving} 
                    onClick={() => handleSolve(exercise)}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {isSolving ? "Evaluating..." : "Test Solution"}
                  </Button>
                  
                  {status && status.evaluated && status.result && (
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant={status.result.passed === status.result.total ? "default" : "destructive"}
                        className="text-sm"
                      >
                        {status.result.passed}/{status.result.total} tests passed
                      </Badge>
                      {status.result.passed === status.result.total && (
                        <span className="text-green-600 font-medium text-sm">✓ All tests passed!</span>
                      )}
                    </div>
                  )}
                </div>

                {status && status.evaluated && status.result && status.result.total > 0 && (
                  <Card className="bg-gray-50">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Test Results</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {status.result.details.map((detail, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-xs">
                          <span className={`w-4 h-4 rounded-full flex items-center justify-center text-white text-xs ${
                            detail.passed ? 'bg-green-500' : 'bg-red-500'
                          }`}>
                            {detail.passed ? '✓' : '✗'}
                          </span>
                          <span className="font-mono">
                            Input: "{detail.input || '(empty)'}" → Expected: "{detail.expected}"
                          </span>
                          {!detail.passed && (
                            <span className="text-red-600 font-mono">
                              Got: "{detail.actual}"
                            </span>
                          )}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {hasSolution(exercise.id) && (
                  <div>
                    <Button variant="outline" onClick={() => handleShowSolution(exercise.id)}>
                      View Solution
                    </Button>
                  </div>
                )}
              </div>
            )}
            
            {!exercise.testCases && !hasSolution(exercise.id) && (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  💡 This exercise doesn't have automated testing or solution diagram available yet. 
                  Try implementing it yourself!
                </p>
              </div>
            )}

            {!exercise.testCases && hasSolution(exercise.id) && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">
                    💡 This exercise has a solution diagram available but no automated testing. 
                    Compare your solution with the provided one!
                  </p>
                </div>
            )}
          </CardContent>
        </Card>
        {solutionData && (
          <SolutionDialog
            open={!!solutionData}
            onOpenChange={(isOpen) => {
              if (!isOpen) setSolutionData(null);
            }}
            nodes={solutionData.nodes}
            edges={solutionData.edges}
            title={exercise.title}
          />
        )}
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h3 className="text-xl font-semibold mb-2">Programming Exercises</h3>
        <p className="text-sm text-muted-foreground">
          Practice your programming skills with these challenges. Create flowcharts and test your solutions!
        </p>
      </div>
      
      <div className="grid gap-4">
        {exercises.map((ex) => {
          const status = solveStatus[ex.id];
          const isFullySolved = status?.evaluated && status.result?.passed === status.result?.total && status.result?.total > 0;
          
          return (
            <Card key={ex.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedId(ex.id)}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="font-medium">{ex.title}</h4>
                      <Badge variant="outline" className={`${difficultyColor(ex.difficulty)} border text-xs`}>
                        {ex.difficulty}
                      </Badge>
                      {isFullySolved && (
                        <Badge variant="default" className="bg-green-600 text-xs">
                          ✓ Solved
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>Test Cases: {ex.testCases && ex.testCases.length>0 ? "Available" : "Not Available"}</span>
                      <span>Solution Diagram: {hasSolution(ex.id) ? "Available" : "Not Available"}</span>
                      {status?.evaluated && status.result && (
                        <span className={status.result.passed === status.result.total ? "text-green-600" : "text-red-600"}>
                          Tests: {status.result.passed}/{status.result.total}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <Button variant="ghost" size="sm" className="ml-4">
                    View →
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default React.memo(ExercisesTab);
