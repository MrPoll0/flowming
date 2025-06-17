import React from 'react';
import { Card } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';

interface ErrorNodeData {
  visualId: string;
  errorMessage: string;
}

const ErrorNode: React.FC<{ data: ErrorNodeData }> = ({ data }) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      <Card
        className="bg-red-50/95 border-red-400 shadow-lg"
        style={{
          minWidth: '200px',
          maxWidth: '300px',
          fontSize: '0.8rem',
        }}
      >
        <div className="p-3 space-y-2">
          <div className="font-semibold text-sm text-red-800 border-b border-red-200 pb-1 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Error in Node {data.visualId}
          </div>
          <div className="font-mono text-sm bg-background px-2 py-1 rounded text-center break-all">
            {String(data.errorMessage)}
          </div>
        </div>
      </Card>
    </motion.div>
  );
};

export default ErrorNode; 