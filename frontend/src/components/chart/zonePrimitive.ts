import type {
  IChartApi,
  ISeriesApi,
  ISeriesPrimitive,
  SeriesAttachedParameter,
  Time,
  UTCTimestamp,
} from 'lightweight-charts';
import type { Zone } from '../../types/analysis';

interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
  fill: string;
  border: string;
  color: string;
  label: string;
}

class ZoneRenderer {
  constructor(private boxes: Box[]) {}

  // target is a CanvasRenderingTarget2D from lightweight-charts.
  draw(target: {
    useBitmapCoordinateSpace: (
      cb: (scope: {
        context: CanvasRenderingContext2D;
        horizontalPixelRatio: number;
        verticalPixelRatio: number;
      }) => void,
    ) => void;
  }) {
    target.useBitmapCoordinateSpace(({ context: ctx, horizontalPixelRatio: hr, verticalPixelRatio: vr }) => {
      for (const b of this.boxes) {
        const left = b.left * hr;
        const top = b.top * vr;
        const w = (b.right - b.left) * hr;
        const h = (b.bottom - b.top) * vr;
        ctx.fillStyle = b.fill;
        ctx.fillRect(left, top, w, h);
        ctx.strokeStyle = b.border;
        ctx.lineWidth = 1;
        ctx.strokeRect(left, top, w, h);
        ctx.fillStyle = b.color;
        ctx.font = `700 ${9 * vr}px Inter, system-ui, sans-serif`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        ctx.fillText(b.label, b.right * hr - 4 * hr, top + 2 * vr);
      }
    });
  }
}

class ZonePaneView {
  private boxes: Box[] = [];
  constructor(private source: ZonesPrimitive) {}

  update() {
    this.boxes = [];
    const { chart, series, zones, enabled } = this.source;
    if (!chart || !series || !enabled) return;

    const ts = chart.timeScale();
    const width = ts.width();
    for (const z of zones) {
      const y1 = series.priceToCoordinate(z.top);
      const y2 = series.priceToCoordinate(z.bottom);
      if (y1 == null || y2 == null) continue;

      const x1 = ts.timeToCoordinate(z.start_time as UTCTimestamp) ?? 0;
      const x2 = ts.timeToCoordinate(z.end_time as UTCTimestamp) ?? width;
      const bull = z.direction === 'bullish';
      const rgb = bull ? '32,170,110' : '229,72,77';
      const fill = 0.07 + Math.min(Math.max(z.strength, 0), 100) / 100 * 0.16;
      const short = z.kind === 'order_block' ? 'OB' : 'FVG';

      this.boxes.push({
        left: Math.max(0, Math.min(x1, x2)),
        right: Math.min(Math.max(x1, x2), width),
        top: Math.min(y1, y2),
        bottom: Math.max(y1, y2),
        fill: `rgba(${rgb},${fill})`,
        border: `rgba(${rgb},0.55)`,
        color: bull ? '#178A58' : '#C93B40',
        label: `${z.fresh ? '● ' : ''}${short} ${z.strength}`,
      });
    }
  }

  renderer() {
    return new ZoneRenderer(this.boxes);
  }
}

export class ZonesPrimitive implements ISeriesPrimitive<Time> {
  chart?: IChartApi;
  series?: ISeriesApi<'Candlestick'>;
  zones: Zone[] = [];
  enabled = true;
  private _paneView = new ZonePaneView(this);
  private _requestUpdate?: () => void;

  attached(param: SeriesAttachedParameter<Time>): void {
    this.chart = param.chart;
    this.series = param.series as ISeriesApi<'Candlestick'>;
    this._requestUpdate = param.requestUpdate;
  }

  detached(): void {
    this.chart = undefined;
    this.series = undefined;
    this._requestUpdate = undefined;
  }

  updateAllViews(): void {
    this._paneView.update();
  }

  paneViews() {
    return [this._paneView];
  }

  setData(zones: Zone[], enabled: boolean): void {
    this.zones = zones;
    this.enabled = enabled;
    this._requestUpdate?.();
  }
}
