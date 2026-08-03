import test from "node:test";
import assert from 'node:assert/strict';

import {isTopicCode,
    normalizeCode, 
    sanitizeRecord,
} from "../api/progress.js";

test('normalizeCode accepts grouped sync codes', ()=> {
    const result = normalizeCode('A1B2-C3D4-E5F6-7890-A1B2-C3D4-E5F6-7890');

    assert.equal(result, 'a1b2c3d4e5f67890a1b2c3d4e5f67890');
});

test('normalizeCode rejects malformed codes', () => {
    assert.equal(normalizeCode('not-a-sync-code'), null);
    assert.equal(normalizeCode('g'.repeat(32)), null);
    assert.equal(normalizeCode('a'.repeat(31)), null);
});

test('sanitizeRecord keeps valid done entries', () => {
    const record = sanitizeRecord({
        done: {
            'MIND.01': true,
            'MIND.02': true,
        },
    });
});

test('isTopicCode only accepts real catalog codes', () => {
    assert.equal(isTopicCode('MIND.01'), true);
    assert.equal(isTopicCode('COMP.13'), true);

    assert.equal(isTopicCode('COMP.14'), false);
    assert.equal(isTopicCode('FAKE.01'), false);
    assert.equal(isTopicCode('MIND.1'), false);
})

test('sanitizeRecord remvoes made-up topic codes', () => {
    const record = sanitizeRecord({
        done: {
            'MIND.01': true,
            'FAKE.01': true,
        },
    });

    assert.deepEqual(record.done, {
        'MIND.01': 1,
    })
});

