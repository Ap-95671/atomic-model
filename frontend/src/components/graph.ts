import { esc } from "./dom";

export function graph(
  xs: number[],
  ys: number[],
  xLabel: string,
  yLabel: string,
  markers: number[] = [],
) {
  const width = 650,
    height = 155,
    left = 46,
    right = 20,
    top = 14,
    bottom = 30;
  const xMax = Math.max(...xs),
    yMax = Math.max(...ys) * 1.12 || 1;
  const x = (v: number) => left + (v / xMax) * (width - left - right);
  const y = (v: number) =>
    height - bottom - (v / yMax) * (height - top - bottom);
  const path = xs
    .map((v, i) => `${i ? "L" : "M"}${x(v).toFixed(1)},${y(ys[i]).toFixed(1)}`)
    .join(" ");
  return `<svg class="graph" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(yLabel)} versus ${esc(xLabel)}">${[0, 0.5, 1].map((f) => `<line x1="${left}" y1="${y(f * yMax)}" x2="${width - right}" y2="${y(f * yMax)}" class="gridline"/><text x="${left - 7}" y="${y(f * yMax) + 4}" text-anchor="end">${(f * yMax).toPrecision(2)}</text>`).join("")}<path d="${path} L${x(xMax)},${y(0)} L${x(0)},${y(0)} Z" fill="url(#graph-fill)"/><path d="${path}" fill="none" stroke="#61c8e5" stroke-width="2"/>${markers
    .filter((v) => v < xMax)
    .map(
      (v) =>
        `<line x1="${x(v)}" y1="${top}" x2="${x(v)}" y2="${height - bottom}" stroke="#dda477" stroke-dasharray="3 4"/>`,
    )
    .join(
      "",
    )}${[0, 0.25, 0.5, 0.75, 1].map((f) => `<text x="${x(f * xMax)}" y="${height - 12}" text-anchor="middle">${(f * xMax).toFixed(1)}</text>`).join("")}<text x="${width - right}" y="11" text-anchor="end">${esc(yLabel)}</text><text x="${width / 2}" y="${height}" text-anchor="middle">${esc(xLabel)}</text><defs><linearGradient id="graph-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#53bfdc" stop-opacity="0.16"/><stop offset="1" stop-color="#53bfdc" stop-opacity="0"/></linearGradient></defs></svg>`;
}
