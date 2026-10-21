// Based on the MIT-licensed StudioLive API UBJSON decoder by Andrew Wong.
// Hardened/extended here: bounds, depth, null prototypes, booleans and length types.
// See THIRD_PARTY_NOTICES.md for source revision and license.
export function decodeUBJSON(buffer: Buffer): unknown {
  let offset = 0;
  function take(n: number): Buffer {
    if (!Number.isSafeInteger(n) || n < 0 || offset + n > buffer.length) throw new Error('Incomplete UBJSON.');
    const result = buffer.subarray(offset, offset + n); offset += n; return result;
  }
  function byte(): number { return take(1)[0]; }
  function number(type: number): number | bigint {
    switch (type) {
      case 105: return take(1).readInt8();
      case 85: return byte();
      case 73: return take(2).readInt16BE();
      case 108: return take(4).readInt32BE();
      case 76: return take(8).readBigInt64BE();
      case 100: return take(4).readFloatBE();
      case 68: return take(8).readDoubleBE();
      default: throw new Error('Unknown UBJSON number type.');
    }
  }
  function length(): number {
    const type = byte();
    // StudioLive uses i with unsigned byte lengths, including lengths >127.
    const n = type === 105 ? byte() : number(type);
    if (typeof n !== 'number' || !Number.isInteger(n) || n < 0) throw new Error('Invalid UBJSON length.');
    return n;
  }
  function value(depth: number): unknown {
    if (depth > 64) throw new Error('UBJSON nesting too deep.');
    const type = byte();
    if (type === 123) {
      const obj: Record<string, unknown> = Object.create(null);
      while (buffer[offset] !== 125) {
        const key = take(length()).toString('utf8');
        obj[key] = value(depth + 1);
      }
      byte(); return obj;
    }
    if (type === 91) {
      const arr: unknown[] = [];
      while (buffer[offset] !== 93) arr.push(value(depth + 1));
      byte(); return arr;
    }
    if (type === 83) return take(length()).toString('utf8');
    if (type === 84) return true;
    if (type === 70) return false;
    if (type === 90) return null;
    return number(type);
  }
  const result = value(0);
  if (offset !== buffer.length) throw new Error('Trailing UBJSON data.');
  return result;
}
