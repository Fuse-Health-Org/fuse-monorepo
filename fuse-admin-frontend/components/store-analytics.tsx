"use client"

import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronDown } from "lucide-react"
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts"
import { useAuth } from '@/contexts/AuthContext';

interface StoreAnalyticsProps {
  startDate: Date;
  endDate: Date;
  onMockDataStatusChange?: (isUsingMockData: boolean) => void;
}

type ViewMode = 'revenue' | 'orders';

interface ChartDataPoint {
  date: string;
  revenue: number;
  orders: number;
  projectedRevenue?: number;
  isProjection?: boolean;
}

const formatDateToIso = (date: Date) => {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const hasRealChartData = (points: ChartDataPoint[]) => {
  if (!points.length) return false;
  return points.some((point) => (point.revenue ?? 0) > 0 || (point.orders ?? 0) > 0 || (point.projectedRevenue ?? 0) > 0);
};

const buildMockChartData = (startDate: Date, endDate: Date) => {
  const mockData: ChartDataPoint[] = [];
  const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const lastDate = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
  let index = 0;

  while (cursor <= lastDate) {
    const dayOfWeek = cursor.getDay(); // 0=Sun, 6=Sat
    const dayOfMonth = cursor.getDate();

    // Keep mock values deterministic by deriving pseudo-noise from date/index.
    const seed = cursor.getFullYear() * 10000 + (cursor.getMonth() + 1) * 100 + dayOfMonth + index * 13;
    const pseudoNoise = ((Math.sin(seed) + 1) / 2) * 2 - 1; // -1..1

    // Progressive growth plus weekly seasonality.
    const trend = Math.min(index * 7, 220);
    const weeklySeasonality = Math.sin((index / 7) * Math.PI * 2) * 110;

    // Weekends are usually softer in this type of store.
    const weekendFactor = dayOfWeek === 0 || dayOfWeek === 6 ? 0.78 : 1;

    // Small realistic spikes around common purchase/pay cycle dates.
    const paydaySpike = dayOfMonth === 1 || dayOfMonth === 15 || dayOfMonth === 28 ? 150 : 0;

    const rawRevenue = (680 + trend + weeklySeasonality + pseudoNoise * 95 + paydaySpike) * weekendFactor;
    const revenue = Math.max(220, Math.round(rawRevenue));

    // Keep orders correlated with revenue, but not perfectly linear.
    const orderBase = revenue / 125;
    const orderNoise = ((Math.sin(seed * 0.37) + 1) / 2) * 2.4;
    const orders = Math.max(3, Math.round(orderBase + orderNoise));

    mockData.push({
      date: formatDateToIso(cursor),
      revenue,
      orders,
      isProjection: false,
    });
    cursor.setDate(cursor.getDate() + 1);
    index += 1;
  }

  return mockData;
};

export function StoreAnalytics({ startDate, endDate, onMockDataStatusChange }: StoreAnalyticsProps) {
  const { user, authenticatedFetch } = useAuth();
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('revenue');
  const [isUsingMockData, setIsUsingMockData] = useState(false);
  
  // Determine if this is "This Month" view - use today as the end date for historical data
  const { todayEnd, isThisMonth, daysRemainingInMonth } = useMemo(() => {
    const now = new Date();
    // Set time to end of today for proper comparison
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    
    const isThisMonth = 
      startDate.getFullYear() === now.getFullYear() && 
      startDate.getMonth() === now.getMonth() && 
      startDate.getDate() === 1 && 
      endDate >= todayEnd;
    
    const daysRemainingInMonth = isThisMonth 
      ? Math.ceil((endDate.getTime() - todayEnd.getTime()) / (1000 * 60 * 60 * 24))
      : 0;
    
    return { todayEnd, isThisMonth, daysRemainingInMonth };
  }, [startDate, endDate]);

  // Check if viewing a complete calendar month OR if it's "This Month" (starts on day 1)
  // This Month is treated like a full calendar month for consistent display
  const isFullCalendarMonth = 
    startDate.getDate() === 1 && 
    (endDate.getDate() === new Date(endDate.getFullYear(), endDate.getMonth() + 1, 0).getDate() || isThisMonth);

  // Determine interval based on date range
  const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  // For full calendar months (like "Last Month" or "This Month"), always use daily to show complete month
  // Otherwise use daily for <= 14 days, weekly for longer periods
  const interval = isFullCalendarMonth ? 'daily' : (daysDiff <= 14 ? 'daily' : 'weekly');

  useEffect(() => {
    onMockDataStatusChange?.(isUsingMockData);
  }, [isUsingMockData, onMockDataStatusChange]);

  useEffect(() => {
    const fetchChartData = async () => {
      if (!user?.clinicId) {
        setChartData(buildMockChartData(startDate, endDate));
        setIsUsingMockData(true);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        // Fetch historical data (for This Month: from start to today; otherwise full range)
        const fetchEndDate = isThisMonth ? todayEnd : endDate;
        
        const response = await authenticatedFetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/dashboard/revenue-chart?` +
          `clinicId=${user.clinicId}&` +
          `startDate=${startDate.toISOString()}&` +
          `endDate=${fetchEndDate.toISOString()}&` +
          `interval=${interval}`,
          {
            headers: {
              'Content-Type': 'application/json'
            }
          }
        );

        if (!response.ok) {
          setChartData(buildMockChartData(startDate, endDate));
          setIsUsingMockData(true);
          setLoading(false);
          return;
        }

        const data = await response.json();
        
        if (!data.success) {
          setChartData(buildMockChartData(startDate, endDate));
          setIsUsingMockData(true);
          setLoading(false);
          return;
        }

        let historical = data.data.map((point: any) => ({
          ...point,
          isProjection: false
        }));

        if (!hasRealChartData(historical)) {
          setChartData(buildMockChartData(startDate, endDate));
          setIsUsingMockData(true);
          setLoading(false);
          return;
        }

        // Fetch projected subscription renewals for "This Month" future dates
        if (isThisMonth && daysRemainingInMonth > 0) {
          const projectedResponse = await authenticatedFetch(
            `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/dashboard/projected-revenue?` +
            `clinicId=${user.clinicId}&` +
            `endDate=${todayEnd.toISOString()}&` +
            `daysToProject=${daysRemainingInMonth}`,
            {
              headers: {
                'Content-Type': 'application/json'
              }
            }
          );

          if (projectedResponse.ok) {
            const projectedData = await projectedResponse.json();
            
            if (projectedData.success) {
              const projected = projectedData.data.map((point: any) => ({
                date: point.date,
                revenue: 0,
                orders: 0,
                projectedRevenue: point.projectedRevenue,
                isProjection: true
              }));

              setChartData([...historical, ...projected]);
              setIsUsingMockData(false);
            } else {
              setChartData(historical);
              setIsUsingMockData(false);
            }
          } else {
            setChartData(historical);
            setIsUsingMockData(false);
          }
        } else {
          setChartData(historical);
          setIsUsingMockData(false);
        }
      } catch (err) {
        // If it's an unauthorized error, the user will be redirected by authenticatedFetch
        if ((err as Error).message === 'unauthorized') {
          return;
        }
        console.error('Error fetching chart data:', err);
        setChartData(buildMockChartData(startDate, endDate));
        setIsUsingMockData(true);
      } finally {
        setLoading(false);
      }
    };

    fetchChartData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.clinicId, authenticatedFetch, startDate, endDate, interval, isThisMonth, daysRemainingInMonth]);

  const formatDate = (dateStr: string) => {
    // Parse YYYY-MM-DD as local date to avoid timezone shifts
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(1)}K`;
    }
    return `$${value}`;
  };

  // Don't aggregate data - keep all daily data points for hover tooltips
  // We'll control x-axis labels separately to keep it clean
  let processedData = chartData;

  // Format data for the chart with separate historical and projected values
  const hasAnyProjections = processedData.some(point => point.isProjection);
  
  const formattedData = processedData.map((point, index) => {
    const isHistorical = !point.isProjection;
    const isProjected = point.isProjection;
    
    // Separate historical and projected into different dataKeys for different line styles
    const historicalValue = isHistorical 
      ? (viewMode === 'revenue' ? point.revenue : point.orders) 
      : null;
    const projectedValue = (isProjected && viewMode === 'revenue') 
      ? (point.projectedRevenue || 0) 
      : null;
    
    return {
      ...point,
      name: formatDate(point.date),
      historicalValue,
      projectedValue,
      isHistorical,
      isProjected,
      index: index
    };
  });

  // X-axis ticks: Show all for short ranges, every 3rd for month views
  const customTicks = (() => {
    if (daysDiff <= 14) {
      // Show all days for short date ranges (Last 7 Days, etc.)
      return formattedData.map(point => point.name);
    } else if (isFullCalendarMonth) {
      // For month views: show day 1, 4, 7, 10, 13, 16, 19, 22, 25, 28, and last day
      return formattedData.reduce((acc: string[], point, index) => {
        const isFirst = index === 0;
        const isLast = index === formattedData.length - 1;
        const isEveryThird = index % 3 === 0;
        
        if (isFirst || isLast || isEveryThird) {
          acc.push(point.name);
        }
        
        return acc;
      }, []);
    } else {
      // For other ranges, show every 3rd day
      return formattedData.reduce((acc: string[], point, index) => {
        const isFirst = index === 0;
        const isLast = index === formattedData.length - 1;
        const isEveryThird = index % 3 === 0;
        
        if (isFirst || isLast || isEveryThird) {
          acc.push(point.name);
        }
        
        return acc;
      }, []);
    }
  })();

  // Calculate Y-axis domain based on highest value (including projected)
  const calculateYAxisDomain = () => {
    if (formattedData.length === 0) return { max: 100, ticks: [0, 25, 50, 75, 100] };
    
    // Find max value from both historical and projected data
    const maxValue = Math.max(
      ...formattedData.map(point => Math.max(
        point.historicalValue || 0,
        point.projectedValue || 0
      ))
    );
    
    // Round up to nearest 100 for revenue, or nearest 10 for orders
    const roundTo = viewMode === 'revenue' ? 100 : 10;
    const roundedMax = Math.ceil(maxValue / roundTo) * roundTo;
    
    // If rounded max is 0, set a minimum
    const finalMax = roundedMax === 0 ? roundTo : roundedMax;
    
    // Calculate 5 evenly spaced ticks (0, 1/4, 2/4, 3/4, 4/4)
    const ticks = [
      0,
      Math.round(finalMax * 0.25),
      Math.round(finalMax * 0.5),
      Math.round(finalMax * 0.75),
      finalMax
    ];
    
    return { max: finalMax, ticks };
  };
  
  const yAxisConfig = calculateYAxisDomain();

  return (
    <Card className="bg-card border-border shadow-apple-md">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-xl font-semibold text-foreground">Store Analytics</CardTitle>
        </div>
        <div className="flex gap-2">
          <Button 
            variant={viewMode === 'revenue' ? 'default' : 'outline'} 
            size="sm"
            onClick={() => setViewMode('revenue')}
            className="transition-smooth"
          >
            Revenue
          </Button>
          <Button 
            variant={viewMode === 'orders' ? 'default' : 'outline'} 
            size="sm"
            onClick={() => setViewMode('orders')}
            className="transition-smooth"
          >
            Orders
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-80 flex items-center justify-center">
            <div className="animate-pulse text-muted-foreground">Loading chart data...</div>
          </div>
        ) : formattedData.length === 0 ? (
          <div className="h-80 flex items-center justify-center">
            <div className="text-muted-foreground">No data available for this period</div>
          </div>
        ) : (
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={formattedData}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(270, 80%, 65%)" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="hsl(280, 75%, 72%)" stopOpacity={0.1}/>
                  </linearGradient>
                  <linearGradient id="colorProjected" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(0, 0%, 60%)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(0, 0%, 60%)" stopOpacity={0.05}/>
                  </linearGradient>
                </defs>
                <CartesianGrid 
                  strokeDasharray="3 3" 
                  stroke="hsl(var(--border))" 
                  vertical={false}
                  strokeOpacity={0.3}
                />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))", opacity: 0.7 }}
                  ticks={customTicks}
                  angle={0}
                  height={40}
                  dy={10}
                />
                <YAxis
                  domain={[0, yAxisConfig.max]}
                  ticks={yAxisConfig.ticks}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))", opacity: 0.7 }}
                  tickFormatter={viewMode === 'revenue' ? formatCurrency : (value) => value.toString()}
                  dx={-10}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '12px',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                    padding: '12px'
                  }}
                  formatter={(value: number, name: string) => {
                    if (name === 'projectedValue') {
                      return [
                        formatCurrency(value),
                        'Expected'
                      ];
                    }
                    return [
                      viewMode === 'revenue' ? formatCurrency(value) : value,
                      viewMode === 'revenue' ? 'Revenue' : 'Orders'
                    ];
                  }}
                  labelStyle={{ fontWeight: 600, marginBottom: '4px' }}
                />
                {/* Historical Data Area */}
                <Area
                  type="monotone"
                  dataKey="historicalValue"
                  stroke="hsl(270, 80%, 65%)"
                  strokeWidth={3}
                  fill="url(#colorRevenue)"
                  dot={false}
                  activeDot={{ r: 5, fill: "hsl(270, 80%, 65%)", stroke: "white", strokeWidth: 2 }}
                  connectNulls={false}
                  name="historicalValue"
                />
                {/* Projected Revenue Area (only in revenue mode for "This Month") */}
                {viewMode === 'revenue' && isThisMonth && daysRemainingInMonth > 0 && (
                  <Area
                    type="monotone"
                    dataKey="projectedValue"
                    stroke="hsl(0, 0%, 50%)"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    fill="url(#colorProjected)"
                    dot={false}
                    activeDot={{ r: 4, fill: "hsl(0, 0%, 50%)", stroke: "white", strokeWidth: 2 }}
                    connectNulls={false}
                    name="projectedValue"
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}