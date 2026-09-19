import { useEffect, useRef } from 'react';
import { createChart, ColorType, CandlestickSeries, type IChartApi, type ISeriesApi } from 'lightweight-charts';
import type { CandleData } from '../types';

interface Props {
  candles: CandleData[];
  isDarkTheme?: boolean;
}

export default function AdvancedChart({ candles, isDarkTheme = true }: Props) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const handleResize = () => {
      if (chartRef.current && chartContainerRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    const chartOptions = {
      layout: {
        textColor: isDarkTheme ? '#d1d4dc' : '#191919',
        background: { type: ColorType.Solid, color: 'transparent' },
      },
      grid: {
        vertLines: { color: isDarkTheme ? '#2B2B43' : '#e1e1e1' },
        horzLines: { color: isDarkTheme ? '#2B2B43' : '#e1e1e1' },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        mode: 1, // Normal crosshair
      },
    };

    const chart = createChart(chartContainerRef.current, chartOptions);
    chartRef.current = chart;

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });
    seriesRef.current = candlestickSeries;

    // Use a fixed base date to construct realistic looking intraday timestamps
    const baseTime = Math.floor(new Date('2024-01-01T09:30:00Z').getTime() / 1000);

    const formattedData = candles.map((c) => ({
      time: (baseTime + c.tick * 60) as any,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    candlestickSeries.setData(formattedData);
    chart.timeScale().fitContent();

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [isDarkTheme]);

  // Update data when candles change
  useEffect(() => {
    if (!seriesRef.current || candles.length === 0) return;
    const baseTime = Math.floor(new Date('2024-01-01T09:30:00Z').getTime() / 1000);
    const lastCandle = candles[candles.length - 1];
    
    seriesRef.current.update({
      time: (baseTime + lastCandle.tick * 60) as any,
      open: lastCandle.open,
      high: lastCandle.high,
      low: lastCandle.low,
      close: lastCandle.close,
    });
  }, [candles]);

  return <div ref={chartContainerRef} style={{ width: '100%', height: '100%' }} />;
}
