import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { ArrowLeft, Bookmark, Clock3, Footprints, IndianRupee, Map, Repeat2 } from "lucide-react";
import { apiErrorMessage, getJourney, getSavedJourneys, getStops, saveJourney } from "../api";
import { LegTimeline } from "../components/JourneyCard";
import { PageHeading } from "../components/Layout";
import { TransitMap } from "../components/TransitMap";
import type { Journey, Stop } from "../types";

export function JourneyPage({ stops: knownStops }: { stops: Stop[] }) {
  const { id = "" } = useParams();
  const location = useLocation();
  const stateJourney = (location.state as { journey?: Journey } | null)?.journey;
  const [journey, setJourney] = useState<Journey | undefined>(stateJourney);
  const [stops, setStops] = useState(knownStops);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    getSavedJourneys()
      .then((items) => setSaved(items.some((item) => item.id === id)))
      .catch(() => setMessage("Saved journeys couldn’t be checked right now."));
    getJourney(id)
      .then(setJourney)
      .catch((reason: unknown) => {
        if (stateJourney) setJourney(stateJourney);
        else setJourney(undefined);
        setMessage(apiErrorMessage(reason, "We couldn’t load that journey."));
      });
    if (!stops.length) getStops().then(setStops).catch(() => setMessage("Map data couldn’t be loaded."));
  }, [id, stateJourney, stops.length]);

  async function handleSave() {
    if (!journey) return;
    try {
      await saveJourney(journey);
      setSaved(true);
      setMessage("Journey added to your saved trips.");
    } catch {
      setMessage("This journey couldn’t be saved. Please try again.");
    }
  }

  if (!journey) {
    return <div className="page-container content-page"><Link to="/" className="back-link"><ArrowLeft size={15} /> Back to planner</Link>{message && <div className="error-banner">{message}</div>}<div className="empty-state"><h2>Journey not found</h2><p>Find a route first, then open its details here.</p><Link to="/" className="button button-primary">Plan a journey</Link></div></div>;
  }

  return (
    <div className="page-container content-page">
      <Link to={`/routes${location.search}`} className="back-link"><ArrowLeft size={15} /> Back to route options</Link>
      <div className="journey-detail-heading">
        <PageHeading eyebrow="JOURNEY DETAILS" title={`${journey.origin} to ${journey.destination}`} subtitle="A better way to get where you’re going." />
        <button className={`button ${saved ? "button-secondary" : "button-primary"}`} type="button" onClick={handleSave}><Bookmark size={16} fill={saved ? "currentColor" : "none"} /> {saved ? "Saved journey" : "Save journey"}</button>
      </div>
      {message && <p className="success-message" role="status">{message}</p>}
      <div className="detail-stats">
        <div><span className="detail-stat-icon"><Clock3 size={17} /></span><span><strong>{journey.duration} min</strong><small>total travel time</small></span></div>
        <div><span className="detail-stat-icon peach"><IndianRupee size={17} /></span><span><strong>₹{journey.fare}</strong><small>estimated fare</small></span></div>
        <div><span className="detail-stat-icon blue"><Repeat2 size={17} /></span><span><strong>{journey.transfers ? `${journey.transfers} transfer${journey.transfers === 1 ? "" : "s"}` : "Direct"}</strong><small>along the way</small></span></div>
        <div><span className="detail-stat-icon lilac"><Map size={17} /></span><span><strong>{journey.distance} km</strong><small>approx. distance</small></span></div>
        <div><span className="detail-stat-icon"><Footprints size={17} /></span><span><strong>{journey.walkingDistance} km</strong><small>walking distance</small></span></div>
        <div><span className={`detail-stat-icon ${journey.status === "On Time" ? "" : "peach"}`}><Clock3 size={17} /></span><span><strong>{journey.status}</strong><small>{journey.delayMinutes ? `${journey.delayMinutes} min reported delay` : "service update"}</small></span></div>
      </div>
      <div className="detail-layout">
        <section className="detail-panel">
          <div className="detail-panel-heading"><div><span className="section-kicker">STEP BY STEP</span><h2>Your itinerary</h2></div><span className="today-label">{new Date(journey.departureTime).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })} · {new Date(journey.departureTime).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span></div>
          <LegTimeline journey={journey} />
        </section>
        <aside className="detail-map-panel"><div className="detail-panel-heading"><div><span className="section-kicker">ON THE MAP</span><h2>Your route</h2></div></div><TransitMap stops={stops} journey={journey} compact /><p className="detail-map-note">A clear view of your trip, stop by stop.</p></aside>
      </div>
    </div>
  );
}
