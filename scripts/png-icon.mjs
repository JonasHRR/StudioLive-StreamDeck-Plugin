import { deflateSync } from 'node:zlib';
// Small dependency-free PNG renderer for the original geometric SL icon.
export function pngIcon(size) {
  const pixels = Buffer.alloc((size*4+1)*size);
  const letters = ['11111 10000','10000 10000','10000 10000','11111 10000','00001 10000','00001 10000','11111 11111'];
  const scale = size/32;
  for(let y=0;y<size;y++) for(let x=0;x<size;x++) {
    const cellX = Math.floor(x/scale)-10, cellY = Math.floor(y/scale)-10;
    const letter = cellY>=0 && cellY<7 && cellX>=0 && cellX<11 && letters[cellY][cellX]==='1';
    const rail = y>size*.69 && y<size*.72 && x>size*.18 && x<size*.82;
    const i = y*(size*4+1)+1+x*4;
    pixels.set(letter||rail ? [255,255,255,255] : [6,104,92,255],i);
  }
  function crc(bytes) { let c=0xffffffff; for(const b of bytes) { c^=b; for(let i=0;i<8;i++) c=(c>>>1)^((c&1)?0xedb88320:0); } return (c^0xffffffff)>>>0; }
  function chunk(type,content) { const name=Buffer.from(type), n=Buffer.alloc(4), sum=Buffer.alloc(4); n.writeUInt32BE(content.length); sum.writeUInt32BE(crc(Buffer.concat([name,content]))); return Buffer.concat([n,name,content,sum]); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size); ihdr.writeUInt32BE(size,4); ihdr[8]=8; ihdr[9]=6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(pixels)),chunk('IEND',Buffer.alloc(0))]);
}
