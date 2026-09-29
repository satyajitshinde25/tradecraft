/* ── AdvancedChart — Wall Street Candlestick Trading Terminal ── */
import { useEffect, useRef } from 'react';
import { createChart, ColorType, CandlestickSeries, type IChartApi, type ISeriesApi } from 'lightweight-charts';
import type { CandleData } from '../types';

interface Props {
  candles: CandleData[];
  isDarkTheme?: boolean;
}

export default function AdvancedChart({ candles }: Props) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const handleResize = () => {
      if (chartRef.current && chartContainerRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight
        });
      }
    };

    const chartOptions = {
      layout: {
        textColor: '#9BA3AF',
        background: { type: ColorType.Solid, color: '#0C1017' },
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(30, 38, 54, 0.45)' },
        horzLines: { color: 'rgba(30, 38, 54, 0.45)' },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: '#1E2636',
      },
      rightPriceScale: {
        borderColor: '#1E2636',
        scaleMargins: {
          top: 0.12,
          bottom: 0.12,
        },
      },
      crosshair: {
        vertLine: {
          color: 'rgba(197, 160, 89, 0.6)',
          width: 1 as any,
          style: 3,
        },
        horzLine: {
          color: 'rgba(197, 160, 89, 0.6)',
          width: 1 as any,
          style: 3,
        },
      },
    };

    const chart = createChart(chartContainerRef.current, chartOptions);
    chartRef.current = chart;

    // The Wolf's Den: Emerald (#12A169) & Oxblood (#D9383A)
    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#12A169',
      downColor: '#D9383A',
      borderVisible: true,
      borderColor: '#12A169',
      borderUpColor: '#12A169',
      borderDownColor: '#D9383A',
      wickUpColor: '#12A169',
      wickDownColor: '#D9383A',
    });
    seriesRef.current = candlestickSeries;

    const baseTime = Math.floor(new Date('2024-01-01T09:30:00Z').getTime() / 1000);

    const formattedData = (candles || []).map((c) => ({
      time: (baseTime + c.tick * 60) as any,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    if (formattedData.length > 0) {
      candlestickSeries.setData(formattedData);
      chart.timeScale().fitContent();
    }

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []);

  // Update data when candles update
  useEffect(() => {
    if (!seriesRef.current || !candles || candles.length === 0) return;
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
