import { buildNetwork, type NetworkInput, type Variant } from "@/lib/brain/network";
import BrainMap from "./BrainMap";

/**
 * Both layouts of one map, built on the server and switched by CSS: `wide` at
 * 640 px and up, `compact` below. Each is its own fixed-height `BrainMap`, so
 * labels stay readable on a phone and the box never changes height. The hidden
 * one is `display: none`, so it never intersects and never fires.
 */
export default function BrainMaps({
  variant,
  clusters,
  neurons,
}: {
  variant: Variant;
  clusters: NetworkInput["clusters"];
  neurons: NetworkInput["neurons"];
}) {
  const wide = buildNetwork({ variant, layout: "wide", clusters, neurons });
  // The motif is the same size at every width, so it is drawn once.
  if (variant === "motif") return <BrainMap network={wide} variant={variant} height={wide.height} />;
  const compact = buildNetwork({ variant, layout: "compact", clusters, neurons });
  return (
    <>
      <div className="hidden sm:block">
        <BrainMap network={wide} variant={variant} height={wide.height} />
      </div>
      <div className="sm:hidden">
        <BrainMap network={compact} variant={variant} height={compact.height} />
      </div>
    </>
  );
}
