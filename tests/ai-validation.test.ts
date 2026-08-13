import assert from 'node:assert/strict';
import test from 'node:test';

process.env.GROQ_API_KEY = 'test-key-with-at-least-20-characters';
process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/test';

const aiModule = import('../src/routes/ai');

test('accepts bounded actions and removes unapproved task fields', async () => {
  const { sanitizeAiResponse } = await aiModule;
  const result = sanitizeAiResponse({
    actions: [{
      type: 'update',
      targetTitle: 'Relatório',
      task: { title: 'Relatório final', userId: 'attacker', completed: true },
      message: 'Atualizado',
    }],
    message: 'Pronto',
  });
  assert.deepEqual(result, {
    actions: [{
      type: 'update',
      targetTitle: 'Relatório',
      task: { title: 'Relatório final' },
      message: 'Atualizado',
    }],
    message: 'Pronto',
  });
});

test('rejects invalid columns, missing targets, and excessive actions', async () => {
  const { sanitizeAiResponse } = await aiModule;
  assert.equal(sanitizeAiResponse({
    actions: [{ type: 'move', targetTitle: 'Tarefa', targetColumn: 'admin' }],
    message: 'x',
  }), null);
  assert.equal(sanitizeAiResponse({
    actions: [{ type: 'delete' }],
    message: 'x',
  }), null);
  assert.equal(sanitizeAiResponse({
    actions: Array.from({ length: 11 }, () => ({ type: 'list' })),
    message: 'x',
  }), null);
});
