export function download(name: string, body: BlobPart, type: string) {
  const url=URL.createObjectURL(new Blob([body],{type}));
  const a=document.createElement('a'); a.href=url; a.download=name; a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function csv(name: string, model: string, parameters: string, rows: (string|number)[][]) {
  const cell=(v:unknown)=>`"${String(v).replaceAll('"','""')}"`;
  download(name, [['Model',model],['Parameters',parameters],...rows].map(row=>row.map(cell).join(',')).join('\r\n'),'text/csv;charset=utf-8');
}
export async function plotPng(svg: SVGSVGElement, name: string) {
  const url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)],{type:'image/svg+xml'}));
  try {
    const image=new Image(); image.src=url; await image.decode();
    const canvas=document.createElement('canvas'); canvas.width=1520; canvas.height=580;
    canvas.getContext('2d')!.drawImage(image,0,0,canvas.width,canvas.height);
    const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('PNG export failed')),'image/png'));
    download(name,blob,'image/png');
  } finally { URL.revokeObjectURL(url); }
}
