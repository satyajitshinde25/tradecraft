import { useEffect, useRef } from 'react';
import { createChart, ColorType, CandlestickSeries, type IChartApi, type ISeriesApi } from 'lightweight-charts';
import type { CandleData } from '../types';

interface Props {
  candles: CandleData[];
  ticker?: string;
  isDarkTheme?: boolean;
}

export default function AdvancedChart({ candles, ticker = '', isDarkTheme = true }: Props) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  // Initialize Chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const container = chartContainerRef.current;
    const initialWidth = container.clientWidth || 600;
    const initialHeight = container.clientHeight || 420;

    const chart = createChart(container, {
      width: initialWidth,
      height: initialHeight,
      layout: {
        textColor: isDarkTheme ? '#c5beaf' : '#191919',
        background: { type: ColorType.Solid, color: 'transparent' },
        fontFamily: "'JetBrains Mono', 'Inter', monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: isDarkTheme ? 'rgba(217, 180, 119, 0.07)' : '#e1e1e1' },
        horzLines: { color: isDarkTheme ? 'rgba(217, 180, 119, 0.07)' : '#e1e1e1' },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        barSpacing: 22,
        minBarSpacing: 4,
        rightOffset: 8,
        borderColor: 'rgba(217, 180, 119, 0.2)',
      },
      crosshair: {
        mode: 1, // Magnet crosshair
        vertLine: {
          color: 'rgba(217, 180, 119, 0.4)',
          width: 1,
          style: 3,
        },
        horzLine: {
          color: 'rgba(217, 180, 119, 0.4)',
          width: 1,
          style: 3,
        },
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      handleScale: {
        axisPressedMouseMove: {
          time: true,
          price: true,
        },
        mouseWheel: true,
        pinch: true,
      },
    });

    chartRef.current = chart;

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#f43f5e',
      borderVisible: true,
      borderUpColor: '#10b981',
      borderDownColor: '#f43f5e',
      wickVisible: true,
      wickUpColor: '#10b981',
      wickDownColor: '#f43f5e',
      priceFormat: {
        type: 'price',
        precision: 2,
        minMove: 0.01,
      },
    });
    seriesRef.current = candlestickSeries;

    // Use ResizeObserver for responsive width & height tracking
    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0 || !chartRef.current) return;
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) {
        chartRef.current.applyOptions({ width, height });
      }
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [isDarkTheme]);

  // Sync candle data on ticker change or candle history updates
  useEffect(() => {
    if (!seriesRef.current || !chartRef.current) return;

    if (!candles || candles.length === 0) {
      seriesRef.current.setData([]);
      return;
    }

    // Sort and deduplicate candles by tick to avoid lightweight-charts sorting errors
    const sorted = [...candles].sort((a, b) => a.tick - b.tick);
    const uniqueCandles: CandleData[] = [];
    const seenTicks = new Set<number>();
    for (const c of sorted) {
      if (!seenTicks.has(c.tick)) {
        seenTicks.add(c.tick);
        uniqueCandles.push(c);
      }
    }

    const baseTime = Math.floor(new Date('2024-01-01T09:30:00Z').getTime() / 1000);
    const formattedData = uniqueCandles.map((c) => ({
      time: (baseTime + c.tick * 60) as any,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    seriesRef.current.setData(formattedData);
    chartRef.current.timeScale().fitContent();
  }, [candles, ticker]);

  // Smooth Zoom In handler
  const handleZoomIn = () => {
    if (!chartRef.current) return;
    const timeScale = chartRef.current.timeScale();
    const currentOptions = timeScale.options();
    const currentSpacing = currentOptions.barSpacing || 20;
    timeScale.applyOptions({ barSpacing: Math.min(80, currentSpacing * 1.35) });
  };

  // Smooth Zoom Out handler
  const handleZoomOut = () => {
    if (!chartRef.current) return;
    const timeScale = chartRef.current.timeScale();
    const currentOptions = timeScale.options();
    const currentSpacing = currentOptions.barSpacing || 20;
    timeScale.applyOptions({ barSpacing: Math.max(4, currentSpacing * 0.75) });
  };

  // Reset / Fit Content handler
  const handleResetView = () => {
    if (!chartRef.current) return;
    chartRef.current.timeScale().fitContent();
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* Chart interactive zoom toolbar */}
      <div className="chart-toolbar">
        <button
          type="button"
          className="chart-tool-btn"
          onClick={handleZoomIn}
          title="Zoom In (or scroll up on chart)"
        >
          +
        </button>
        <button
          type="button"
          className="chart-tool-btn"
          onClick={handleZoomOut}
          title="Zoom Out (or scroll down on chart)"
        >
          −
        </button>
        <button
          type="button"
          className="chart-tool-btn chart-tool-fit"
          onClick={handleResetView}
          title="Fit Candles to Screen"
        >
          ⟲ FIT
        </button>
      </div>

      <div ref={chartContainerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
