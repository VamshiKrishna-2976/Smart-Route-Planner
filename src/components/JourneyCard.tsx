import { ArrowRight, Bookmark, Clock3, IndianRupee, MapPin, Repeat2, Route as RouteIcon, Footprints } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import type { Journey, RouteCategory } from "../types";
import { TransitIcon, modeClass } from "./TransitIcon";

const categoryLabels: Record<RouteCategory, string> = {
  recommended: "Recommended",
  fastest: "Fastest",
  cheapest: "Cheapest",
  transfers: "Fewest transfers",
};

export function JourneyCard({
  journey,
  onSave,
  saved = false,
  onSelect,
  selected = false,
}: {
  journey: Journey;
  onSave?: (journey: Journey) => void;
  saved?: boolean;
  onSelect?: (journey: Journey) => void;
  selected?: boolean;
}) {
  const location = useLocation();
  const services = [...new Set(journey.legs.map((leg) => leg.mode))];
  return (
    <article className={`journey-card ${journey.recommended ? "journey-card-recommended" : ""} ${selected ? "journey-card-selected" : ""}`}>
      {journey.recommended && <span className="route-recommendation-label">RECOMMENDED FOR YOU</span>}
      <div className="journey-card-top">
        <div className="journey-stats">
          <span><Clock3 size={15} /> <strong>{journey.duration} min</strong></span>
          <span><IndianRupee size={14} /> <strong>₹{journey.fare}</strong></span>
          <span><Repeat2 size={15} /> {journey.transfers === 0 ? "Direct" : `${journey.transfers} transfer${journey.transfers === 1 ? "" : "s"}`}</span>
        </div>
        {onSave && (
          <button
            className={`save-icon ${saved ? "is-saved" : ""}`}
            type="button"
            aria-label={saved ? "Saved journey" : "Save journey"}
            onClick={() => onSave(journey)}
            disabled={saved}
          >
            <Bookmark size={17} fill={saved ? "currentColor" : "none"} />
          </button>
        )}
      </div>
      <div className="route-service-summary">
        <div className="mode-list">
          {services.map((mode, index) => (
            <span key={mode} className={`mode-chip ${modeClass(mode)}`}>
              <TransitIcon mode={mode} size={14} /> {mode}
              {index < services.length - 1 && <span className="mode-connector">+</span>}
            </span>
          ))}
        </div>
        <span className={`service-status-chip ${journey.status === "On Time" ? "status-on-time" : journey.status === "Delayed" ? "status-delayed" : "status-disrupted"}`}>
          <i /> {journey.status}{journey.delayMinutes > 0 ? ` · ${journey.delayMinutes} min delay` : ""}
        </span>
      </div>
      <div className="route-stops">
        <div className="route-time">
          <strong>{formatTime(journey.departureTime)}</strong>
          <span>{journey.origin}</span>
        </div>
        <div className="route-line"><span /><i /><span /></div>
        <div className="route-time route-end">
          <strong>{formatTime(journey.arrivalTime)}</strong>
          <span>{journey.destination}</span>
        </div>
      </div>
      <div className="route-detail-metrics">
        <span><RouteIcon size={13} /> {journey.distance} km</span>
        <span><Footprints size={13} /> {journey.walkingDistance} km walk</span>
      </div>
      <div className="route-services-list">
        {journey.services.map((service) => <span key={service}>{service}</span>)}
      </div>
      <div className="journey-card-bottom">
        <div className="route-category-list">
          {journey.categories.map((category) => <span className="route-category-tag" key={category}>{categoryLabels[category]}</span>)}
          {journey.categories.length === 0 && <span className="mode-chip"><MapPin size={13} /> {journey.stops.length} stops</span>}
        </div>
        <div className="route-card-actions">
          {onSelect && (
            <button className={`select-route-button ${selected ? "route-is-selected" : ""}`} type="button" aria-pressed={selected} onClick={() => onSelect(journey)}>
              {selected ? "Selected" : "Show on map"}
            </button>
          )}
          <Link className="card-link" to={`/journey/${encodeURIComponent(journey.id)}${location.search}`} state={{ journey }}>
            Details <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    </article>
  );
}

function formatTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).replace(" ", "");
}

export function LegTimeline({ journey }: { journey: Journey }) {
  return (
    <div className="timeline">
      <div className="timeline-stop timeline-start">
        <span className="timeline-dot start-dot" />
        <div><strong>{journey.origin}</strong><small>Depart {formatTime(journey.departureTime)}</small></div>
      </div>
      <div className="timeline-walk"><Footprints size={15} /><span>Walk {Math.max(2, Math.ceil(journey.walkingDuration / (journey.transfers + 1)))} min</span><small>Access · approx. {Math.round(journey.walkingDistance / (journey.transfers + 1) * 100) / 100} km</small></div>
      {journey.legs.map((leg, index) => (
        <div className="timeline-segment" key={`${leg.id}-${index}`}>
          <div className="timeline-leg">
            <div className={`timeline-mode-icon ${modeClass(leg.mode)}`}><TransitIcon mode={leg.mode} /></div>
            <div className="timeline-leg-info">
              <strong>{leg.mode} <span className="timeline-duration">{leg.duration} min</span></strong>
              <span>{leg.service}</span>
              <small><MapPin size={12} /> Board at {leg.from} · {leg.line}</small>
              <small className={`timeline-service-status ${leg.status === "On Time" ? "status-on-time" : leg.status === "Delayed" ? "status-delayed" : "status-disrupted"}`}>
                {leg.status}{leg.delayMinutes ? ` · ${leg.delayMinutes} min delay` : ""}
              </small>
            </div>
          </div>
          {journey.stops.find((stop) => stop.id === leg.to_stop)?.transfer && (
            <div className="timeline-transfer"><span className="transfer-symbol">↔</span><span>Transfer at {leg.to}</span><small>Allow a few minutes to change services</small></div>
          )}
        </div>
      ))}
      <div className="timeline-walk"><Footprints size={15} /><span>Walk to your destination</span><small>Exit · walking distance included above</small></div>
      <div className="timeline-stop timeline-end">
        <span className="timeline-dot end-dot" />
        <div><strong>{journey.destination}</strong><small>Arrive {formatTime(journey.arrivalTime)} · {journey.status}</small></div>
      </div>
    </div>
  );
}
