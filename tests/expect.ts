import assert from 'node:assert/strict';
export function expect(actual: unknown) {
  return {
    toBe: (expected: unknown) => assert.equal(actual, expected),
    toEqual: (expected: unknown) => assert.deepEqual(actual, expected),
    toHaveLength: (expected: number) => assert.equal((actual as unknown[]).length, expected),
    toBeGreaterThan: (expected: number) => assert.ok(Number(actual)>expected, `${actual} > ${expected}`),
    toBeGreaterThanOrEqual: (expected: number) => assert.ok(Number(actual)>=expected),
    toBeLessThanOrEqual: (expected: number) => assert.ok(Number(actual)<=expected),
    toThrow: () => assert.throws(actual as () => unknown),
    not: {toBe: (expected: unknown) => assert.notEqual(actual,expected)}
  };
}
