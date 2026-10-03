import { BusFront, TrainFront, TramFront } from "lucide-react";
import type { TransitMode } from "../types";

export function TransitIcon({ mode, size = 18 }: { mode: TransitMode; size?: number }) {
  const Icon = mode === "Bus" ? BusFront : mode === "Train" ? TrainFront : TramFront;
  return <Icon size={size} strokeWidth={2} />;
}

export function modeClass(mode: TransitMode) {
  return mode.toLowerCase();
}
