import { motion } from "framer-motion";

interface Props {
  uncertainty: number;
  predicted: number;
}

/** Visualizes the GP's predictive spread as a band around the predicted value,
 * scaled to +/- 3 std so the band width communicates relative confidence. */
export function ConfidenceBar({ uncertainty, predicted }: Props) {
  const spread = Math.max(uncertainty, 1e-6);
  const bandPct = Math.min(100, (uncertainty / (spread * 3)) * 100);

  return (
    <div className="confidence-bar" title={`${predicted.toFixed(2)} ± ${uncertainty.toFixed(2)}`}>
      <div className="confidence-track">
        <motion.div
          className="confidence-band"
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: `${bandPct * 2}%`, opacity: 1 }}
          transition={{ type: "spring", stiffness: 90, damping: 18 }}
        />
        <motion.div
          className="confidence-marker"
          initial={{ left: "50%", scale: 0 }}
          animate={{ left: "50%", scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 14, delay: 0.1 }}
        />
      </div>
      <span className="tiny muted">tighter band = more confident</span>
    </div>
  );
}
