import { deflateRawSync } from 'node:zlib';
export function zip(entries) {
  const local=[], central=[]; let offset=0;
  function crc(bytes) { let c=0xffffffff; for(const b of bytes) { c^=b; for(let i=0;i<8;i++) c=(c>>>1)^((c&1)?0xedb88320:0); } return (c^0xffffffff)>>>0; }
  for(const {name,data} of entries) {
    const path=Buffer.from(name.replaceAll('\\','/')), raw=Buffer.from(data), compressed=deflateRawSync(raw), sum=crc(raw);
    const header=Buffer.alloc(30); header.writeUInt32LE(0x04034b50); header.writeUInt16LE(20,4); header.writeUInt16LE(0x800,6); header.writeUInt16LE(8,8); header.writeUInt16LE(0x21,12); header.writeUInt32LE(sum,14); header.writeUInt32LE(compressed.length,18); header.writeUInt32LE(raw.length,22); header.writeUInt16LE(path.length,26);
    local.push(header,path,compressed);
    const dir=Buffer.alloc(46); dir.writeUInt32LE(0x02014b50); dir.writeUInt16LE(20,4); dir.writeUInt16LE(20,6); dir.writeUInt16LE(0x800,8); dir.writeUInt16LE(8,10); dir.writeUInt16LE(0x21,14); dir.writeUInt32LE(sum,16); dir.writeUInt32LE(compressed.length,20); dir.writeUInt32LE(raw.length,24); dir.writeUInt16LE(path.length,28); dir.writeUInt32LE(offset,42);
    central.push(dir,path); offset+=header.length+path.length+compressed.length;
  }
  const directory=Buffer.concat(central), end=Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(entries.length,8); end.writeUInt16LE(entries.length,10); end.writeUInt32LE(directory.length,12); end.writeUInt32LE(offset,16);
  return Buffer.concat([...local,directory,end]);
}
