/**
 * ECC adapter using @noble/curves for bitcoinjs-lib compatibility.
 * This replaces tiny-secp256k1 which has Wasm loading issues with Vite.
 */
import { secp256k1, schnorr } from '@noble/curves/secp256k1.js';

const Point = secp256k1.Point;
const CURVE_ORDER = Point.CURVE().n;

/** Convert Uint8Array to hex string */
function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Convert hex string to Uint8Array */
function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * ECC interface compatible with bitcoinjs-lib's initEccLib requirements.
 */
export const ecc = {
  isPoint(p: Uint8Array): boolean {
    try {
      Point.fromHex(toHex(p));
      return true;
    } catch {
      return false;
    }
  },

  isPrivate(d: Uint8Array): boolean {
    try {
      const num = bytesToNumberBE(d);
      return num > 0n && num < CURVE_ORDER;
    } catch {
      return false;
    }
  },

  isXOnlyPoint(p: Uint8Array): boolean {
    try {
      if (p.length !== 32) return false;
      // Prepend 0x02 to make compressed pubkey and validate
      const prefixed = new Uint8Array(33);
      prefixed[0] = 0x02;
      prefixed.set(p, 1);
      Point.fromHex(toHex(prefixed));
      return true;
    } catch {
      return false;
    }
  },

  xOnlyPointAddTweak(
    p: Uint8Array,
    tweak: Uint8Array
  ): { parity: 0 | 1; xOnlyPubkey: Uint8Array } | null {
    try {
      // Prepend 0x02 to get point from x-only
      const prefixed = new Uint8Array(33);
      prefixed[0] = 0x02;
      prefixed.set(p, 1);
      const point = Point.fromHex(toHex(prefixed));

      // Get point from tweak scalar (multiply generator)
      const tweakPubKey = secp256k1.getPublicKey(tweak, true);
      const tweakPoint = Point.fromHex(toHex(tweakPubKey));

      const result = point.add(tweakPoint);
      const resultBytes = result.toBytes(true);
      const parity = (resultBytes[0] === 0x03 ? 1 : 0) as 0 | 1;
      return {
        parity,
        xOnlyPubkey: resultBytes.slice(1),
      };
    } catch {
      return null;
    }
  },

  pointFromScalar(sk: Uint8Array, compressed = true): Uint8Array | null {
    try {
      return secp256k1.getPublicKey(sk, compressed);
    } catch {
      return null;
    }
  },

  pointCompress(p: Uint8Array, compressed = true): Uint8Array {
    const point = Point.fromHex(toHex(p));
    return point.toBytes(compressed);
  },

  pointMultiply(p: Uint8Array, tweak: Uint8Array, compressed = true): Uint8Array | null {
    try {
      const point = Point.fromHex(toHex(p));
      const scalar = bytesToNumberBE(tweak);
      const result = point.multiply(scalar);
      return result.toBytes(compressed);
    } catch {
      return null;
    }
  },

  pointAdd(pA: Uint8Array, pB: Uint8Array, compressed = true): Uint8Array | null {
    try {
      const pointA = Point.fromHex(toHex(pA));
      const pointB = Point.fromHex(toHex(pB));
      const result = pointA.add(pointB);
      return result.toBytes(compressed);
    } catch {
      return null;
    }
  },

  pointAddScalar(p: Uint8Array, tweak: Uint8Array, compressed = true): Uint8Array | null {
    try {
      const point = Point.fromHex(toHex(p));
      // Get point from tweak scalar (multiply generator)
      const tweakPubKey = secp256k1.getPublicKey(tweak, true);
      const tweakPoint = Point.fromHex(toHex(tweakPubKey));
      const result = point.add(tweakPoint);
      return result.toBytes(compressed);
    } catch {
      return null;
    }
  },

  privateAdd(d: Uint8Array, tweak: Uint8Array): Uint8Array | null {
    try {
      const dNum = bytesToNumberBE(d);
      const tweakNum = bytesToNumberBE(tweak);
      const result = mod(dNum + tweakNum, CURVE_ORDER);
      if (result === 0n) return null;
      return numberToBytes(result, 32);
    } catch {
      return null;
    }
  },

  privateNegate(d: Uint8Array): Uint8Array {
    const dNum = bytesToNumberBE(d);
    const result = mod(CURVE_ORDER - dNum, CURVE_ORDER);
    return numberToBytes(result, 32);
  },

  sign(h: Uint8Array, d: Uint8Array, e?: Uint8Array): Uint8Array {
    // Sign with ECDSA, return compact 64-byte signature
    // prehash: false because bitcoinjs-lib passes pre-hashed messages
    return secp256k1.sign(h, d, { prehash: false, extraEntropy: e });
  },

  signSchnorr(h: Uint8Array, d: Uint8Array, e?: Uint8Array): Uint8Array {
    // BIP340 Schnorr signatures using @noble/curves schnorr implementation
    return schnorr.sign(h, d, e);
  },

  verify(h: Uint8Array, Q: Uint8Array, signature: Uint8Array, strict?: boolean): boolean {
    try {
      // prehash: false because bitcoinjs-lib passes pre-hashed messages
      return secp256k1.verify(signature, h, Q, { prehash: false });
    } catch {
      return false;
    }
  },

  verifySchnorr(h: Uint8Array, Q: Uint8Array, signature: Uint8Array): boolean {
    try {
      // BIP340 Schnorr verification - Q should be x-only pubkey (32 bytes)
      return schnorr.verify(signature, h, Q);
    } catch {
      return false;
    }
  },
};

function bytesToNumberBE(bytes: Uint8Array): bigint {
  let result = 0n;
  for (const byte of bytes) {
    result = (result << 8n) + BigInt(byte);
  }
  return result;
}

function numberToBytes(num: bigint, length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  for (let i = length - 1; i >= 0; i--) {
    bytes[i] = Number(num & 0xffn);
    num >>= 8n;
  }
  return bytes;
}

function mod(a: bigint, b: bigint): bigint {
  const result = a % b;
  return result >= 0n ? result : result + b;
}

export default ecc;
