import { esc } from './dom';
export interface Curve { label: string; x: number[]; y: number[]; color: string; dashed?: boolean; }
/** Data-driven SVG with explicit units, accessible description, and point readouts. */
export function plot(curves: Curve[], xLabel: string, yLabel: string, title: string) {
  const width=760, height=290, left=78, right=22, top=35, bottom=58;
  const xs=curves.flatMap(c=>c.x), ys=curves.flatMap(c=>c.y);
  let xmin=Math.min(...xs), xmax=Math.max(...xs), ymin=Math.min(0,...ys), ymax=Math.max(...ys);
  if(xmax===xmin) xmax=xmin+1;
  if(ymax===ymin) ymax=ymin+1;
  const pad=(ymax-ymin)*.08; ymax+=pad; if(ymin<0)ymin-=pad;
  const x=(v:number)=>left+(v-xmin)/(xmax-xmin)*(width-left-right);
  const y=(v:number)=>height-bottom-(v-ymin)/(ymax-ymin)*(height-top-bottom);
  const fmt=(v:number)=>Math.abs(v)>=1000 || (Math.abs(v)<.01 && v!==0) ? v.toExponential(1) : Number(v.toPrecision(3)).toString();
  return `<div class="plot-scroll"><svg xmlns="http://www.w3.org/2000/svg" class="scientific-plot" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(title)}; ${esc(yLabel)} versus ${esc(xLabel)}" style="background:#101821;font:12px sans-serif;color:#b8c5d0"><title>${esc(title)}</title><text x="${left}" y="20" fill="#e3e9ef">${esc(title)}</text>${Array.from({length:5},(_,i)=>{
    const vx=xmin+(xmax-xmin)*i/4, vy=ymin+(ymax-ymin)*i/4;
    return `<line x1="${left}" x2="${width-right}" y1="${y(vy)}" y2="${y(vy)}" stroke="#2b3945"/><text x="${left-10}" y="${y(vy)+4}" text-anchor="end" fill="#b8c5d0">${fmt(vy)}</text><text x="${x(vx)}" y="${height-bottom+22}" text-anchor="middle" fill="#b8c5d0">${fmt(vx)}</text>`;
  }).join('')}${curves.map(c=>`<path d="${c.x.map((v,i)=>`${i?'L':'M'}${x(v).toFixed(2)},${y(c.y[i]).toFixed(2)}`).join(' ')}" fill="none" stroke="${c.color}" stroke-width="2" ${c.dashed?'stroke-dasharray="6 4"':''}/>${c.x.filter((_,i)=>i%Math.max(1,Math.floor(c.x.length/100))===0).map((v,j)=>{
    const i=j*Math.max(1,Math.floor(c.x.length/100));
    return `<circle cx="${x(v)}" cy="${y(c.y[i])}" r="5" fill="transparent"><title>${esc(c.label)}: ${fmt(v)} ${esc(xLabel)}; ${fmt(c.y[i])} ${esc(yLabel)}</title></circle>`;
  }).join('')}`).join('')}<text x="${width/2}" y="${height-10}" fill="#b8c5d0" text-anchor="middle">${esc(xLabel)}</text><text x="16" y="${height/2}" fill="#b8c5d0" text-anchor="middle" transform="rotate(-90 16 ${height/2})">${esc(yLabel)}</text></svg></div><div class="plot-legend">${curves.map(c=>`<span><i style="background:${c.color}"></i>${esc(c.label)}${c.dashed?' (dashed)':''}</span>`).join('')}</div>`;
}
