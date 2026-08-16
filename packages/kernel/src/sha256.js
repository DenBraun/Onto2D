const INITIAL_STATE = Object.freeze([
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
  0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
]);

const ROUND_CONSTANTS = Object.freeze([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
  0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
  0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
  0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
  0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
  0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
]);

function rotateRight(value, amount) {
  return ((value >>> amount) | (value << (32 - amount))) >>> 0;
}

function processBlock(block, state, words) {
  const view = new DataView(block.buffer, block.byteOffset, 64);
  for (let index = 0; index < 16; index += 1) {
    words[index] = view.getUint32(index * 4, false);
  }
  for (let index = 16; index < 64; index += 1) {
    const left = words[index - 15];
    const right = words[index - 2];
    const sigmaZero = rotateRight(left, 7) ^ rotateRight(left, 18) ^ (left >>> 3);
    const sigmaOne = rotateRight(right, 17) ^ rotateRight(right, 19) ^ (right >>> 10);
    words[index] = (
      words[index - 16]
      + sigmaZero
      + words[index - 7]
      + sigmaOne
    ) >>> 0;
  }

  let a = state[0];
  let b = state[1];
  let c = state[2];
  let d = state[3];
  let e = state[4];
  let f = state[5];
  let g = state[6];
  let h = state[7];

  for (let index = 0; index < 64; index += 1) {
    const sumOne = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
    const choice = (e & f) ^ (~e & g);
    const temporaryOne = (h + sumOne + choice + ROUND_CONSTANTS[index] + words[index]) >>> 0;
    const sumZero = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
    const majority = (a & b) ^ (a & c) ^ (b & c);
    const temporaryTwo = (sumZero + majority) >>> 0;
    h = g;
    g = f;
    f = e;
    e = (d + temporaryOne) >>> 0;
    d = c;
    c = b;
    b = a;
    a = (temporaryOne + temporaryTwo) >>> 0;
  }

  state[0] = (state[0] + a) >>> 0;
  state[1] = (state[1] + b) >>> 0;
  state[2] = (state[2] + c) >>> 0;
  state[3] = (state[3] + d) >>> 0;
  state[4] = (state[4] + e) >>> 0;
  state[5] = (state[5] + f) >>> 0;
  state[6] = (state[6] + g) >>> 0;
  state[7] = (state[7] + h) >>> 0;
}

export function sha256Hex(chunks) {
  const state = Uint32Array.from(INITIAL_STATE);
  const words = new Uint32Array(64);
  const block = new Uint8Array(64);
  let buffered = 0;
  let totalBytes = 0;

  for (const chunk of chunks) {
    if (!(chunk instanceof Uint8Array)) throw new TypeError("SHA-256 chunks must be Uint8Array values.");
    if (totalBytes > Number.MAX_SAFE_INTEGER - chunk.byteLength) {
      throw new RangeError("SHA-256 input exceeds the supported byte length.");
    }
    totalBytes += chunk.byteLength;
    let offset = 0;
    if (buffered > 0) {
      const copied = Math.min(64 - buffered, chunk.byteLength);
      block.set(chunk.subarray(0, copied), buffered);
      buffered += copied;
      offset += copied;
      if (buffered === 64) {
        processBlock(block, state, words);
        buffered = 0;
      }
    }
    while (offset + 64 <= chunk.byteLength) {
      processBlock(chunk.subarray(offset, offset + 64), state, words);
      offset += 64;
    }
    if (offset < chunk.byteLength) {
      buffered = chunk.byteLength - offset;
      block.set(chunk.subarray(offset), 0);
    }
  }

  block[buffered] = 0x80;
  buffered += 1;
  if (buffered > 56) {
    block.fill(0, buffered);
    processBlock(block, state, words);
    buffered = 0;
  }
  block.fill(0, buffered, 56);
  const view = new DataView(block.buffer);
  view.setUint32(56, Math.floor(totalBytes / 0x20000000), false);
  view.setUint32(60, (totalBytes * 8) >>> 0, false);
  processBlock(block, state, words);

  return [...state].map((word) => word.toString(16).padStart(8, "0")).join("");
}
