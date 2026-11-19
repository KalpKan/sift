import type { CSSProperties } from "react";
import type { NetNeuron, Network, Variant } from "@/lib/brain/network";
import BrainFrame from "./BrainFrame";

/**
 * One server-rendered neuron map (docs/design/brain.md sections 4 and 5).
 *
 * The markup is a complete, correct, motionless figure: cells, fibres, tracts,
 * labels, the new ring, the 👍 and 👎 states, and a steady glow on new cells.
 * Colours and states live in app/globals.css (`.brain-*`), keyed off the data
 * attributes here, so the client only has to flip an attribute to change a
 * state. Nothing in here reads the clock or a random number.
 *
 * `BrainFrame` (client) wraps the SVG to add firing and the list link; the
 * Network never crosses to the client.
 */

const hueVar = (hue: number) => `var(--cluster-${hue + 1})`;

function Soma({ n }: { n: NetNeuron }) {
  const { soma } = n;
  const common = { className: "brain-soma", strokeWidth: soma.strokeWidth } as const;
  if (soma.shape === "triangle") return <path {...common} d={soma.d} strokeLinejoin="round" />;
  if (soma.shape === "ellipse") return <ellipse {...common} cx={n.x} cy={n.y} rx={soma.rx} ry={soma.ry} />;
  return <circle {...common} cx={n.x} cy={n.y} r={soma.rx} />;
}

// Cells are drawn best rank last, so the strongest cell is on top, and its tap target wins any overlap
// (the glyph parts take no pointer events, only the hit circle does: see `.brain-neuron` in globals.css).
const bestLast = (a: NetNeuron, b: NetNeuron) => b.rank - a.rank || (a.id < b.id ? -1 : 1);

function Neuron({ n, interactive }: { n: NetNeuron; interactive: boolean }) {
  const real = !n.ghost && !n.decorative;
  // Ratings only exist on the private radar, so only it carries the 👍 rings.
  const rings = interactive && real;
  const rs = n.size;
  return (
    <g
      className="brain-neuron"
      data-cell={n.id}
      data-pmid={real ? n.id : undefined}
      data-cluster={n.cluster}
      data-kind={n.kind}
      data-new={n.isNew ? "true" : "false"}
      data-verdict={n.verdict === null ? undefined : String(n.verdict)}
      data-ghost={n.ghost ? "true" : undefined}
      data-len={n.fibreLen}
      style={{ "--o": n.opacity, "--c": hueVar(n.hue) } as CSSProperties}
    >
      <path className="brain-fibre" d={n.fibre} />
      <path className="brain-den" style={{ "--w": 1 } as CSSProperties} strokeWidth={1} d={n.dendrites.thick} />
      {n.dendrites.thin && (
        <path className="brain-den" style={{ "--w": 0.75 } as CSSProperties} strokeWidth={0.75} d={n.dendrites.thin} />
      )}
      {!n.ghost && (
        <>
          <circle className="brain-halo brain-halo-2" cx={n.x} cy={n.y} r={Math.round(rs * 2.7 * 10) / 10} />
          <circle className="brain-halo brain-halo-1" cx={n.x} cy={n.y} r={Math.round(rs * 1.8 * 10) / 10} />
        </>
      )}
      {n.isNew && <circle className="brain-glow" cx={n.x} cy={n.y} r={Math.round((rs + 7) * 10) / 10} />}
      <Soma n={n} />
      {n.isNew && <circle className="brain-ring-new" cx={n.x} cy={n.y} r={Math.round((rs + 3.5) * 10) / 10} />}
      {rings && (
        <>
          <circle className="brain-ring-up brain-ring-up-near" cx={n.x} cy={n.y} r={Math.round((rs + 3.5) * 10) / 10} />
          <circle className="brain-ring-up brain-ring-up-far" cx={n.x} cy={n.y} r={Math.round((rs + 6.5) * 10) / 10} />
        </>
      )}
      {interactive && real && <circle className="brain-hit" cx={n.x} cy={n.y} r={n.hit} />}
    </g>
  );
}

export default function BrainMap({
  network,
  variant,
  height,
}: {
  network: Network;
  variant: Variant;
  height: number;
}) {
  const interactive = variant === "radar";
  return (
    <BrainFrame
      variant={variant}
      layout={network.layout}
      height={height}
      seed={`${variant}-${network.layout}`}
      dormant={network.dormant}
    >
      <svg className="brain-svg" viewBox={`0 0 ${network.width} ${network.height}`} width={network.width} height={network.height} focusable="false">
        <g>
          {network.edges
            .filter((e) => e.kind === "axon")
            .map((e) => (
              <path key={`${e.from}-${e.to}`} className="brain-tract" d={e.d} />
            ))}
        </g>
        <g>
          {[...network.neurons].sort(bestLast).map((n) => (
            <Neuron key={n.id} n={n} interactive={interactive} />
          ))}
        </g>
        {network.clusters.map((c) =>
          c.lines.map((line, k) => (
            <text
              key={`${c.id}-${k}`}
              className="brain-label"
              data-cluster={c.id}
              x={c.x}
              y={c.labelY + k * (network.labelPx + 2)}
              textAnchor="middle"
              style={{ fontSize: network.labelPx, "--c": hueVar(c.hue) } as CSSProperties}
            >
              {line}
            </text>
          )),
        )}
        <g className="brain-spikes" />
      </svg>
    </BrainFrame>
  );
}
