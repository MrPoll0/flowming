import { useState, useEffect } from 'react';
import { useNodes, useEdges, Edge } from '@xyflow/react';
import { generatePythonCode } from '../../../utils/codeGeneration';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { atomOneDark } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import { FlowNode } from '../../../components/Flow/FlowTypes'; // To ensure correct node type

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const CodeTab = () => {
    const nodes = useNodes<FlowNode>();
    const edges = useEdges();
    const [generatedCode, setGeneratedCode] = useState('// Diagram not loaded or empty.');
    const [error, setError] = useState<string | null>(null);
    const [_hoveredBlockId, setHoveredBlockId] = useState<string | null>(null);

    useEffect(() => {
        if (nodes && edges) {
            try {
                setError(null);
                const code = generatePythonCode(nodes, edges as Edge[]);
                setGeneratedCode(code || '// No code generated. Start building your diagram!');
            } catch (e: any) {
                console.error("Error generating code:", e);
                setError(`Error generating code: ${e.message}. Check console for details.`);
                setGeneratedCode('// Error occurred during code generation.');
            }
        } else {
            setGeneratedCode('// Waiting for diagram data...');
        }
    }, [nodes, edges]);

    const codeLines = generatedCode.split('\n');
    const findVisualIdForLine = (lineIdx: number): string | null => {
        const currIndent = codeLines[lineIdx].match(/^\s*/)?.[0].length || 0;
        for (let i = lineIdx; i >= 0; i--) {
            const indent = codeLines[i].match(/^\s*/)?.[0].length || 0;
            const trimmed = codeLines[i].trim();
            const match = trimmed.match(/^# Block ID:\s*(B\d+)/);
            if (match && indent <= currIndent) {
                return match[1];
            }
        }
        return null;
    };

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
                        <div className="code-container">
                            <SyntaxHighlighter
                                language="python"
                                style={atomOneDark}
                                showLineNumbers
                                wrapLines
                                lineProps={(lineNumber) => {
                                    const idx = lineNumber - 1;
                                    const blockId = findVisualIdForLine(idx);
                                    if (!blockId) return {};
                                    const codeLine = codeLines[idx]?.trim() || '';
                                    const isCommentLine = codeLine.startsWith('# Block ID:');
                                    const style: React.CSSProperties = {
                                        position: 'relative',
                                        borderRadius: '2px',
                                        transition: 'all 0.15s ease',
                                        border: '1px solid transparent',
                                        margin: '1px 0',
                                        cursor: isCommentLine ? 'default' : 'pointer'
                                    };
                                    return {
                                        style,
                                        ...(!isCommentLine && {
                                            onMouseEnter: () => {
                                                setHoveredBlockId(blockId);
                                                window.dispatchEvent(new CustomEvent('highlightDiagramNode', { detail: { visualId: blockId } }));
                                            },
                                            onMouseLeave: () => {
                                                setHoveredBlockId(null);
                                                window.dispatchEvent(new CustomEvent('clearDiagramHighlight'));
                                            },
                                            onClick: () => {
                                                window.dispatchEvent(new CustomEvent('selectDiagramNode', { detail: { visualId: blockId } }));
                                            }
                                        })
                                    };
                                }}
                                customStyle={{ borderRadius: '0 0 8px 8px', margin: 0, fontSize: '0.875rem' }}
                            >
                                {generatedCode}
                            </SyntaxHighlighter>
                        </div>
                    </CardContent>
                </Card>
            </div>
            
            {/* Subtle hover styles for code blocks */}
            <style>{`
                .code-container {
                    position: relative;
                }
                
                /* Subtle hover effect for code lines */
                .code-container span[style*="cursor: pointer"]:hover {
                    background-color: rgba(255, 255, 255, 0.02) !important;
                    border: 1px solid rgba(255, 255, 255, 0.1) !important;
                    box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.15) !important;
                }
                
                /* Very subtle selection indicator */
                .code-container span[style*="cursor: pointer"]:hover::before {
                    content: '';
                    position: absolute;
                    left: -2px;
                    top: 0;
                    bottom: 0;
                    width: 2px;
                    background: linear-gradient(to bottom, 
                        rgba(59, 130, 246, 0.3), 
                        rgba(59, 130, 246, 0.1)
                    );
                    border-radius: 1px;
                }
            `}</style>
        </div>
    );
};

export default CodeTab;
