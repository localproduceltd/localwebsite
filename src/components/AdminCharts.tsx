"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface WeeklyData {
  week: string;
  revenue: number;
  orders: number;
}

interface AdminChartsProps {
  weeklyData: WeeklyData[];
}

export default function AdminCharts({ weeklyData }: AdminChartsProps) {
  if (weeklyData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted">
        No data available yet
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Revenue Chart */}
      <div className="rounded-xl bg-surface p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-primary mb-4">Weekly Revenue</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklyData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis 
                dataKey="week" 
                tick={{ fontSize: 12, fill: "#6b7280" }}
                tickLine={false}
              />
              <YAxis 
                tick={{ fontSize: 12, fill: "#6b7280" }}
                tickLine={false}
                tickFormatter={(value) => `£${value}`}
              />
              <Tooltip 
                formatter={(value) => [`£${Number(value).toFixed(2)}`, "Revenue"]}
                contentStyle={{ 
                  backgroundColor: "#fff", 
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                  fontSize: "14px"
                }}
              />
              <Bar 
                dataKey="revenue" 
                fill="#A9B67C" 
                radius={[4, 4, 0, 0]}
                name="Revenue"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Orders Chart */}
      <div className="rounded-xl bg-surface p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-primary mb-4">Weekly Orders</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklyData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis 
                dataKey="week" 
                tick={{ fontSize: 12, fill: "#6b7280" }}
                tickLine={false}
              />
              <YAxis 
                tick={{ fontSize: 12, fill: "#6b7280" }}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip 
                formatter={(value) => [value, "Orders"]}
                contentStyle={{ 
                  backgroundColor: "#fff", 
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                  fontSize: "14px"
                }}
              />
              <Bar 
                dataKey="orders" 
                fill="#A30E4E" 
                radius={[4, 4, 0, 0]}
                name="Orders"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
