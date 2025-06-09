import { describe, it, expect } from 'vitest';

// This is a simplified version of the logic within CodeTab.tsx for testing purposes.
const createFindVisualIdForLine = (codeLines: string[]) => {
    return (lineIdx: number): string | null => {
        if (lineIdx < 0 || lineIdx >= codeLines.length) {
            return null;
        }
        const currIndent = codeLines[lineIdx]?.match(/^\s*/)?.[0].length ?? 0;
        for (let i = lineIdx; i >= 0; i--) {
            if (codeLines[i] === undefined) continue;
            const indent = codeLines[i].match(/^\s*/)?.[0].length ?? 0;
            const trimmed = codeLines[i].trim();
            const match = trimmed.match(/^# Block ID:\s*(B\d+)/);
            if (match && indent <= currIndent) {
                return match[1];
            }
        }
        return null;
    };
};

describe('CodeTab helper logic', () => {
    describe('findVisualIdForLine', () => {
        const sampleCode = [
            '# Block ID: B1',      // 0
            'if (x > 0):',         // 1
            '  # Block ID: B2',    // 2
            '  y = 1',             // 3
            '  if (z == 1):',      // 4
            '    # Block ID: B3',  // 5
            '    a = 1',           // 6
            'else:',               // 7
            '  # Block ID: B4',    // 8
            '  y = -1'             // 9
        ];
        const findVisualIdForLine = createFindVisualIdForLine(sampleCode);

        it('should find the correct ID for a top-level line', () => {
            expect(findVisualIdForLine(1)).toBe('B1');
        });

        it('should find the correct ID for a nested line', () => {
            expect(findVisualIdForLine(3)).toBe('B2');
        });

        it('should find the correct ID for a deeply nested line', () => {
            expect(findVisualIdForLine(6)).toBe('B3');
        });

        it('should find the correct ID for a line in an else block', () => {
            expect(findVisualIdForLine(9)).toBe('B4');
        });

        it('should return the ID from the line itself if it is a comment', () => {
            expect(findVisualIdForLine(2)).toBe('B2');
        });

        it('should return null if no ID is found upwards', () => {
            const codeWithoutIds = ['if (x > 0):', '  y = 1'];
            const findId = createFindVisualIdForLine(codeWithoutIds);
            expect(findId(1)).toBe(null);
        });

        it('should handle out-of-bounds index gracefully', () => {
            expect(findVisualIdForLine(99)).toBe(null);
            expect(findVisualIdForLine(-1)).toBe(null);
        });
    });
}); 