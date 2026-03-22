import { describe, expect, it } from 'vitest';
import { projectStockFromPoints } from './finance.js';
describe('projectStockFromPoints', () => {
    it('projects upward when the series trends upward', () => {
        const result = projectStockFromPoints([
            { value: 100 },
            { value: 102 },
            { value: 104 },
            { value: 106 },
            { value: 108 },
        ]);
        expect(result.projectedPrice).toBeGreaterThan(108);
        expect(result.projectedAbsoluteChange).toBeGreaterThan(0);
    });
    it('projects downward when the series trends downward', () => {
        const result = projectStockFromPoints([
            { value: 120 },
            { value: 118 },
            { value: 116 },
            { value: 114 },
            { value: 112 },
        ]);
        expect(result.projectedPrice).toBeLessThan(112);
        expect(result.projectedAbsoluteChange).toBeLessThan(0);
    });
});
