import { useState, useEffect, useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import {
  fetchExceptionDetail,
  fetchExceptionTimeseries,
  type ExceptionDetail as ExceptionDetailData,
  type ExceptionBucket,
} from "@/lib/api";
import TimeRangeSelector, { type TimeRange, rangeToMinutes, rangeToInterval, SHORT_RANGES, rangeToIntervalMinutes } from "@/components/TimeRangeSelector";
import { useGlobalTimeRange } from "@/lib/timeRange";
import { status, serviceColor } from "@/lib/colors";
import { axisTick, fullTimestamp, spanMinutes } from "@/lib/chartTime";
import CopyButton from "@/components/CopyButton";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel p-4">
      <div className="data-label">{label}</div>
      <div className="text-lg font-mono font-medium mt-1 truncate">{value}</div>
    </div>
  );
}

function fmtTime(ts: string) {
  return new Date(ts).toLocaleString("en-US", {
    month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  });
}

export default function ExceptionDetail() {
  const { fingerprint } = useParams();
  const [detail, setDetail] = useState<ExceptionDetailData | null>(null);
  const [buckets, setBuckets] = useState<ExceptionBucket[]>([]);
  const [loading, setLoading] = useState(true);
  const { range, setRange } = useGlobalTimeRange();

  const load = useCallback(() => {
    if (!fingerprint) return;
    const minutes = rangeToMinutes(range);
    Promise.all([
      fetchExceptionDetail(fingerprint, minutes).then(setDetail),
      fetchExceptionTimeseries(fingerprint, minutes, rangeToIntervalMinutes(range)).then(setBuckets),
    ]).finally(() => setLoading(false));
  }, [fingerprint, range]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading exception...</div>;
  if (!detail) return <div className="p-6 text-sm text-muted-foreground">Exception not found in this time range.</div>;

  const chartData = buckets.map((b) => ({ tms: new Date(b.timestamp).getTime(), count: b.count }));
  const chartSpan = spanMinutes(buckets.map((b) => ({ timestamp: b.timestamp })));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Link to="/app/errors" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-3.5 h-3.5" />
            Errors
          </Link>
          <div className="flex items-center gap-2.5 mt-2 min-w-0">
            <h1 className="text-xl font-medium tracking-tight font-mono text-status-error truncate">{detail.type}</h1>
            <CopyButton text={detail.fingerprint} label="fingerprint" />
          </div>
          <p className="text-sm text-muted-foreground mt-1 break-words">{detail.message || "(no message)"}</p>
        </div>
        <TimeRangeSelector value={range} onChange={setRange} ranges={SHORT_RANGES} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Occurrences" value={detail.occurrences.toLocaleString()} />
        <div className="panel p-4">
          <div className="data-label">Service</div>
          <Link to={`/app/services/${encodeURIComponent(detail.service)}`} className="inline-flex items-center gap-1.5 text-lg font-mono font-medium mt-1 hover:underline">
            <span className="w-2 h-2 rounded-full" style={{ background: serviceColor(detail.service) }} />
            {detail.service}
          </Link>
        </div>
        <Stat label="First seen" value={fmtTime(detail.first_seen)} />
        <Stat label="Last seen" value={fmtTime(detail.last_seen)} />
      </div>

      <div className="panel p-5">
        <div className="data-label mb-4">Frequency</div>
        {chartData.length === 0 ? (
          <p className="text-sm text-muted-foreground">No occurrences in this time range.</p>
        ) : (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="tms" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} minTickGap={44} tickFormatter={(v) => axisTick(v, chartSpan)} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} allowDecimals={false} width={32} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 4, fontSize: 11 }}
                  labelFormatter={(v) => fullTimestamp(Number(v))}
                />
                <Bar dataKey="count" fill={status.error} radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="panel p-5 min-w-0">
          <div className="flex items-center justify-between mb-3">
            <div className="data-label">Stack trace</div>
            {detail.stacktrace && <CopyButton text={detail.stacktrace} label="stack" />}
          </div>
          {detail.stacktrace ? (
            <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap break-words max-h-96 overflow-y-auto leading-relaxed">
              {detail.stacktrace}
            </pre>
          ) : (
            <p className="text-sm text-muted-foreground">No stack trace captured.</p>
          )}
        </div>

        <div className="panel p-5">
          <div className="data-label mb-3">Recent traces</div>
          {detail.trace_ids.length === 0 ? (
            <p className="text-sm text-muted-foreground">No linked traces.</p>
          ) : (
            <div className="space-y-1.5">
              {detail.trace_ids.map((tid) => (
                <Link
                  key={tid}
                  to={`/app/traces/${tid}`}
                  className="block font-mono text-xs text-status-info hover:underline truncate"
                >
                  {tid}
                </Link>
              ))}
            </div>
          )}
          {detail.route && (
            <div className="mt-4">
              <div className="data-label mb-1.5">Route</div>
              <span className="font-mono text-xs">{detail.route}</span>
            </div>
          )}
          {detail.environment && (
            <div className="mt-4">
              <div className="data-label mb-1.5">Environment</div>
              <span className="font-mono text-xs">{detail.environment}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
