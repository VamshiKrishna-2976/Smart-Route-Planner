import { useEffect, useState } from "react";
import { Activity, ArrowUpRight, BusFront, Check, Clock3, RefreshCw, TramFront, TrainFront } from "lucide-react";
import { getServiceAlerts, getServices } from "../api";
import { PageHeading } from "../components/Layout";
import { TransitIcon, modeClass } from "../components/TransitIcon";
import type { Service, ServiceAlert } from "../types";

export function StatusPage() {
  const [alerts, setAlerts] = useState<ServiceAlert[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const refresh = () => Promise.all([getServiceAlerts(), getServices()])
      .then(([nextAlerts, nextServices]) => {
        if (active) { setAlerts(nextAlerts); setServices(nextServices); setError(""); }
      })
      .catch(() => { if (active) setError("Live service information couldn’t be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    void refresh();
    const timer = window.setInterval(refresh, 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);
  const disruptedCount = services.filter((service) => service.status !== "On Time").length;

  return (
    <div className="page-container content-page">
      <PageHeading eyebrow="RIGHT NOW IN HYDERABAD" title="The city is moving." subtitle="A quick pulse check before you head out." />
      <div className="status-overview">
        <div className="network-health"><span className="health-orbit"><Activity size={22} /></span><div><span className="section-kicker">NETWORK STATUS</span><h2>{disruptedCount ? `${disruptedCount} service${disruptedCount === 1 ? "" : "s"} need attention` : "All systems looking good"}</h2><p><span className="live-pulse" /> Updated from the transit network · Demo service data</p></div></div>
        <div className="status-updated"><RefreshCw size={14} /> Refreshes in real time</div>
      </div>
      <div className="status-mode-grid">
        {[
          { mode: "Metro", name: "Hyderabad Metro", info: "Trains every 6–8 min", Icon: TramFront, tone: "metro-tone" },
          { mode: "Bus", name: "City buses", info: "Regular service", Icon: BusFront, tone: "bus-tone" },
          { mode: "Train", name: "MMTS rail", info: "Running on schedule", Icon: TrainFront, tone: "train-tone" },
        ].map(({ mode, name, info, Icon, tone }) => (
          <article className="status-mode-card" key={mode}><span className={`status-mode-icon ${tone}`}><Icon size={20} /></span><div><h3>{name}</h3><p>{info}</p></div><span className={`operating-badge ${services.some((service) => service.mode === mode && service.status === "Suspended") ? "status-disrupted" : services.some((service) => service.mode === mode && service.status === "Delayed") ? "status-delayed" : ""}`}><i />{services.some((service) => service.mode === mode && service.status === "Suspended") ? "Suspended" : services.some((service) => service.mode === mode && service.status === "Delayed") ? "Delays" : "On time"}</span></article>
        ))}
      </div>
      <div className="service-status-list">
        <div className="alerts-header"><div><span className="section-kicker">LIVE SERVICE FEED</span><h2>Services across the network</h2></div><span className="alert-count">{services.length} services</span></div>
        {services.map((service) => (
          <article className="live-service-row" key={service.id}>
            <div className={`alert-mode-icon ${service.mode.toLowerCase()}`}><TransitIcon mode={service.mode} /></div>
            <div className="live-service-name"><strong>{service.name}</strong><small>{service.line}</small></div>
            <span className={`service-status-pill ${service.status === "On Time" ? "status-on-time" : service.status === "Delayed" ? "status-delayed" : "status-disrupted"}`}><i />{service.status}</span>
            <span className="live-service-delay">{service.delayMinutes ? `+${service.delayMinutes} min` : "—"}</span>
          </article>
        ))}
      </div>
      <div className="alerts-header"><div><span className="section-kicker">SERVICE UPDATES</span><h2>Good to know</h2></div><span className="alert-count">{alerts.length} updates</span></div>
      {error && <div className="error-banner">{error}</div>}
      {loading ? <div className="skeleton-card" /> : alerts.map((alert) => (
        <article className="alert-card" key={alert.id}><div className={`alert-mode-icon ${modeClass(alert.mode as ServiceAlert["mode"])}`}><TransitIcon mode={alert.mode} /></div><div className="alert-content"><div className="alert-title-row"><h3>{alert.title}</h3><span className={`severity-pill severity-${alert.severity}`}>{alert.severity === "minor" ? <Check size={12} /> : <Activity size={12} />}{alert.severity}</span></div><p>{alert.description}</p><span className="alert-meta"><Clock3 size={12} /> Updated recently <span>·</span> {alert.mode}</span></div><ArrowUpRight className="alert-arrow" size={17} /></article>
      ))}
      <div className="status-disclaimer">Service information is illustrative demo data and may not reflect live operator feeds.</div>
    </div>
  );
}
