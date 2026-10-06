import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toVertexSchema, vertexEnabled } from '../netlify/lib/vertex.mjs';

test('toVertexSchema drops keywords Vertex rejects and keeps enums/required', () => {
  const s = toVertexSchema({
    type: 'object', additionalProperties: false, required: ['a'],
    properties: { a: { type: 'string' }, ids: { type: 'array', items: { type: 'string', enum: ['x', 'y'] } }, n: { type: 'object', additionalProperties: false, properties: {} } }
  });
  assert.equal('additionalProperties' in s, false);
  assert.equal('additionalProperties' in s.properties.n, false);
  assert.deepEqual(s.required, ['a']);
  assert.deepEqual(s.properties.ids.items.enum, ['x', 'y']);
});

test('vertexEnabled honours LLM_PROVIDER', () => {
  const prev = process.env.LLM_PROVIDER;
  process.env.LLM_PROVIDER = 'vertex'; assert.equal(vertexEnabled(), true);
  process.env.LLM_PROVIDER = 'claude'; assert.equal(vertexEnabled(), false);
  if (prev === undefined) delete process.env.LLM_PROVIDER; else process.env.LLM_PROVIDER = prev;
});
