// Simple SVG bar chart; values 0..1
export default function Chart({ data, labels }: { data: number[]; labels?: string[] }) {
  const n = data.length, w = 300, h = 90, gap = n > 10 ? 2 : 8, bw = (w - gap * (n - 1)) / n
  return (
    <svg viewBox={`0 0 ${w} ${h + (labels ? 16 : 0)}`} className="chart" role="img">
      {data.map((v, i) => {
        const bh = Math.max(3, v * h), x = i * (bw + gap)
        return (
          <g key={i}>
            <rect x={x} y={h - bh} width={bw} height={bh} rx={Math.min(4, bw / 2)} className={v ? 'bar' : 'bar0'} />
            {labels && <text x={x + bw / 2} y={h + 12} textAnchor="middle" className="lbl">{labels[i]}</text>}
          </g>
        )
      })}
    </svg>
  )
}
