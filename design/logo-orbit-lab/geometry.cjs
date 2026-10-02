// Reachard mark studies derived from Lucide Orbit; see LICENSE.lucide.txt.
(function (root) {
  const families = [
    { key: 'A', name: '均衡', rx: 9.5, ry: 9.5, gap: 38 },
    { key: 'B', name: '开放', rx: 9.5, ry: 9.5, gap: 56 },
    { key: 'C', name: '紧凑', rx: 8.7, ry: 8.7, gap: 34 },
    { key: 'D', name: '实心连接点', rx: 9.5, ry: 9.5, gap: 42, solidNodes: true },
    { key: 'E', name: '中心聚焦', rx: 9.5, ry: 9.5, gap: 44, solidCenter: true },
    { key: 'F', name: '椭圆舒展', rx: 10, ry: 8.5, gap: 42 },
  ];
  const round = n => +n.toFixed(5);
  function mark(p, color = '#252729') {
    const point = degrees => { const a = degrees * Math.PI / 180; return [round(12 + p.rx * Math.cos(a)), round(12 + p.ry * Math.sin(a))]; };
    // Join the arc under each endpoint circle, so no background-colored masks are needed.
    const arc = a => `<path d="M${point(a).join(' ')} A${p.rx} ${p.ry} 0 0 1 ${point(a + 180 - p.gap).join(' ')}"/>`;
    const node = a => { const [x, y] = point(a); return `<circle cx="${x}" cy="${y}" r="${p.node}" fill="${p.solidNodes ? color : 'none'}"/>`; };
    // Start arcs at the node's boundary to preserve hollow centers with no masking.
    const cut = a => {
      let lo = a, hi = a + 40;
      const [x, y] = point(a);
      for (let i = 0; i < 30; i++) { const mid = (lo + hi) / 2; const [mx, my] = point(mid); if (Math.hypot(mx - x, my - y) < p.node) lo = mid; else hi = mid; }
      return `<path d="M${point((lo + hi) / 2).join(' ')} A${p.rx} ${p.ry} 0 0 1 ${point(a + 180 - p.gap).join(' ')}"/>`;
    };
    const centerRadius = p.solidCenter ? round(p.center * .64) : p.center;
    return `<g fill="none" stroke="${color}" stroke-width="${p.stroke}" stroke-linecap="round" stroke-linejoin="round">${cut(p.angle)}${cut(p.angle + 180)}<circle cx="12" cy="12" r="${centerRadius}" fill="${p.solidCenter ? color : 'none'}"/>${node(p.angle)}${node(p.angle + 180)}</g>`;
  }
  function variants() {
    const results = [];
    for (const f of families) {
      let count = 0;
      for (const stroke of [1.35, 1.6, 1.85]) for (const center of [2.7, 3.25, 3.8]) for (const node of [1.55, 1.85, 2.15]) for (const angle of [-45, -30]) {
        results.push({ ...f, stroke, center, node, angle, id: `${f.key}${String(++count).padStart(3, '0')}` });
      }
    }
    return results;
  }
  const api = { families, variants, mark };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ReachardGeometry = api;
})(typeof window === 'undefined' ? globalThis : window);
