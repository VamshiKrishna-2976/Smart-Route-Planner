import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, BusFront, Clock3, MapPin, Route as RouteIcon, TrainFront, TramFront } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { apiErrorMessage, getAdminSummary, getServices, updateService } from "../api";
import { PageHeading } from "../components/Layout";
import type { Service } from "../types";

const modeColors: Record<string, string> = { Metro: "#287852", Bus: "#dda050", Train: "#7081c1" };
const controlPresets = [
  { id: "normal", label: "Normal" },
  { id: "delay10", label: "10 min delay" },
  { id: "delay15", label: "15 min delay" },
  { id: "delay20", label: "20 min delay" },
  { id: "suspended", label: "Suspend service" },
] as const;

export function AdminPage() {
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof getAdminSummary>> | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [presetSelections, setPresetSelections] = useState<Record<number, typeof controlPresets[number]["id"]>>({});

  const load = useCallback(async () => {
    try {
      const [nextSummary, nextServices] = await Promise.all([getAdminSummary(), getServices()]);
      setSummary(nextSummary);
      setServices(nextServices);
      setError("");
    } catch (reason) {
      setError(apiErrorMessage(reason, "Dashboard data couldn’t be loaded. Check the API connection."));
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(load, 5000);
    return () => window.clearInterval(timer);
  }, [load]);

  const journeyChart = useMemo(() => {
    const counts = new Map((summary?.journeyVolume ?? []).map((entry) => [entry.day, entry.count]));
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - index));
      const key = date.toISOString().slice(0, 10);
      return { day: date.toLocaleDateString([], { weekday: "short" }), journeys: counts.get(key) ?? 0 };
    });
  }, [summary?.journeyVolume]);

  async function applyServicePreset(service: Service) {
    const preset = presetSelections[service.id] ?? "normal";
    setSavingId(service.id);
    setMessage("");
    try {
      const updated = await updateService(service.id, preset);
      setServices((items) => items.map((item) => item.id === updated.id ? updated : item));
      const descriptions: Record<typeof preset, string> = {
        normal: `${updated.name} is back on time.`,
        delay10: `${updated.name} is now delayed by 10 minutes.`,
        delay15: `${updated.name} is now delayed by 15 minutes.`,
        delay20: `${updated.name} is now delayed by 20 minutes.`,
        suspended: `${updated.name} has been suspended.`,
      };
      setMessage(descriptions[preset]);
      await load();
    } catch (reason) {
      setError(apiErrorMessage(reason, "The service status could not be updated."));
    } finally {
      setSavingId(null);
    }
  }

  const modes = [
    { mode: "Metro", icon: TramFront },
    { mode: "Bus", icon: BusFront },
    { mode: "Train", icon: TrainFront },
  ];

  return (
    <div className="page-container content-page admin-page">
      <PageHeading eyebrow="OPERATIONS OVERVIEW" title="The city behind the journey." subtitle="Monitor today’s transit network and simulate service changes for your demo." />
      {error && <div className="error-banner" role="alert">{error}</div>}
      {message && <p className="success-message" role="status">{message} Route results refresh automatically.</p>}
      <div className="admin-kpis">
        {[
          { title: "Active routes", value: summary?.activeRoutes, icon: RouteIcon, note: "Available connections" },
          { title: "Active services", value: summary?.activeServices, icon: TrainFront, note: "Across the network" },
          { title: "Delayed services", value: summary?.delayedServices, icon: Activity, note: "Service alerts active" },
          { title: "Today’s journeys", value: summary?.todayJourneys, icon: MapPin, note: "Planner searches" },
        ].map(({ title, value, icon: Icon, note }) => (
          <article className="admin-kpi" key={title}><span className="kpi-icon"><Icon size={18} /></span><p>{title}</p><strong>{value ?? "—"}</strong><small>{note}</small></article>
        ))}
      </div>

      <section className="admin-charts-grid" aria-label="Network analytics">
        <article className="admin-panel admin-chart-panel">
          <div className="admin-panel-heading"><div><span className="section-kicker">SEARCH ACTIVITY</span><h2>Journey volume</h2></div><span className="chart-hint">Last 7 days</span></div>
          <div className="chart-area"><ResponsiveContainer width="100%" height="100%"><BarChart data={journeyChart} margin={{ top: 4, right: 2, left: -20, bottom: 0 }}><CartesianGrid stroke="#edf0ed" vertical={false} /><XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: "#8a938c", fontSize: 9 }} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "#a0a8a2", fontSize: 9 }} /><Tooltip /><Bar dataKey="journeys" name="Planner searches" fill="#398a62" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>
        </article>
        <article className="admin-panel admin-chart-panel">
          <div className="admin-panel-heading"><div><span className="section-kicker">NETWORK MIX</span><h2>Mode usage</h2></div></div>
          <div className="chart-area pie-chart-area"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={summary?.modeUsage ?? []} dataKey="count" nameKey="mode" innerRadius={45} outerRadius={75} paddingAngle={3}>{(summary?.modeUsage ?? []).map((entry) => <Cell key={entry.mode} fill={modeColors[entry.mode] ?? "#999"} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div>
          <div className="chart-legend">{modes.map(({ mode }) => <span key={mode}><i style={{ background: modeColors[mode] }} />{mode}</span>)}</div>
        </article>
        <article className="admin-panel admin-chart-panel">
          <div className="admin-panel-heading"><div><span className="section-kicker">SERVICE HEALTH</span><h2>Reported delay</h2></div><span className="chart-hint">Minutes by mode</span></div>
          <div className="chart-area"><ResponsiveContainer width="100%" height="100%"><LineChart data={modes.map(({ mode }) => ({ mode, minutes: summary?.delayByMode.find((row) => row.mode === mode)?.minutes ?? 0 }))} margin={{ top: 5, right: 7, left: -20, bottom: 0 }}><CartesianGrid stroke="#edf0ed" vertical={false} /><XAxis dataKey="mode" tickLine={false} axisLine={false} tick={{ fill: "#8a938c", fontSize: 9 }} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "#a0a8a2", fontSize: 9 }} /><Tooltip /><Line type="monotone" dataKey="minutes" name="Delay minutes" stroke="#d79a43" strokeWidth={2.5} dot={{ r: 4, fill: "#d79a43" }} /></LineChart></ResponsiveContainer></div>
        </article>
      </section>

      <section className="admin-panel services-admin-panel">
        <div className="service-table-heading"><div><span className="section-kicker">DEMO CONTROLS</span><h2>Service management</h2><p>Changes are saved to SQLite and appear in the journey planner within seconds.</p></div><span className="panel-live"><i /> Live network</span></div>
        <div className="service-table-wrap">
          <table className="service-table">
            <thead><tr><th>Service</th><th>Mode</th><th>Status</th><th>Delay</th><th>Updated</th><th>Action</th></tr></thead>
            <tbody>{services.map((service) => (
              <tr key={service.id}>
                <td><strong>{service.name}</strong><small>{service.line}</small></td>
                <td><span className={`table-mode ${service.mode.toLowerCase()}`}>{service.mode}</span></td>
                <td><span className={`service-status-pill ${service.status === "On Time" ? "status-on-time" : service.status === "Delayed" ? "status-delayed" : "status-disrupted"}`}><i />{service.status}</span></td>
                <td>{service.delayMinutes ? `${service.delayMinutes} min` : "—"}</td>
                <td>{new Date(`${service.updatedAt.replace(" ", "T")}Z`).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</td>
                <td className="service-action-cell">
                  <select aria-label={`Demo state for ${service.name}`} value={presetSelections[service.id] ?? "normal"} onChange={(event) => setPresetSelections((selections) => ({ ...selections, [service.id]: event.target.value as typeof controlPresets[number]["id"] }))}>
                    {controlPresets.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
                  </select>
                  <button type="button" className="service-apply-button" disabled={savingId === service.id} onClick={() => void applyServicePreset(service)}>{savingId === service.id ? "…" : "Apply"}</button>
                </td>
              </tr>
            ))}</tbody>
          </table>
          {!services.length && <div className="admin-empty">{error ? "Service controls are unavailable until the API reconnects." : "Loading services…"}</div>}
        </div>
      </section>
      <div className="admin-dataset"><span>Demo network</span><span>Hyderabad, Telangana</span><span>SQLite · changes persist across refreshes</span><Clock3 size={12} /></div>
    </div>
  );
}
