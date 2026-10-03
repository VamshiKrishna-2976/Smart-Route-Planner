import { useCallback, useEffect, useState } from "react";
import { Bookmark, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { getSavedJourneys, removeSavedJourney } from "../api";
import { EmptyState, PageHeading } from "../components/Layout";
import { JourneyCard } from "../components/JourneyCard";
import type { Journey } from "../types";

export function SavedPage() {
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(() => getSavedJourneys().then(setJourneys).catch(() => setError("Saved journeys couldn’t be loaded. Please try again.")).finally(() => setLoading(false)), []);

  useEffect(() => { load(); }, [load]);

  async function remove(id: string) {
    try {
      await removeSavedJourney(id);
      setJourneys((items) => items.filter((item) => item.id !== id));
    } catch {
      setError("We couldn’t remove this saved journey. Please try again.");
    }
  }

  return (
    <div className="page-container content-page">
      <PageHeading eyebrow="YOUR SHORTLIST" title="Saved for the road." subtitle="All the journeys you’ve tucked away, ready when you are." />
      <div className="page-section-header"><span><Bookmark size={16} /> YOUR SAVED JOURNEYS</span><small>{journeys.length} {journeys.length === 1 ? "trip" : "trips"}</small></div>
      {error && <div className="error-banner">{error}</div>}
      {loading ? <div className="skeleton-card" /> : journeys.length ? <div className="saved-grid">{journeys.map((journey) => (
        <div className="saved-journey-wrap" key={journey.id}>
          <JourneyCard journey={journey} saved />
          <div className="saved-journey-actions">
            <Link className="reuse-trip" to={`/routes?from=${encodeURIComponent(journey.origin)}&to=${encodeURIComponent(journey.destination)}&preference=balanced&departure=Leave%20now`}>
              Reuse this journey
            </Link>
            <button className="remove-trip" type="button" onClick={() => remove(journey.id)}><Trash2 size={14} /> Remove</button>
          </div>
        </div>
      ))}</div> : <EmptyState title="A little room for your next trip" detail="Save a route you love and it’ll be waiting for you here." />}
    </div>
  );
}
