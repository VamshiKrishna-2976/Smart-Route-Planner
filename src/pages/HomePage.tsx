import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeftRight, ArrowRight, ArrowUpRight, Clock3, Navigation, Sparkles, TrainFront, Zap } from "lucide-react";
import { TransitMap } from "../components/TransitMap";
import type { Stop } from "../types";

const preferences = [
  { id: "fastest", label: "Fastest", icon: Zap, detail: "Save time" },
  { id: "cheapest", label: "Cheapest", icon: null, detail: "Save money" },
  { id: "transfers", label: "Fewest transfers", icon: TrainFront, detail: "Ride simpler" },
  { id: "balanced", label: "Balanced", icon: Sparkles, detail: "Best of both" },
];

const departureChoices = ["Leave now", "Depart at", "Arrive by"];

export function HomePage({ stops }: { stops: Stop[] }) {
  const [from, setFrom] = useState("Ameerpet");
  const [to, setTo] = useState("HITEC City");
  const [preference, setPreference] = useState("fastest");
  const [departure, setDeparture] = useState("Leave now");
  const [time, setTime] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  function searchRoutes(event: React.FormEvent) {
    event.preventDefault();
    if (departure !== "Leave now" && !time) {
      setError("Choose a date and time for your planned journey.");
      return;
    }
    if (!from || !to) {
      setError("Choose both your starting point and destination.");
      return;
    }
    if (from === to) {
      setError("Your start and destination need to be different.");
      return;
    }
    setError("");
    const scheduledTime = departure === "Leave now" ? "" : time;
    navigate(`/routes?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&preference=${preference}&departure=${encodeURIComponent(departure)}&time=${encodeURIComponent(scheduledTime)}`);
  }

  return (
    <div className="home-page">
      <section className="home-hero page-container">
        <div className="hero-copy">
          <div className="eyebrow hero-eyebrow"><span className="live-pulse" /> MOVING HYDERABAD FORWARD</div>
          <h1>Where are<br />you <span>going?</span></h1>
          <p>One city. Every way to get there.<br />Find your perfect route in seconds.</p>
          <div className="hero-social-proof">
            <span className="proof-icon"><Navigation size={15} /></span>
            <span>Smarter trips across <strong>Hyderabad</strong></span>
          </div>
        </div>
        <div className="hero-map-wrap">
          <TransitMap stops={stops} />
          <div className="map-floating-label floating-label-top"><span className="floating-dot metro-dot" /> Metro network <ArrowUpRight size={14} /></div>
          <div className="map-floating-label floating-label-bottom"><span className="floating-dot bus-dot" /> Your city, connected</div>
        </div>
      </section>

      <section className="planner-section page-container" aria-label="Journey planner">
        <form className="planner-card" onSubmit={searchRoutes}>
          <div className="planner-card-heading">
            <div>
              <span className="section-kicker">PLAN YOUR JOURNEY</span>
              <h2>Let’s get you there.</h2>
            </div>
            <span className="planner-sparkle"><Sparkles size={18} /></span>
          </div>
          <div className="location-fields">
            <label className="location-field">
              <span className="field-label">FROM</span>
              <span className="input-with-icon"><span className="location-point start-point" /><select value={from} onChange={(event) => setFrom(event.target.value)} aria-label="Starting point">
                <option value="">Choose a starting point</option>
                {stops.map((stop) => <option key={stop.id} value={stop.name}>{stop.name}</option>)}
              </select></span>
            </label>
            <button type="button" className="swap-button" onClick={() => { setFrom(to); setTo(from); }} aria-label="Swap starting point and destination">
              <ArrowLeftRight size={17} />
            </button>
            <label className="location-field">
              <span className="field-label">TO</span>
              <span className="input-with-icon"><span className="location-point end-point" /><select value={to} onChange={(event) => setTo(event.target.value)} aria-label="Destination">
                <option value="">Choose a destination</option>
                {stops.map((stop) => <option key={stop.id} value={stop.name}>{stop.name}</option>)}
              </select></span>
            </label>
          </div>
          <div className="planner-divider" />
          <div className="planner-options">
            <div className="preference-group">
              <span className="field-label">TRAVEL PREFERENCE</span>
              <div className="preference-options">
                {preferences.map(({ id, label, icon: Icon, detail }) => (
                  <button key={id} className={`preference-button ${preference === id ? "preference-active" : ""}`} type="button" onClick={() => setPreference(id)}>
                    {Icon ? <Icon size={15} /> : <span className="rupee-icon">₹</span>}
                    <span>{label}<small>{detail}</small></span>
                  </button>
                ))}
              </div>
            </div>
            <div className="departure-group">
              <span className="field-label">WHEN</span>
              <div className="departure-options">
                {departureChoices.map((choice) => (
                  <button type="button" key={choice} className={`departure-button ${departure === choice ? "departure-active" : ""}`} onClick={() => setDeparture(choice)}>
                    {choice === "Leave now" && <Clock3 size={14} />}{choice}
                  </button>
                ))}
              </div>
              {departure !== "Leave now" && <input className="departure-time" type="datetime-local" value={time} onChange={(event) => setTime(event.target.value)} aria-label="Journey date and time" />}
            </div>
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="planner-submit-row">
            <span className="planner-note"><span className="note-dot" /> Live routes, smarter choices</span>
            <button type="submit" className="button button-primary find-button">Find best routes <ArrowRight size={17} /></button>
          </div>
        </form>
      </section>

      <section className="home-bottom page-container">
        <div className="city-stat"><span className="stat-icon"><TrainFront size={18} /></span><div><strong>One connected city</strong><span>Bus, metro &amp; train. Together.</span></div></div>
        <div className="city-stat"><span className="stat-icon stat-icon-peach"><Clock3 size={18} /></span><div><strong>More time, less guesswork</strong><span>Plan your next move with confidence.</span></div></div>
        <a href="#planner" className="discover-link" onClick={(event) => { event.preventDefault(); document.querySelector(".planner-card")?.scrollIntoView({ behavior: "smooth", block: "center" }); }}>Explore smarter travel <ArrowRight size={15} /></a>
      </section>
    </div>
  );
}
