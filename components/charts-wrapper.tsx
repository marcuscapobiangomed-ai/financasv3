"use client";

import dynamic from "next/dynamic";

const Area = dynamic(() => import("recharts").then((m) => ({ default: m.Area })), { ssr: false });
const AreaChart = dynamic(() => import("recharts").then((m) => ({ default: m.AreaChart })), { ssr: false });
const Bar = dynamic(() => import("recharts").then((m) => ({ default: m.Bar })), { ssr: false });
const BarChart = dynamic(() => import("recharts").then((m) => ({ default: m.BarChart })), { ssr: false });
const CartesianGrid = dynamic(() => import("recharts").then((m) => ({ default: m.CartesianGrid })), { ssr: false });
const Line = dynamic(() => import("recharts").then((m) => ({ default: m.Line })), { ssr: false });
const LineChart = dynamic(() => import("recharts").then((m) => ({ default: m.LineChart })), { ssr: false });
const Pie = dynamic(() => import("recharts").then((m) => ({ default: m.Pie })), { ssr: false });
const PieChart = dynamic(() => import("recharts").then((m) => ({ default: m.PieChart })), { ssr: false });
const ResponsiveContainer = dynamic(() => import("recharts").then((m) => ({ default: m.ResponsiveContainer })), { ssr: false });
const Tooltip = dynamic(() => import("recharts").then((m) => ({ default: m.Tooltip })), { ssr: false });
const XAxis = dynamic(() => import("recharts").then((m) => ({ default: m.XAxis })), { ssr: false });
const YAxis = dynamic(() => import("recharts").then((m) => ({ default: m.YAxis })), { ssr: false });
const Cell = dynamic(() => import("recharts").then((m) => ({ default: m.Cell })), { ssr: false });

const CHART_COLORS = ["#ff7a18", "#ff9a44", "#ffc174", "#c96a26", "#855031", "#f2c094"];

export function AreaChartWrapper({ data, dataKey, xKey, gradientId, gradientColor, color, height }: {
  data: any[]; dataKey: string; xKey: string; gradientId: string; gradientColor: string; color: string; height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height || 260}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={gradientColor} stopOpacity={0.4} />
            <stop offset="95%" stopColor={gradientColor} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#2a2d31" vertical={false} />
        <XAxis dataKey={xKey} stroke="#8c9199" tickLine={false} axisLine={false} />
        <YAxis stroke="#8c9199" tickLine={false} axisLine={false} tickFormatter={(v: number) => `R$${v}`} />
        <Tooltip content={<ChartTooltip />} />
        <Area type="monotone" dataKey={dataKey} stroke={color} fill={`url(#${gradientId})`} strokeWidth={3} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function BarChartWrapper({ data, dataKey, xKey, color, height }: {
  data: any[]; dataKey: string; xKey: string; color: string; height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height || 260}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
        <CartesianGrid stroke="#2a2d31" vertical={false} />
        <XAxis dataKey={xKey} stroke="#8c9199" tickLine={false} axisLine={false} />
        <YAxis stroke="#8c9199" tickLine={false} axisLine={false} tickFormatter={(v: number) => `R$${v}`} />
        <Tooltip content={<ChartTooltip />} />
        <Bar dataKey={dataKey} fill={color} radius={[8, 8, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function LineChartWrapper({ data, dataKey, xKey, color, height }: {
  data: any[]; dataKey: string; xKey: string; color: string; height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height || 260}>
      <LineChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="lineGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#2a2d31" vertical={false} />
        <XAxis dataKey={xKey} stroke="#8c9199" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
        <YAxis stroke="#8c9199" tickLine={false} axisLine={false} tickFormatter={(v: number) => `R$${v}`} tick={{ fontSize: 11 }} />
        <Tooltip content={<ChartTooltip />} />
        <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function PieChartWrapper({ data, nameKey, dataKey, height }: {
  data: any[]; nameKey: string; dataKey: string; height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height || 260}>
      <PieChart>
        <Pie data={data} nameKey={nameKey} dataKey={dataKey} cx="50%" cy="50%" outerRadius={80}>
          {data.map((_, index) => (
            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color?: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <strong>{label}</strong>
      {payload.map((item) => (
        <span key={item.name}>
          <i style={{ background: item.color ?? "#ff7a18" }} />
          {item.name}: <b>{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(item.value)}</b>
        </span>
      ))}
    </div>
  );
}
