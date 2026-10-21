import type { ChannelView } from './mixer-service.js';
import { levelToDb } from './controls.js';
export function escapeXml(text: string): string {
  return text.replace(/[<>&"']/g, ch => ({'<':'&lt;', '>':'&gt;', '&':'&amp;', '"':'&quot;', "'":'&apos;'}[ch]!));
}
function textColor(background:string):string {
  const luminance=(hex:string)=>{
    const rgb=[1,3,5].map(offset=>parseInt(hex.slice(offset,offset+2),16)/255).map(value=>value<=0.04045?value/12.92:((value+0.055)/1.055)**2.4);
    return rgb[0]*0.2126+rgb[1]*0.7152+rgb[2]*0.0722;
  };
  const light=luminance(background),dark=luminance('#111827');
  return (light+0.05)/(dark+0.05)>1.05/(light+0.05)?'#111827':'#ffffff';
}
function lighten(color:string):string {
  return '#'+[1,3,5].map(offset=>Math.round(parseInt(color.slice(offset,offset+2),16)*0.35+255*0.65).toString(16).padStart(2,'0')).join('');
}
export function keySvg(channel:number,name:string,view:ChannelView,invalid=false,options:{label?:string;scope?:string;level?:boolean;inactive?:boolean;customColor?:string}={}): string {
  const known=view.status==='online' && (options.level?typeof view.level==='number':typeof view.muted==='boolean');
  const db=typeof view.level==='number'?levelToDb(view.level):undefined;
  const levelText=db===undefined?'':view.level===0?'−∞':`≈ ${(Math.abs(db)<0.05?0:db).toFixed(1)} dB`;
  const text=invalid || view.status==='invalid'?'SETTINGS':view.pending?(view.fading?'FADE':'WAIT'):!known?(view.status==='connecting'?'CONNECTING':view.status==='online'?'UNKNOWN':'OFFLINE'):options.level?levelText:view.muted?'MUTE':'OPEN';
  const mixerColor=typeof view.color==='string' && /^#[0-9a-f]{6}$/i.test(view.color)?view.color:undefined;
  const customColor=typeof options.customColor==='string' && /^#[0-9a-f]{6}$/i.test(options.customColor)?options.customColor:undefined;
  const inactive=options.level && options.inactive && known && !invalid && !view.pending;
  const baseColor=view.muted?'#b91c34':customColor ?? mixerColor ?? (options.level?'#174e89':'#06685c');
  const color=inactive?lighten(baseColor):known && !invalid?baseColor:'#454b54';
  const foreground=inactive?'#303640':textColor(color);
  const identifier=invalid?'TARGET ?':options.label ?? `CHANNEL ${channel}`;
  const trimmed=name.trim();
  const characters=Array.from(trimmed);
  const displayName=characters.length>24?characters.slice(0,23).join('')+'…':trimmed;
  const heading=invalid?identifier:displayName || identifier;
  const headingSize=Array.from(heading).length>10?20:26;
  const fit=Array.from(heading).length*headingSize*0.65>124?' textLength="124" lengthAdjust="spacingAndGlyphs"':'';
  const primary=options.level?(options.scope ?? 'LEVEL'):text;
  const footer=options.level?(known && !invalid?levelText:text):(options.scope ?? 'MAIN');
  const detail=options.level && known && !invalid?[view.muted?'MUTE':'',view.pending?(view.fading?'FADE':'WAIT'):''].filter(Boolean).join(' · '):'';
  const primarySize=options.level?(primary.length>8?21:26):(text.length>6?21:30);
  const primaryFit=Array.from(primary).length*primarySize*0.65>124?' textLength="124" lengthAdjust="spacingAndGlyphs"':'';
  // The mixer/custom name is the main label; retain the channel number separately.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144"><rect width="144" height="144" rx="14" fill="${color}"/>${view.pending?`<rect x="5" y="5" width="134" height="134" rx="11" fill="none" stroke="${foreground}" stroke-width="7"/>`:''}<rect x="5" y="5" width="134" height="134" rx="11" fill="none" stroke="${view.pending?'#ffc857':foreground}" stroke-opacity="${view.pending?1:0.3}" stroke-width="4"/><g fill="${foreground}" font-family="Segoe UI,Arial,sans-serif" text-anchor="middle"><text data-role="heading" x="72" y="33" font-size="${headingSize}" font-weight="600"${fit}>${escapeXml(heading)}</text><text data-role="target" x="72" y="54" font-size="14">${displayName && !invalid?escapeXml(identifier):''}</text><text data-role="${options.level?'function':'status'}" x="72" y="91" font-size="${primarySize}" font-weight="bold"${primaryFit}>${escapeXml(primary)}</text><text data-role="detail" x="72" y="112" font-size="14">${escapeXml(detail)}</text><text data-role="scope" x="72" y="131" font-size="14">${escapeXml(footer)}</text></g></svg>`;
}
