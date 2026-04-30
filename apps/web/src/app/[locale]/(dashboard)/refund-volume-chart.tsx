'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { SparkPoint } from './kpi-sparkline';

/**
 * Large area chart for the dashboard's "Refund volume" card. Mirrors
 * the bigger overview chart on the Elegance reference (with axes,
 * grid lines, and a per-point tooltip) but renders our daily refund
 * case volume rather than revenue.
 */
export function RefundVolumeChart({ data }: { data: SparkPoint[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        No data yet.
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 4, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="refundVolFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#635bff" stopOpacity={0.2} />
            <stop offset="50%" stopColor="#635bff" stopOpacity={0.06} />
            <stop offset="100%" stopColor="#635bff" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="currentColor" strokeOpacity={0.05} vertical={false} strokeDasharray="4 4" />
        <XAxis
          dataKey="date"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 11, fill: 'currentColor', opacity: 0.55 }}
          interval="preserveStartEnd"
          minTickGap={20}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 11, fill: 'currentColor', opacity: 0.55 }}
          width={32}
          allowDecimals={false}
        />
        <Tooltip
          cursor={{ stroke: '#635bff', strokeOpacity: 0.4, strokeDasharray: '3 3' }}
          contentStyle={{
            borderRadius: 12,
            border: '1px solid rgba(0,0,0,0.06)',
            fontSize: 12,
            padding: '8px 14px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
            background: 'white',
          }}
          formatter={(value: number) => [`${value} cases`, 'Created']}
          labelFormatter={(label) => `Day ${label}`}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke="#635bff"
          strokeWidth={2.5}
          fill="url(#refundVolFill)"
          dot={false}
          activeDot={{ r: 5, fill: '#635bff', stroke: 'white', strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
