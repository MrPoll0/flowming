import { useState, useEffect } from 'react';
import { useNodes, useEdges, Edge } from '@xyflow/react';
import { generatePythonCode } from '../../../utils/codeGeneration';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { atomOneDark } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import { FlowNode } from '../../../components/Flow/FlowTypes';
import { AlertTriangle, FileText, Sparkles, Copy, Download } from 'lucide-react';
import { useFilename } from '../../../context/FilenameContext';

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

const CodeTab = () => {
    const nodes = useNodes<FlowNode>();
    const edges = useEdges();
    const [generatedCode, setGeneratedCode] = useState('// Diagram not loaded or empty.');
    const [error, setError] = useState<string | null>(null);
    const [_hoveredBlockId, setHoveredBlockId] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [selectedLanguage, setSelectedLanguage] = useState('python');
    const { filename } = useFilename();

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
    const lineCount = codeLines.length;
    
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

    const copyToClipboard = async () => {
        try {
            await navigator.clipboard.writeText(generatedCode);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy code:', err);
        }
    };

    const downloadCode = () => {
        const blob = new Blob([generatedCode], { type: 'text/python' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}_flowming.py`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="h-full flex flex-col bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40 dark:from-slate-900 dark:via-slate-800/50 dark:to-slate-900">
            <div className="h-full flex flex-col space-y-4">
                {/* Error Alert */}
                {error && (
                    <div className="relative m-4">
                        <div className="absolute inset-0 bg-gradient-to-r from-red-500/10 to-orange-500/10 rounded-xl blur-sm"></div>
                        <Alert variant="destructive" className="relative bg-red-50/80 dark:bg-red-900/20 backdrop-blur-sm border-red-200 dark:border-red-800 shadow-lg">
                            <AlertTriangle className="h-5 w-5" />
                            <AlertDescription className="whitespace-pre-wrap text-red-800 dark:text-red-200 font-medium">
                                {error}
                            </AlertDescription>
                        </Alert>
                    </div>
                )}
                
                {/* Code Display Card - Full Width and Height */}
                <div className="relative flex-1">
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-none blur-xl opacity-20"></div>
                    <Card className="relative h-full w-full bg-slate-900/95 dark:bg-slate-900/98 backdrop-blur-sm border-slate-700/50 shadow-2xl overflow-hidden flex flex-col rounded-none border-0">
                        <CardHeader className="pb-3 bg-gradient-to-r from-slate-800/50 to-slate-700/50 border-b border-slate-700/50 flex-shrink-0">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-4">
                                    <div>
                                        <div className="flex items-center space-x-3 mb-2">
                                            <span className="text-sm font-medium text-slate-300">Language:</span>
                                            <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                                                <SelectTrigger className="w-32 h-8 bg-slate-700/50 border-slate-600 text-slate-200 text-sm">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent className="bg-slate-800 border-slate-700">
                                                    <SelectItem value="python" className="text-slate-200 focus:bg-slate-700 focus:text-white">
                                                        Python
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                                <FileText className="h-3 w-3 mr-1" />
                                                {lineCount} lines
                                            </Badge>
                                            {nodes.length > 0 && (
                                                <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                                                    <Sparkles className="h-3 w-3 mr-1" />
                                                    {nodes.length} blocks
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="flex items-center space-x-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={copyToClipboard}
                                        className="bg-slate-700/50 hover:bg-slate-600/50 border-slate-600 text-slate-200 hover:text-white shadow-sm"
                                    >
                                        <Copy className="h-4 w-4 mr-2" />
                                        {copied ? 'Copied!' : 'Copy'}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={downloadCode}
                                        className="bg-slate-700/50 hover:bg-slate-600/50 border-slate-600 text-slate-200 hover:text-white shadow-sm"
                                    >
                                        <Download className="h-4 w-4 mr-2" />
                                        Download
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0 flex-1 overflow-hidden">
                            <div className="code-container relative h-full">
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
                                            borderRadius: '4px',
                                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
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
                                    customStyle={{ 
                                        borderRadius: '0', 
                                        margin: 0, 
                                        fontSize: '0.875rem',
                                        background: 'transparent',
                                        padding: '1.5rem',
                                        height: '100%',
                                        overflow: 'auto'
                                    }}
                                >
                                    {generatedCode}
                                </SyntaxHighlighter>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
            
            {/* Enhanced hover styles for code blocks */}
            <style>{`
                .code-container {
                    position: relative;
                    background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
                    height: 100%;
                }
                
                /* Enhanced hover effect for code lines */
                .code-container span[style*="cursor: pointer"]:hover {
                    background: linear-gradient(90deg, 
                        rgba(59, 130, 246, 0.08) 0%, 
                        rgba(147, 51, 234, 0.06) 50%, 
                        rgba(59, 130, 246, 0.08) 100%
                    ) !important;
                    border: 1px solid rgba(59, 130, 246, 0.2) !important;
                    box-shadow: 
                        0 0 0 1px rgba(59, 130, 246, 0.1),
                        0 4px 12px rgba(59, 130, 246, 0.05) !important;
                    transform: translateX(2px);
                }
                
                /* Glowing selection indicator */
                .code-container span[style*="cursor: pointer"]:hover::before {
                    content: '';
                    position: absolute;
                    left: -4px;
                    top: 0;
                    bottom: 0;
                    width: 3px;
                    background: linear-gradient(to bottom, 
                        rgba(59, 130, 246, 0.8), 
                        rgba(147, 51, 234, 0.6),
                        rgba(59, 130, 246, 0.8)
                    );
                    border-radius: 2px;
                    box-shadow: 0 0 8px rgba(59, 130, 246, 0.4);
                }
                
                /* Subtle animation for the gradient backgrounds */
                @keyframes subtle-pulse {
                    0%, 100% { opacity: 0.8; }
                    50% { opacity: 1; }
                }
                
                .code-container::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    height: 2px;
                    background: linear-gradient(90deg, 
                        transparent 0%, 
                        rgba(59, 130, 246, 0.5) 50%, 
                        transparent 100%
                    );
                    animation: subtle-pulse 3s ease-in-out infinite;
                }
            `}</style>
        </div>
    );
};

export default CodeTab;
