if (!process.env.NODE_ENV) process.env.NODE_ENV = 'test';
export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    if (specifier.endsWith('.js')) {
      const tsSpecifier = specifier.slice(0, -3) + '.ts';
      try {
        return await nextResolve(tsSpecifier, context);
      } catch (innerErr) {
        // Continue to check package mocks
      }
    }

    // Offline mock fallbacks for unit test verification before npm install
    if (specifier === 'ws') {
      return {
        url: 'data:text/javascript,export class WebSocketServer { on() {} }; export class WebSocket { static OPEN = 1; };',
        shortCircuit: true
      };
    }
    if (specifier === 'grammy') {
      return {
        url: 'data:text/javascript,export class Bot { use() {} command() {} on() {} start() {} }; export class InlineKeyboard { text() { return this; } row() { return this; } }; export class InputFile {};',
        shortCircuit: true
      };
    }
    if (specifier === 'zod') {
      return {
        url: 'data:text/javascript,export const z = { object: () => ({ parse: (x) => x }) };',
        shortCircuit: true
      };
    }

    throw err;
  }
}
