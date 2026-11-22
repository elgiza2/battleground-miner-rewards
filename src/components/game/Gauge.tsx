// Radar gauge from the "Inference Speed" card, reused as the mining meter.
export function Gauge({ fill }: { fill: number }) {
  const ticks = Array.from({ length: 23 }, (_, i) => {
    const a = ((190 + i * 5) * Math.PI) / 180;
    const outer = 142;
    const inner = i % 5 === 0 ? 129 : 133;
    return { x1: 163 + outer * Math.cos(a), y1: 163 + outer * Math.sin(a), x2: 163 + inner * Math.cos(a), y2: 163 + inner * Math.sin(a), w: i % 5 === 0 ? 1.5 : 1 };
  });
  const sweep = Math.max(0, Math.min(1, fill));
  return (
    <svg viewBox="0 0 326 326" className="h-full w-full overflow-visible" aria-hidden="true">
      <defs>
        <linearGradient id="gaugeArc" gradientUnits="userSpaceOnUse" x1="7" y1="136" x2="312" y2="109">
          <stop offset="0" stopColor="#ff9ab7" stopOpacity=".06" />
          <stop offset=".08" stopColor="#ff8caf" stopOpacity=".44" />
          <stop offset=".34" stopColor="#ff6796" stopOpacity=".94" />
          <stop offset=".58" stopColor="#ff6796" stopOpacity="1" />
          <stop offset=".82" stopColor="#ffe7ed" stopOpacity=".74" />
          <stop offset=".94" stopColor="#fff8fa" stopOpacity=".28" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="gaugeShadow" gradientUnits="userSpaceOnUse" x1="11" y1="136" x2="308" y2="110">
          <stop offset="0" stopColor="#6e1639" stopOpacity=".04" />
          <stop offset=".09" stopColor="#6e1639" stopOpacity=".17" />
          <stop offset=".52" stopColor="#72163d" stopOpacity=".18" />
          <stop offset=".78" stopColor="#7b1a43" stopOpacity=".1" />
          <stop offset="1" stopColor="#7b1a43" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="radarBeam" cx="163" cy="163" r="145" gradientUnits="userSpaceOnUse">
          <stop offset=".3" stopColor="#650f35" stopOpacity="0" />
          <stop offset=".45" stopColor="#650f35" stopOpacity=".025" />
          <stop offset=".7" stopColor="#650f35" stopOpacity=".065" />
          <stop offset=".9" stopColor="#650f35" stopOpacity=".08" />
          <stop offset="1" stopColor="#650f35" stopOpacity=".05" />
        </radialGradient>
        <linearGradient id="radarBeamEdge" gradientUnits="userSpaceOnUse" x1="238" y1="33" x2="190.5" y2="115.4">
          <stop offset="0" stopColor="#ffe7ef" stopOpacity=".19" />
          <stop offset=".48" stopColor="#ffd1df" stopOpacity=".11" />
          <stop offset=".82" stopColor="#ffc6d7" stopOpacity=".045" />
          <stop offset="1" stopColor="#ffc6d7" stopOpacity="0" />
        </linearGradient>
        <filter id="radarSoft"><feGaussianBlur stdDeviation="1.35" /></filter>
        <filter id="radarHalo"><feGaussianBlur stdDeviation="5.2" /></filter>
        <filter id="gaugeBlur"><feGaussianBlur stdDeviation="11" /></filter>
      </defs>
      <path d="M11.34 136.26A154 154 0 0 1 307.71 110.33" fill="none" strokeWidth="3.2" strokeLinecap="round" stroke="url(#gaugeShadow)" />
      <path d="M6.91 135.48A158.5 158.5 0 0 1 311.94 108.79" fill="none" strokeWidth="2.2" strokeLinecap="round" stroke="url(#gaugeArc)" />
      <path d="M19.22 137.65A146 146 0 0 1 236 36.56" fill="none" strokeWidth="1.15" stroke="rgba(255,166,194,.31)" />
      <g style={{ transformOrigin: "163px 163px", transform: `rotate(${-110 + sweep * 110}deg)`, transition: "transform 1s ease" }}>
        <path d="M238 33.1A150 150 0 0 1 277.9 66.6L199.8 119.5A55 55 0 0 0 190.5 115.4Z" fill="#6a1238" opacity=".022" filter="url(#radarHalo)" />
        <path d="M238 33.1A150 150 0 0 1 277.9 66.6L199.8 119.5A55 55 0 0 0 190.5 115.4Z" fill="url(#radarBeam)" filter="url(#radarSoft)" />
        <path d="M238 33.1L190.5 115.4" stroke="url(#radarBeamEdge)" strokeWidth="1.25" strokeLinecap="round" filter="url(#radarSoft)" />
      </g>
      <g>
        {ticks.map((t, i) => (
          <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke="rgba(255,188,210,.34)" strokeWidth={t.w} />
        ))}
      </g>
      <ellipse cx="225" cy="166" rx="92" ry="76" fill="#fff" opacity=".055" filter="url(#gaugeBlur)" />
    </svg>
  );
}
