import { Zap } from "lucide-react";

export default function Logo({ size = "md" }) {
  const box = size === "lg" ? "w-10 h-10" : "w-7 h-7";
  return (
    <span className="flex items-center gap-2 font-semibold text-foreground">
      <span className={`${box} rounded-lg bg-primary flex items-center justify-center`}>
        <Zap className="w-4 h-4 fill-foreground" />
      </span>
      <span className={size === "lg" ? "text-xl" : "text-base"}>Finley</span>
    </span>
  );
}