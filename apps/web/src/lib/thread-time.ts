import type { BubbleCluster } from "@rakazo/core";

export function bubbleRadiusClass(role: "user" | "bot", cluster: BubbleCluster): string {
  if (cluster === "single") return "rounded-[18px]";
  if (role === "user") {
    if (cluster === "first") return "rounded-[18px] rounded-br-[6px]";
    if (cluster === "last") return "rounded-[18px] rounded-tr-[6px]";
    return "rounded-[18px] rounded-tr-[6px] rounded-br-[6px]";
  }
  if (cluster === "first") return "rounded-[18px] rounded-bl-[6px]";
  if (cluster === "last") return "rounded-[18px] rounded-tl-[6px]";
  return "rounded-[18px] rounded-tl-[6px] rounded-bl-[6px]";
}
