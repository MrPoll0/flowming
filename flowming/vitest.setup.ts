import * as nodeCrypto from 'node:crypto';

// Vitest runs in a Node.js environment where the Web Crypto API (global "crypto")
// might not be available (e.g. Node 18 on CI). Some parts of the codebase rely on
// the browser-style global 'crypto' with 'randomUUID()'. When it is missing we
// fall back to Node's built-in 'crypto' module which provides the same
// 'randomUUID' function.

if (typeof globalThis.crypto === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  globalThis.crypto = nodeCrypto as unknown as Crypto;
}

export {}; 