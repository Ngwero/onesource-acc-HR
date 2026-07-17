"use client";

import { cn, formatCurrency } from "@/lib/utils";
import { Card, CardContent } from "./card";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  trend?: number;
  isCurrency?: boolean;
  className?: string;
}

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  isCurrency,
  className,
}: StatCardProps) {
  const displayValue =
    isCurrency && typeof value === "number" ? formatCurrency(value) : value;

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">{title}</p>
            <p className="mt-2 text-2xl font-bold text-green-900">{displayValue}</p>
            {subtitle && <p className="mt-1 text-xs text-gray-400">{subtitle}</p>}
            {trend !== undefined && (
              <p className={cn("mt-1 text-xs font-medium", trend >= 0 ? "text-emerald-600" : "text-red-600")}>
                {trend >= 0 ? "+" : ""}{trend}% vs last period
              </p>
            )}
          </div>
          {Icon && (
            <div className="rounded-lg bg-green-100 p-2">
              <Icon className="h-5 w-5 text-green-700" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
