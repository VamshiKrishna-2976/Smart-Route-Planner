import { useEffect, useMemo } from "react";
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet";
import type { Journey, Stop } from "../types";

function FitJourney({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length > 1) map.fitBounds(positions, { padding: [42, 42], maxZoom: 13 });
  }, [map, positions]);
  return null;
}

export function TransitMap({ stops, journey, compact = false }: { stops: Stop[]; journey?: Journey; compact?: boolean }) {
  const locations = useMemo(() => new Map(stops.map((stop) => [stop.name, stop])), [stops]);
  const relevantStops = useMemo<Array<Stop & { transfer: boolean }>>(() => journey
    ? (journey.stops.length
      ? journey.stops
      : [journey.origin, ...journey.legs.map((leg) => leg.to)]
        .map((name) => locations.get(name))
        .filter((stop): stop is Stop => Boolean(stop))
        .map((stop) => ({ ...stop, transfer: false })))
    : stops.map((stop) => ({ ...stop, transfer: false })), [journey, locations, stops]);
  const positions = useMemo(
    () => relevantStops.map((stop) => [stop.latitude, stop.longitude] as [number, number]),
    [relevantStops],
  );
  const center: [number, number] = [17.421, 78.445];
  const lineColors = { Metro: "#167252", Bus: "#e09c45", Train: "#637acb" };

  return (
    <div className={`map-frame ${compact ? "map-compact" : ""}`}>
      <MapContainer center={center} zoom={11} scrollWheelZoom zoomControl>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {journey ? (
          <>
            {journey.legs.map((leg, index) => {
              const from = locations.get(leg.from);
              const to = locations.get(leg.to);
              if (!from || !to) return null;
              return (
                <Polyline
                  key={`${leg.id}-${index}`}
                  positions={[[from.latitude, from.longitude], [to.latitude, to.longitude]]}
                  pathOptions={{ color: lineColors[leg.mode], weight: 5, opacity: 0.9, lineCap: "round" }}
                >
                  <Tooltip sticky>{leg.mode}: {leg.service}</Tooltip>
                </Polyline>
              );
            })}
            {relevantStops.map((stop, index) => {
              const isEndpoint = index === 0 || index === relevantStops.length - 1;
              const fill = index === 0 ? "#176b4d" : index === relevantStops.length - 1 ? "#df8852" : stop.transfer ? "#d69b42" : "#fff";
              return (
                <CircleMarker
                  key={stop.id}
                  center={[stop.latitude, stop.longitude]}
                  radius={isEndpoint ? 8 : stop.transfer ? 7 : 5}
                  pathOptions={{ color: isEndpoint ? "#fff" : stop.transfer ? "#fff" : "#176b4d", fillColor: fill, fillOpacity: 1, weight: 3 }}
                >
                  <Tooltip direction="top" offset={[0, -8]}>{stop.name}{stop.transfer ? " · transfer" : ""}</Tooltip>
                </CircleMarker>
              );
            })}
          </>
        ) : stops.map((stop) => (
          <CircleMarker key={stop.id} center={[stop.latitude, stop.longitude]} radius={5} pathOptions={{ color: "#fff", fillColor: "#176b4d", fillOpacity: 0.92, weight: 2 }}>
            <Tooltip direction="top" offset={[0, -5]}>{stop.name}</Tooltip>
          </CircleMarker>
        ))}
        {journey && <FitJourney positions={positions} />}
      </MapContainer>
      {!compact && (
        <div className="map-caption">
          <span className="map-live-dot" /> Hyderabad, Telangana
          <span className="map-caption-right">OpenStreetMap · {journey ? `${journey.stops.length} route stops` : "Transit network"}</span>
        </div>
      )}
    </div>
  );
}
