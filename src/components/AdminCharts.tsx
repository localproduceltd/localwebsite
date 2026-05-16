"use client";

import { ComposedChart, BarChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface DeliveryDayData {
  date: string;
  revenue: number;
  orders: number;
  avgBasket: number;
}

interface AdminChartsProps {
  deliveryDayData: DeliveryDayData[];
}

export default function AdminCharts({ deliveryDayData }: AdminChartsProps) {
  if (deliveryDayData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted">
        No data available yet
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Revenue + Avg Basket Chart */}
      <div className="rounded-xl bg-surface p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-primary mb-4">Revenue per Delivery Day</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={deliveryDayData} margin={{ top: 5, right: 50, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 11, fill: "#6b7280" }}
                tickLine={false}
              />
              <YAxis 
                yAxisId="left"
                tick={{ fontSize: 12, fill: "#6b7280" }}
                tickLine={false}
                tickFormatter={(value) => `£${value}`}
              />
              <YAxis 
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 12, fill: "#A30E4E" }}
                tickLine={false}
                tickFormatter={(value) => `£${value}`}
              />
              <Tooltip 
                formatter={(value, name) => {
                  if (name === "Revenue") return [`£${Number(value).toFixed(2)}`, "Revenue"];
                  if (name === "Avg Basket") return [`£${Number(value).toFixed(2)}`, "Avg Basket"];
                  return [value, name];
                }}
                contentStyle={{ 
                  backgroundColor: "#fff", 
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                  fontSize: "14px"
                }}
              />
              <Legend />
              <Bar 
                yAxisId="left"
                dataKey="revenue" 
                fill="#A9B67C" 
                radius={[4, 4, 0, 0]}
                name="Revenue"
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="avgBasket"
                stroke="#A30E4E"
                strokeWidth={2}
                dot={{ fill: "#A30E4E", r: 4 }}
                name="Avg Basket"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Orders Chart */}
      <div className="rounded-xl bg-surface p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-primary mb-4">Orders per Delivery Day</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={deliveryDayData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 11, fill: "#6b7280" }}
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
