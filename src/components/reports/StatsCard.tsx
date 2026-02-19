import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type StatsCardProps = {
  title: string;
  value: string | number;
  change?: string;
  trend?: "up" | "down" | "neutral";
  icon?: LucideIcon;
};

export function StatsCard({
  title,
  value,
  change,
  trend = "neutral",
  icon: Icon,
}: StatsCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {change && (
          <p className="text-xs text-muted-foreground mt-1">
            <span
              className={cn(
                trend === "up" && "text-emerald-500",
                trend === "down" && "text-red-500"
              )}
            >
              {change}
            </span>{" "}
            from last period
          </p>
        )}
      </CardContent>
    </Card>
  );
}
