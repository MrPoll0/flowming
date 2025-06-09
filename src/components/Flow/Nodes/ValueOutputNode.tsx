import React from 'react';
import { Card } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { ScrollText } from 'lucide-react';

interface ValueOutputNodeData {
  value: any;
}

const ValueOutputNode: React.FC<{ data: ValueOutputNodeData }> = ({ data }) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      <Card
        className="bg-green-50/95 border-green-300 shadow-lg"
        style={{
          minWidth: '180px',
          maxWidth: '250px',
          fontSize: '0.8rem',
        }}
      >
        <div className="p-3 space-y-2">
          <div className="font-semibold text-sm text-green-800 border-b border-green-200 pb-1 flex items-center gap-2">
            <ScrollText className="h-4 w-4" />
            Output
          </div>
          <div className="font-mono text-sm bg-background px-2 py-1 rounded text-center break-all">
            {String(data.value)}
          </div>
        </div>
      </Card>
    </motion.div>
  );
};

export default ValueOutputNode; 