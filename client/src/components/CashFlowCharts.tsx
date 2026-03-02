import React, { useMemo } from 'react';
import { BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface CashFlowData {
  projectName: string;
  totalRevenue: number;
  totalCosts: number;
  profit: number;
  fundingRequired: number;
  comoProfit: number;
  investorProfit: number;
  profitMargin: number;
  roi: number;
}

interface CashFlowChartsProps {
  data: CashFlowData;
}

const COLORS = ['#ef4444', '#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899'];

export function CashFlowCharts({ data }: CashFlowChartsProps) {
  const summaryData = useMemo(() => [
    { name: 'الإيرادات', value: data.totalRevenue },
    { name: 'التكاليف', value: data.totalCosts },
  ], [data]);

  const profitData = useMemo(() => [
    { name: 'ربح COMO', value: data.comoProfit },
    { name: 'ربح المستثمر', value: data.investorProfit },
  ], [data]);

  const monthlyData = useMemo(() => {
    const months = ['شهر 1', 'شهر 2', 'شهر 3', 'شهر 4', 'شهر 5', 'شهر 6'];
    const monthlyRevenue = data.totalRevenue / 6;
    const monthlyCosts = data.totalCosts / 6;
    return months.map(month => ({
      month,
      إيرادات: Math.round(monthlyRevenue),
      تكاليف: Math.round(monthlyCosts),
      صافي: Math.round(monthlyRevenue - monthlyCosts),
    }));
  }, [data]);

  const formatCurrency = (value: number) => {
    return `د.إ ${(value / 1000000).toFixed(1)}M`;
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">إجمالي الإيرادات</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(data.totalRevenue)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">إجمالي التكاليف</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatCurrency(data.totalCosts)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">الربح الكلي</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{formatCurrency(data.profit)}</div>
            <p className="text-xs text-muted-foreground mt-1">{data.profitMargin.toFixed(1)}% هامش</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">ROI</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{data.roi.toFixed(1)}%</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue vs Costs */}
        <Card>
          <CardHeader>
            <CardTitle>الإيرادات مقابل التكاليف</CardTitle>
            <CardDescription>مقارنة شاملة للإيرادات والتكاليف</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={summaryData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value) => formatCurrency(value as number)} />
                <Bar dataKey="value" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Profit Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>توزيع الربح</CardTitle>
            <CardDescription>حصة COMO والمستثمر من الربح</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={profitData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${formatCurrency(value)}`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {profitData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(value as number)} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Monthly Cash Flow */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>التدفق النقدي الشهري</CardTitle>
            <CardDescription>توقعات التدفق النقدي على مدى 6 أشهر</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => formatCurrency(value as number)} />
                <Legend />
                <Line type="monotone" dataKey="إيرادات" stroke="#10b981" strokeWidth={2} />
                <Line type="monotone" dataKey="تكاليف" stroke="#ef4444" strokeWidth={2} />
                <Line type="monotone" dataKey="صافي" stroke="#3b82f6" strokeWidth={2} strokeDasharray="5 5" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
