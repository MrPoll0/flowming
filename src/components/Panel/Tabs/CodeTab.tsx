import { useState, useEffect } from 'react';
import { useNodes, useEdges, Edge } from '@xyflow/react';
import { generatePythonCode } from '../../../utils/codeGeneration';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { atomOneDark } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import { FlowNode } from '../../../components/Flow/FlowTypes'; // To ensure correct node type

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const CodeTab = () => {
    const nodes = useNodes<FlowNode>(); // Get reactive nodes state
    const edges = useEdges();         // Get reactive edges state
    const [generatedCode, setGeneratedCode] = useState('// Diagram not loaded or empty.');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // useNodes and useEdges return empty arrays initially if not ready, or if no nodes/edges
        if (nodes && edges) {
            try {
                setError(null);
                // Ensure nodes conform to FlowNode[] if necessary, though useNodes<FlowNode> should handle it
                const code = generatePythonCode(nodes, edges as Edge[]); // Cast edges if generatePythonCode expects specific Edge type
                setGeneratedCode(code || '// No code generated. Start building your diagram!');
            } catch (e: any) {
                console.error("Error generating code:", e);
                setError(`Error generating code: ${e.message}. Check console for details.`);
                setGeneratedCode('// Error occurred during code generation.');
            }
        } else {
            setGeneratedCode('// Waiting for diagram data...');
        }
    }, [nodes, edges]); // Re-run when nodes or edges change

    return (
        <div className="h-full flex flex-col">
            <div className="p-4 space-y-4">
                <h3 className="text-lg font-semibold">Generated Python Code</h3>
                
                {error && (
                    <Alert variant="destructive">
                        <AlertDescription className="whitespace-pre-wrap">
                            {error}
                        </AlertDescription>
                    </Alert>
                )}
                
                <Card className="flex-1">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base">Python Code Output</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <SyntaxHighlighter 
                            language="python" 
                            style={atomOneDark} 
                            showLineNumbers 
                            customStyle={{
                                borderRadius: '0 0 8px 8px', 
                                margin: 0,
                                fontSize: '0.875rem'
                            }}
                        >
                            {generatedCode}
                        </SyntaxHighlighter>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default CodeTab;
