import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, ArrowUpDown, Clock3, Footprints, HelpCircle, Route as RouteIcon, SlidersHorizontal } from "lucide-react";
import { apiErrorMessage, createNotification, explainJourney, findRoutes, getSavedJourneys, getServices, saveJourney } from "../api";
import { JourneyCard } from "../components/JourneyCard";
import { PageHeading } from "../components/Layout";
import { TransitMap } from "../components/TransitMap";
import type { Journey, RouteCategory, Service, Stop } from "../types";

const categoryOptions: Array<{ id: "all" | RouteCategory; label: string }> = [
  { id: "all", label: "All routes" },
  { id: "recommended", label: "Recommended" },
  { id: "fastest", label: "Fastest" },
  { id: "cheapest", label: "Cheapest" },
  { id: "transfers", label: "Fewest transfers" },
];

export function RoutesPage({ stops }: { stops: Stop[] }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";
  const preference = searchParams.get("preference") ?? "fastest";
  const departure = searchParams.get("departure") ?? "Leave now";
  const departureTime = searchParams.get("time") ?? "";
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [selectedJourney, setSelectedJourney] = useState<Journey>();
  const [services, setServices] = useState<Service[]>([]);
  const [rerouteCandidate, setRerouteCandidate] = useState<Journey>();
  const [whyExplanation, setWhyExplanation] = useState("");
  const [whyLoading, setWhyLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState<"all" | RouteCategory>("all");
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savedMessage, setSavedMessage] = useState("");
  const [whyOpen, setWhyOpen] = useState(false);
  const notifiedDisruption = useRef("");
  const journeysRef = useRef<Journey[]>([]);
  journeysRef.current = journeys;
  const selectedJourneyRef = useRef<Journey>();
  selectedJourneyRef.current = selectedJourney;
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setJourneys([]);
    journeysRef.current = [];
    setSelectedId("");
    setActiveCategory("all");
    findRoutes(from, to, preference, departure, departureTime)
      .then((routes) => {
        if (!active) return;
        setJourneys(routes);
        journeysRef.current = routes;
        const recommended = routes.find((route) => route.recommended) ?? routes[0];
        setSelectedId(recommended?.id ?? "");
        setSelectedJourney(recommended);
        setRerouteCandidate(undefined);
        setWhyExplanation("");
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setError(apiErrorMessage(reason, "We couldn’t find routes right now."));
      })
      .finally(() => { if (active) setLoading(false); });
    getSavedJourneys()
      .then((saved) => { if (active) setSavedIds(saved.map((journey) => journey.id)); })
      .catch(() => { if (active) setSavedMessage("Saved trips could not be checked right now."); });
    return () => { active = false; };
  }, [from, to, preference, departure, departureTime]);

  useEffect(() => {
    let active = true;
    const refreshTransit = async () => {
      try {
        const [routes, latestServices] = await Promise.all([
          findRoutes(from, to, preference, departure, departureTime, false),
          getServices(),
        ]);
        if (!active) return;
        setServices(latestServices);
        const routeSignature = (items: Journey[]) => JSON.stringify(items.map((route) => [
          route.id, route.duration, route.fare, route.status, route.delayMinutes,
          route.categories, route.legs.map((leg) => [leg.serviceId, leg.status, leg.delayMinutes]),
        ]));
        if (routeSignature(routes) !== routeSignature(journeysRef.current)) {
          journeysRef.current = routes;
          setJourneys(routes);
        }
        const currentId = selectedIdRef.current;
        const currentRoute = selectedJourneyRef.current;
        const refreshedSelection = routes.find((route) => route.id === currentId);
        const monitoredRoute = refreshedSelection ?? currentRoute;
        if (refreshedSelection && (!currentRoute || routeSignature([refreshedSelection]) !== routeSignature([currentRoute]))) {
          setSelectedJourney(refreshedSelection);
        }
        if (!monitoredRoute) return;
        const affected = monitoredRoute.legs
          .map((leg) => latestServices.find((service) => service.id === leg.serviceId))
          .filter((service): service is Service => Boolean(service && service.status !== "On Time"));
        if (!affected.length) {
          setRerouteCandidate(undefined);
          notifiedDisruption.current = "";
          return;
        }
        const primary = affected.find((service) => service.status === "Suspended") ?? affected[0];
        const alternative = routes
          .filter((route) => route.id !== monitoredRoute.id)
          .filter((route) => route.legs.every((leg) => {
            const service = latestServices.find((item) => item.id === leg.serviceId);
            return Boolean(service && service.status === "On Time");
          }))
          .sort((a, b) => a.duration - b.duration)[0];
        setRerouteCandidate(alternative);
        const disruptionKey = `${monitoredRoute.id}:${affected.map((item) => `${item.id}-${item.status}-${item.delayMinutes}`).join("|")}`;
        if (notifiedDisruption.current !== disruptionKey) {
          notifiedDisruption.current = disruptionKey;
          const text = `${primary.name} is ${primary.status === "Suspended" ? "suspended" : `delayed by ${primary.delayMinutes} minutes`}.`;
          setSavedMessage(text);
          void createNotification("delay", text);
        }
      } catch {
        if (active) setError("Live transit conditions could not be refreshed. Showing the latest available routes.");
      }
    };
    void refreshTransit();
    const timer = window.setInterval(refreshTransit, 2500);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [from, to, preference, departure, departureTime]);

  const visibleRoutes = useMemo(
    () => activeCategory === "all"
      ? journeys
      : journeys.filter((journey) => journey.categories.includes(activeCategory)),
    [activeCategory, journeys],
  );
  const currentJourney = journeys.find((journey) => journey.id === selectedId) ?? selectedJourney;
  const affectedServices = currentJourney
    ? currentJourney.legs
      .map((leg) => services.find((service) => service.id === leg.serviceId))
      .filter((service): service is Service => Boolean(service && service.status !== "On Time"))
    : [];
  const disruption = affectedServices[0];

  function chooseCategory(category: "all" | RouteCategory) {
    setActiveCategory(category);
    if (category !== "all") {
      const match = journeys.find((journey) => journey.categories.includes(category));
      if (match) { setSelectedId(match.id); setSelectedJourney(match); }
    }
  }

  async function toggleSave(journey: Journey) {
    if (savedIds.includes(journey.id)) return;
    try {
      await saveJourney(journey);
      setSavedIds((ids) => [...new Set([...ids, journey.id])]);
      setSavedMessage("Journey saved to your trips.");
      window.setTimeout(() => setSavedMessage(""), 2800);
    } catch {
      setError("We couldn’t save this journey. Please try again.");
    }
  }

  function selectRoute(journey: Journey) {
    setSelectedId(journey.id);
    setSelectedJourney(journey);
    if (journey.id !== selectedJourney?.id) {
      void createNotification("route-change", `You switched your selected route to ${journey.services.join(" + ")}.`);
    }
  }

  function switchToAlternative() {
    if (!rerouteCandidate) return;
    setSelectedId(rerouteCandidate.id);
    setSelectedJourney(rerouteCandidate);
    setActiveCategory("all");
    setRerouteCandidate(undefined);
    setSavedMessage(`Switched to the ${rerouteCandidate.duration}-minute alternative.`);
    void createNotification("alternative", `Switched to an alternative route from ${from} to ${to}.`);
  }

  async function explainSelectedRoute() {
    if (!currentJourney) return;
    setWhyLoading(true);
    setWhyOpen(true);
    try {
      const result = await explainJourney(currentJourney.id);
      setWhyExplanation(result.explanation);
    } catch (reason) {
      setWhyExplanation(apiErrorMessage(reason, "This route is ranked using its travel time, fare, transfers and current service conditions."));
    } finally {
      setWhyLoading(false);
    }
  }

  function reverseRoute() {
    const updated = new URLSearchParams(searchParams);
    updated.set("from", to);
    updated.set("to", from);
    setSearchParams(updated);
  }

  return (
    <div className="page-container content-page">
      <Link to="/" className="back-link"><ArrowLeft size={15} /> Plan another journey</Link>
      <div className="results-heading-row">
        <PageHeading eyebrow="YOUR JOURNEY" title="Routes that work for you." subtitle={`${from} to ${to}`} />
        <div className="trip-summary"><Clock3 size={16} /><span>{departureTime ? new Date(departureTime).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" }) : "Today"}</span><span className="summary-separator" /><span>{departureTime ? new Date(departureTime).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : departure}</span></div>
      </div>
      {savedMessage && <p className="success-message" role="status">{savedMessage}</p>}
      {error && <div className="error-banner" role="alert">{error}</div>}
      {disruption && currentJourney && (
        <section className="disruption-banner" role="alert">
          <span className="disruption-icon">!</span>
          <div className="disruption-copy">
            <strong>Service disruption detected</strong>
            <p>{disruption.name} is {disruption.status === "Suspended" ? "suspended" : `affected by a ${disruption.delayMinutes}-minute delay`}.</p>
            <div className="disruption-route-row">
              <span>Current route: <b>{currentJourney.duration} min</b></span>
              {rerouteCandidate && <span>Alternative: <b>{rerouteCandidate.duration} min</b></span>}
            </div>
          </div>
          {rerouteCandidate && <button className="button button-primary reroute-button" type="button" onClick={switchToAlternative}>Switch to Alternative <ArrowRight size={15} /></button>}
        </section>
      )}
      <div className="results-layout">
        <section className="results-list">
          <div className="results-toolbar">
            <span>{loading ? "Finding routes…" : `${visibleRoutes.length} ${visibleRoutes.length === 1 ? "thoughtful option" : "thoughtful options"}`}</span>
            <span className="toolbar-label"><SlidersHorizontal size={14} /> PRIORITIZE: {preference}</span>
          </div>
          <div className="filter-pills" aria-label="Filter routes">
            {categoryOptions.map(({ id, label }) => (
              <button
                key={id}
                className={`filter-pill ${activeCategory === id ? "filter-active" : ""}`}
                onClick={() => chooseCategory(id)}
                type="button"
                aria-pressed={activeCategory === id}
              >
                {label}
              </button>
            ))}
            <button className="filter-swap" type="button" onClick={reverseRoute} aria-label="Reverse route"><ArrowUpDown size={15} /></button>
          </div>
          {loading ? (
            <div className="route-skeleton-list" aria-label="Loading routes">
              {[0, 1, 2].map((key) => <div className="skeleton-card" key={key} />)}
            </div>
          ) : !error && visibleRoutes.length ? (
            visibleRoutes.map((journey) => (
              <JourneyCard
                key={journey.id}
                journey={journey}
                saved={savedIds.includes(journey.id)}
                onSave={toggleSave}
                onSelect={selectRoute}
                selected={selectedId === journey.id}
              />
            ))
          ) : !error ? (
            <div className="empty-results"><h2>No routes found just yet</h2><p>Try a nearby stop or choose a different starting point.</p><Link to="/" className="button button-secondary">Edit your journey <ArrowRight size={15} /></Link></div>
          ) : null}
          <button className={`why-route-toggle ${whyOpen ? "why-open" : ""}`} type="button" onClick={() => void explainSelectedRoute()} aria-expanded={whyOpen} disabled={whyLoading || !currentJourney}>
            <HelpCircle size={15} /> {whyLoading ? "Preparing route explanation…" : "✨ Why this route?"} <span>{whyLoading ? "…" : whyOpen ? "−" : "+"}</span>
          </button>
          {whyOpen && <div className="why-route-explanation">{whyExplanation || "We rank your options using travel time, fare, transfers and current delays. The route itself is always calculated by the deterministic transit engine."}</div>}
        </section>
        <aside className="results-aside">
          <div className="aside-map-card">
            <div className="aside-heading">
              <div><span className="section-kicker">YOUR CITY, IN VIEW</span><h3>{currentJourney ? "Selected route" : "Journey map"}</h3></div>
              <span className={`map-live-chip ${disruption ? "map-live-disrupted" : ""}`}><span /> {disruption?.status ?? currentJourney?.status ?? "Transit map"}</span>
            </div>
            <TransitMap stops={stops} journey={currentJourney} compact />
            <div className="map-legend"><span><i className="legend-dot metro-legend" /> Metro</span><span><i className="legend-dot bus-legend" /> Bus</span><span><i className="legend-dot train-legend" /> Train</span><span><i className="legend-dot transfer-legend" /> Transfer</span></div>
            {currentJourney && (
              <div className="map-route-summary">
                <strong>{currentJourney.duration} min <span>·</span> ₹{currentJourney.fare}</strong>
                <span><RouteIcon size={13} /> {currentJourney.distance} km</span>
                <span><Footprints size={13} /> {currentJourney.walkingDistance} km walk</span>
              </div>
            )}
          </div>
          <div className="aside-tip"><span className="tip-icon">✳</span><div><strong>A little heads-up</strong><p>Transit times are estimates. Leave a few minutes for platform changes.</p></div></div>
        </aside>
      </div>
    </div>
  );
}
