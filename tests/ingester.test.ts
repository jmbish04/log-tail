/**
 * Tests for the ingestion logic
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ingestLog, batchIngestLogs, normalizeLogLevel } from '../src/lib/ingester';

describe('Log Ingestion', () => {
    describe('normalizeLogLevel', () => {
        it('should normalize WARNING to WARN', () => {
            expect(normalizeLogLevel('WARNING')).toBe('WARN');
        });

        it('should normalize FATAL to CRITICAL', () => {
            expect(normalizeLogLevel('FATAL')).toBe('CRITICAL');
        });

        it('should normalize TRACE to DEBUG', () => {
            expect(normalizeLogLevel('TRACE')).toBe('DEBUG');
        });

        it('should preserve standard levels', () => {
            expect(normalizeLogLevel('INFO')).toBe('INFO');
            expect(normalizeLogLevel('ERROR')).toBe('ERROR');
            expect(normalizeLogLevel('WARN')).toBe('WARN');
        });

        it('should handle lowercase input', () => {
            expect(normalizeLogLevel('info')).toBe('INFO');
            expect(normalizeLogLevel('error')).toBe('ERROR');
        });
    });

    // Note: Actual ingestion tests would require mocking D1 and R2
    // For now, these are examples of how tests would be structured
    describe('ingestLog', () => {
        it('should validate required fields', async () => {
            // This would use a mocked environment
            // expect(() => ingestLog({} as any, env, ctx)).toThrow();
        });
    });
});
