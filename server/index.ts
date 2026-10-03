import "dotenv/config";
import express, { type Request, type Response } from "express";
import initSqlJs, { type Database as SqlDatabase, type SqlValue } from "sql.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const databasePath = process.env.DATABASE_PATH ?? path.join(currentDir, "smartroute.db");
const port = Number(process.env.PORT ?? 3001);

const SQL = await initSqlJs();
const db: SqlDatabase = fs.existsSync(databasePath)
  ? new SQL.Database(new Uint8Array(fs.readFileSync(databasePath)))
  : new SQL.Database();

function persistDatabase() {
  fs.writeFileSync(databasePath, Buffer.from(db.export()));
}

function queryAll<T>(sql: string, parameters: SqlValue[] = []): T[] {
  const statement = db.prepare(sql);
  try {
    statement.bind(parameters);
    const rows: T[] = [];
    while (statement.step()) rows.push(statement.getAsObject() as T);
    return rows;
  } finally {
    statement.free();
  }
}

function queryOne<T>(sql: string, parameters: SqlValue[] = []): T | undefined {
  return queryAll<T>(sql, parameters)[0];
}

function execute(sql: string, parameters: SqlValue[] = []) {
  db.run(sql, parameters);
  const changes = db.getRowsModified();
  persistDatabase();
  return changes;
}

db.run("PRAGMA foreign_keys = ON");
db.exec(`
  CREATE TABLE IF NOT EXISTS stops (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    area TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS transit_edges (
    id INTEGER PRIMARY KEY,
    from_stop INTEGER NOT NULL REFERENCES stops(id),
    to_stop INTEGER NOT NULL REFERENCES stops(id),
    mode TEXT NOT NULL CHECK (mode IN ('Metro', 'Bus', 'Train')),
    line TEXT NOT NULL,
    duration INTEGER NOT NULL,
    fare INTEGER NOT NULL,
    frequency INTEGER NOT NULL DEFAULT 8
  );
  CREATE UNIQUE INDEX IF NOT EXISTS transit_edge_unique ON transit_edges (from_stop, to_stop, line);
  CREATE TABLE IF NOT EXISTS services (
    id INTEGER PRIMARY KEY,
    mode TEXT NOT NULL CHECK (mode IN ('Metro', 'Bus', 'Train')),
    name TEXT NOT NULL,
    line TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('On Time', 'Delayed', 'Suspended')),
    delay_minutes INTEGER NOT NULL DEFAULT 0,
    frequency INTEGER NOT NULL DEFAULT 8,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (mode, line)
  );
  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY,
    kind TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS journey_searches (
    id INTEGER PRIMARY KEY,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS saved_journeys (
    id TEXT PRIMARY KEY,
    origin TEXT NOT NULL,
    destination TEXT NOT NULL,
    duration INTEGER NOT NULL,
    fare INTEGER NOT NULL,
    transfers INTEGER NOT NULL,
    itinerary TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS service_alerts (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('minor', 'moderate', 'major')),
    mode TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

const journeySearchColumns = new Set(queryAll<{ name: string }>("PRAGMA table_info(journey_searches)").map((column) => column.name));
for (const mode of ["metro", "bus", "train"]) {
  if (!journeySearchColumns.has(mode)) {
    db.run(`ALTER TABLE journey_searches ADD COLUMN ${mode} INTEGER NOT NULL DEFAULT 0`);
  }
}

const serviceTable = queryOne<{ sql: string }>("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'services'")?.sql ?? "";
const serviceColumns = queryAll<{ name: string }>("PRAGMA table_info(services)").map((column) => column.name);
if (!serviceTable.includes("'Suspended'") || !serviceColumns.includes("delay_minutes") || !serviceColumns.includes("updated_at")) {
  db.run("BEGIN");
  try {
    db.exec(`
      ALTER TABLE services RENAME TO services_legacy;
      CREATE TABLE services (
        id INTEGER PRIMARY KEY,
        mode TEXT NOT NULL CHECK (mode IN ('Metro', 'Bus', 'Train')),
        name TEXT NOT NULL,
        line TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('On Time', 'Delayed', 'Suspended')),
        delay_minutes INTEGER NOT NULL DEFAULT 0,
        frequency INTEGER NOT NULL DEFAULT 8,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (mode, line)
      );
    `);
    const delayColumn = serviceColumns.includes("delay_minutes") ? "delay_minutes" : serviceColumns.includes("delay") ? "delay" : "0";
    const updatedColumn = serviceColumns.includes("updated_at") ? "updated_at" : "CURRENT_TIMESTAMP";
    db.exec(`
      INSERT INTO services (id, mode, name, line, status, delay_minutes, frequency, updated_at)
      SELECT id, mode, name, line,
        CASE status WHEN 'Minor Delays' THEN 'Delayed' WHEN 'Disrupted' THEN 'Suspended' ELSE status END,
        ${delayColumn}, frequency, ${updatedColumn}
      FROM services_legacy;
      DROP TABLE services_legacy;
    `);
    db.run("COMMIT");
  } catch (error) {
    db.run("ROLLBACK");
    throw error;
  }
}

const stopSeeds = [
  { id: 1, name: "Hyderabad Railway Station", latitude: 17.385, longitude: 78.4867, area: "Nampally" },
  { id: 2, name: "Secunderabad Railway Station", latitude: 17.4344, longitude: 78.5013, area: "Secunderabad" },
  { id: 3, name: "Ameerpet", latitude: 17.4375, longitude: 78.4483, area: "Ameerpet" },
  { id: 4, name: "Kukatpally", latitude: 17.4849, longitude: 78.4138, area: "Kukatpally" },
  { id: 5, name: "HITEC City", latitude: 17.4435, longitude: 78.3772, area: "Madhapur" },
  { id: 6, name: "Madhapur", latitude: 17.4483, longitude: 78.3915, area: "Madhapur" },
  { id: 7, name: "Gachibowli", latitude: 17.4401, longitude: 78.3489, area: "Gachibowli" },
  { id: 8, name: "LB Nagar", latitude: 17.3457, longitude: 78.5522, area: "LB Nagar" },
  { id: 9, name: "Mehdipatnam", latitude: 17.3957, longitude: 78.4312, area: "Mehdipatnam" },
  { id: 10, name: "Begumpet", latitude: 17.4448, longitude: 78.4663, area: "Begumpet" },
];

const edgeSeeds: Array<[number, number, string, string, number, number, number]> = [
  [1, 9, "Bus", "9M · Nampally–Mehdipatnam", 18, 20, 9],
  [1, 5, "Bus", "218X · Nampally–HITEC City", 60, 25, 10],
  [1, 10, "Train", "MMTS · Falaknuma–Lingampally", 16, 15, 20],
  [1, 8, "Bus", "218 · City Express", 36, 30, 12],
  [2, 10, "Train", "MMTS · Secunderabad–Lingampally", 8, 10, 15],
  [2, 3, "Metro", "Blue Line · Nagole–Raidurg", 16, 25, 6],
  [10, 3, "Metro", "Blue Line · Nagole–Raidurg", 7, 15, 6],
  [10, 9, "Bus", "49M · Begumpet–Mehdipatnam", 22, 20, 12],
  [3, 4, "Metro", "Red Line · Miyapur–LB Nagar", 18, 25, 6],
  [3, 5, "Metro", "Blue Line · Nagole–Raidurg", 19, 30, 6],
  [3, 5, "Bus", "113M · Ameerpet–HITEC City", 32, 25, 10],
  [3, 8, "Metro", "Red Line · Miyapur–LB Nagar", 31, 35, 6],
  [3, 9, "Bus", "113M · City Express", 24, 25, 12],
  [4, 5, "Bus", "10K · Kukatpally–HITEC City", 25, 25, 12],
  [4, 6, "Bus", "218D · Kukatpally–Madhapur", 21, 20, 10],
  [5, 6, "Bus", "Route 10H · HITEC City loop", 9, 15, 10],
  [5, 7, "Bus", "216 · HITEC City–Gachibowli", 17, 20, 10],
  [6, 7, "Bus", "127K · Madhapur–Gachibowli", 14, 20, 9],
  [7, 9, "Bus", "216M · Gachibowli–Mehdipatnam", 23, 25, 12],
  [8, 9, "Bus", "300 · LB Nagar–Mehdipatnam", 39, 30, 15],
];

for (const stop of stopSeeds) {
  execute(
    `INSERT INTO stops (id, name, latitude, longitude, area)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name=excluded.name, latitude=excluded.latitude,
       longitude=excluded.longitude, area=excluded.area`,
    [stop.id, stop.name, stop.latitude, stop.longitude, stop.area],
  );
}
db.run("BEGIN");
try {
  for (const [from, to, mode, line, duration, fare, frequency] of edgeSeeds) {
    db.run(
      "INSERT OR IGNORE INTO transit_edges (from_stop, to_stop, mode, line, duration, fare, frequency) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [from, to, mode, line, duration, fare, frequency],
    );
    db.run(
      "INSERT OR IGNORE INTO transit_edges (from_stop, to_stop, mode, line, duration, fare, frequency) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [to, from, mode, line, duration, fare, frequency],
    );
  }
  db.run("COMMIT");
} catch (error) {
  db.run("ROLLBACK");
  throw error;
}
const serviceSeeds = new Map<string, { mode: string; line: string; name: string; delayMinutes: number; frequency: number }>();
for (const [, , mode, line, , , frequency] of edgeSeeds) {
  const key = `${mode}|${line}`;
  if (!serviceSeeds.has(key)) {
    serviceSeeds.set(key, {
      mode,
      line,
      name: `${mode} · ${line.split("·")[0].trim()}`,
      delayMinutes: line.startsWith("218D") ? 3 : 0,
      frequency,
    });
  }
}
for (const service of serviceSeeds.values()) {
  db.run(
    `INSERT OR IGNORE INTO services (mode, name, line, status, delay_minutes, frequency)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [service.mode, service.name, service.line, service.delayMinutes ? "Delayed" : "On Time", service.delayMinutes, service.frequency],
  );
}
persistDatabase();
if ((queryOne<{ count: number }>("SELECT COUNT(*) AS count FROM service_alerts")?.count ?? 0) === 0) {
  execute("INSERT INTO service_alerts (title, description, severity, mode) VALUES (?, ?, ?, ?)", [
    "Blue Line running smoothly",
    "All stations are operating on schedule. Trains every 6 minutes.",
    "minor",
    "Metro",
  ]);
  execute("INSERT INTO service_alerts (title, description, severity, mode) VALUES (?, ?, ?, ?)", [
    "Extra buses on the western corridor",
    "Additional services are available between HITEC City and Gachibowli.",
    "minor",
    "Bus",
  ]);
}
persistDatabase();

type Stop = { id: number; name: string; latitude: number; longitude: number; area: string };
type Service = {
  id: number;
  mode: "Metro" | "Bus" | "Train";
  name: string;
  line: string;
  status: "On Time" | "Delayed" | "Suspended";
  delayMinutes: number;
  frequency: number;
  updatedAt: string;
};
type Edge = {
  id: number;
  from_stop: number;
  to_stop: number;
  mode: "Metro" | "Bus" | "Train";
  line: string;
  duration: number;
  fare: number;
  frequency: number;
};
type Leg = Edge & {
  serviceId: number;
  from: string;
  to: string;
  service: string;
  status: Service["status"];
  delayMinutes: number;
  distance: number;
};
type RouteCategory = "recommended" | "fastest" | "cheapest" | "transfers";
type Itinerary = {
  id: string;
  origin: string;
  destination: string;
  duration: number;
  fare: number;
  transfers: number;
  distance: number;
  walkingDistance: number;
  walkingDuration: number;
  delayMinutes: number;
  status: Service["status"];
  departureTime: string;
  arrivalTime: string;
  services: string[];
  stops: Array<Stop & { transfer: boolean }>;
  categories: RouteCategory[];
  legs: Leg[];
  recommended: boolean;
};

const scoreWeights: Record<string, [number, number, number, number]> = {
  fastest: [0.7, 0.1, 0.1, 0.1],
  cheapest: [0.15, 0.55, 0.15, 0.15],
  transfers: [0.15, 0.15, 0.55, 0.15],
  balanced: [0.4, 0.25, 0.2, 0.15],
};

function geographicDistance(from: Stop, to: Stop): number {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const latDelta = radians(to.latitude - from.latitude);
  const lonDelta = radians(to.longitude - from.longitude);
  const a = Math.sin(latDelta / 2) ** 2
    + Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude)) * Math.sin(lonDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function routeOptions(origin: string, destination: string, preference: string, departureAt?: string, arriveBy = false): Itinerary[] {
  const stops = queryAll<Stop>("SELECT id, name, latitude, longitude, area FROM stops ORDER BY name");
  const stopById = new Map(stops.map((stop) => [stop.id, stop]));
  const stopByName = new Map(stops.map((stop) => [stop.name, stop]));
  const start = stopByName.get(origin);
  const end = stopByName.get(destination);
  if (!start || !end || start.id === end.id) return [];

  const edges = queryAll<Edge>("SELECT id, from_stop, to_stop, mode, line, duration, fare, frequency FROM transit_edges ORDER BY id");
  const services = queryAll<Service>(
    "SELECT id, mode, name, line, status, delay_minutes AS delayMinutes, frequency, updated_at AS updatedAt FROM services",
  );
  const serviceByKey = new Map(services.map((service) => [`${service.mode}|${service.line}`, service]));
  const adjacency = new Map<number, Edge[]>();
  for (const edge of edges) {
    if (serviceByKey.get(`${edge.mode}|${edge.line}`)?.status === "Suspended") continue;
    adjacency.set(edge.from_stop, [...(adjacency.get(edge.from_stop) ?? []), edge]);
  }
  const paths: Edge[][] = [];
  const walk = (current: number, visited: Set<number>, path: Edge[]) => {
    if (current === end.id) {
      paths.push(path);
      return;
    }
    if (path.length >= 7 || paths.length >= 5000) return;
    for (const edge of adjacency.get(current) ?? []) {
      if (!visited.has(edge.to_stop)) {
        const nextVisited = new Set(visited);
        nextVisited.add(edge.to_stop);
        walk(edge.to_stop, nextVisited, [...path, edge]);
      }
    }
  };
  walk(start.id, new Set([start.id]), []);

  const build = (path: Edge[]): Itinerary => {
    const routeServices = path.map((edge) => serviceByKey.get(`${edge.mode}|${edge.line}`)).filter((service): service is Service => Boolean(service));
    const boardings = routeServices.filter((service, index) => index === 0 || service.id !== routeServices[index - 1].id);
    const transfers = Math.max(boardings.length - 1, 0);
    const serviceChanges = path.filter((edge, index) => index > 0 && (edge.mode !== path[index - 1].mode || edge.line !== path[index - 1].line)).length;
    const walkBetweenStops = transfers * 0.18;
    const walkingDistance = Math.round((0.25 + walkBetweenStops) * 10) / 10;
    const walkingDuration = Math.max(2, Math.ceil(walkingDistance / 0.08));
    const waitDuration = serviceChanges * 4;
    const delayMinutes = Math.max(...routeServices.map((service) => service.delayMinutes), 0);
    const rideDuration = path.reduce((total, edge) => total + edge.duration, 0);
    const duration = rideDuration + walkingDuration + waitDuration + delayMinutes;
    const fare = boardings.reduce((total, service) => {
      const firstLeg = path.find((edge) => edge.mode === service.mode && edge.line === service.line);
      return total + (firstLeg?.fare ?? 0);
    }, 0);
    const distance = path.reduce((total, edge) => {
      const from = stopById.get(edge.from_stop);
      const to = stopById.get(edge.to_stop);
      return total + (from && to ? geographicDistance(from, to) : 0);
    }, 0);
    const legs = path.map((edge) => {
      const service = serviceByKey.get(`${edge.mode}|${edge.line}`);
      const fromStop = stopById.get(edge.from_stop);
      const toStop = stopById.get(edge.to_stop);
      return {
        ...edge,
        serviceId: service?.id ?? 0,
        from: stopById.get(edge.from_stop)?.name ?? "",
        to: stopById.get(edge.to_stop)?.name ?? "",
        service: service?.name ?? edge.line,
        status: service?.status ?? "On Time" as const,
        delayMinutes: service?.delayMinutes ?? 0,
        distance: fromStop && toStop ? Math.round(geographicDistance(fromStop, toStop) * 10) / 10 : 0,
      };
    });
    const routeStops = [path[0].from_stop, ...path.map((edge) => edge.to_stop)]
      .map((stopId, index, routeStopIds) => {
        const stop = stopById.get(stopId);
        if (!stop) return undefined;
        const previous = path[index - 1];
        const next = path[index];
        return {
          ...stop,
          transfer: Boolean(previous && next && (previous.mode !== next.mode || previous.line !== next.line)),
        };
      })
      .filter((stop): stop is Stop & { transfer: boolean } => Boolean(stop));
    const routeId = `r-${start.id}-${end.id}-${path.map((edge) => edge.id).join(".")}`;
    const now = new Date();
    const requestedDeparture = departureAt ? new Date(departureAt) : now;
    const requestedTime = Number.isNaN(requestedDeparture.getTime()) ? now : requestedDeparture;
    const departureTime = arriveBy ? new Date(requestedTime.getTime() - duration * 60_000) : requestedTime;
    const arrivalTime = arriveBy ? requestedTime : new Date(departureTime.getTime() + duration * 60_000);
    const status = routeServices.some((service) => service.status === "Suspended")
      ? "Suspended"
      : routeServices.some((service) => service.status === "Delayed")
        ? "Delayed"
        : "On Time";
    return {
      id: routeId,
      origin,
      destination,
      duration,
      fare,
      transfers,
      distance: Math.round((distance + walkingDistance) * 10) / 10,
      walkingDistance,
      walkingDuration,
      delayMinutes,
      status,
      departureTime: departureTime.toISOString(),
      arrivalTime: arrivalTime.toISOString(),
      services: [...new Set(routeServices.map((service) => service.name))],
      stops: routeStops,
      categories: [],
      legs,
      recommended: false,
    };
  };

  const candidates = paths.map(build).sort((a, b) => a.id.localeCompare(b.id));
  const normalized = (value: number, min: number, max: number) => max === min ? 0 : (value - min) / (max - min);
  const ranges = {
    duration: [Math.min(...candidates.map((route) => route.duration)), Math.max(...candidates.map((route) => route.duration))] as [number, number],
    fare: [Math.min(...candidates.map((route) => route.fare)), Math.max(...candidates.map((route) => route.fare))] as [number, number],
    transfers: [Math.min(...candidates.map((route) => route.transfers)), Math.max(...candidates.map((route) => route.transfers))] as [number, number],
    delayMinutes: [Math.min(...candidates.map((route) => route.delayMinutes)), Math.max(...candidates.map((route) => route.delayMinutes))] as [number, number],
  };
  const scoring = (route: Itinerary, weights: [number, number, number, number]) => (
    normalized(route.duration, ranges.duration[0], ranges.duration[1]) * weights[0]
    + normalized(route.fare, ranges.fare[0], ranges.fare[1]) * weights[1]
    + normalized(route.transfers, ranges.transfers[0], ranges.transfers[1]) * weights[2]
    + normalized(route.delayMinutes, ranges.delayMinutes[0], ranges.delayMinutes[1]) * weights[3]
  );
  const ranked = (weights: [number, number, number, number]) => [...candidates].sort((a, b) =>
    scoring(a, weights) - scoring(b, weights) || a.duration - b.duration || a.id.localeCompare(b.id));
  const weights = scoreWeights[preference] ?? scoreWeights.fastest;
  const winners = new Map<RouteCategory, Itinerary>();
  winners.set("recommended", ranked(weights)[0]);
  winners.set("fastest", [...candidates].sort((a, b) => a.duration - b.duration || a.delayMinutes - b.delayMinutes || a.fare - b.fare)[0]);
  winners.set("cheapest", [...candidates].sort((a, b) => a.fare - b.fare || a.duration - b.duration || a.delayMinutes - b.delayMinutes)[0]);
  winners.set("transfers", [...candidates].sort((a, b) => a.transfers - b.transfers || a.duration - b.duration || a.fare - b.fare)[0]);
  const categoriesByRoute = new Map<string, RouteCategory[]>();
  for (const [category, route] of winners) {
    if (route) categoriesByRoute.set(route.id, [...(categoriesByRoute.get(route.id) ?? []), category]);
  }
  const selected = [...new Set(winners.values())];
  for (const route of ranked(weights)) {
    if (selected.length >= 8) break;
    if (!selected.some((item) => item.id === route.id)) selected.push(route);
  }
  return selected.filter((route): route is Itinerary => Boolean(route)).map((route) => ({
    ...route,
    recommended: route.id === winners.get("recommended")?.id,
    categories: categoriesByRoute.get(route.id) ?? [],
  }));
}

const app = express();
app.use(express.json());
app.get("/api/health", (_request, response) => response.json({ status: "ok" }));
app.get("/api/stops", (_request, response) => response.json(queryAll("SELECT id, name, latitude, longitude, area FROM stops ORDER BY name")));
function listServices() {
  return queryAll<Service>(
    "SELECT id, mode, name, line, status, delay_minutes AS delayMinutes, frequency, updated_at AS updatedAt FROM services ORDER BY mode, name",
  );
}

function addNotification(kind: string, message: string) {
  execute("INSERT INTO notifications (kind, message) VALUES (?, ?)", [kind, message]);
}

app.get("/api/services", (_request, response) => response.json(listServices()));
app.get("/api/notifications", (_request, response) => {
  response.json(queryAll("SELECT id, kind, message, created_at AS createdAt FROM notifications ORDER BY id DESC LIMIT 30"));
});
app.post("/api/notifications", (request, response) => {
  const kind = String(request.body?.kind ?? "");
  const message = String(request.body?.message ?? "").trim();
  if (!["delay", "route-change", "alternative", "saved"].includes(kind) || !message || message.length > 240) {
    response.status(400).json({ error: "A valid notification type and message are required." });
    return;
  }
  addNotification(kind, message);
  response.status(201).json({ created: true });
});

function searchRoutes(request: Request, response: Response) {
  const origin = String(request.query.from ?? "");
  const destination = String(request.query.to ?? "");
  const preference = String(request.query.preference ?? "fastest");
  if (!origin || !destination) {
    response.status(400).json({ error: "Choose both a starting point and destination." });
    return;
  }
  if (origin === destination) {
    response.status(400).json({ error: "Choose two different locations to plan a journey." });
    return;
  }
  const knownStops = new Set(queryAll<{ name: string }>("SELECT name FROM stops").map((stop) => stop.name));
  if (!knownStops.has(origin) || !knownStops.has(destination)) {
    response.status(400).json({ error: "Choose a starting point and destination from the Hyderabad transit stops." });
    return;
  }
  const departureAt = request.query.time ? String(request.query.time) : undefined;
  const routes = routeOptions(origin, destination, preference, departureAt, String(request.query.departure ?? "").toLowerCase() === "arrive by");
  const recommended = routes.find((route) => route.recommended);
  const modes = new Set(recommended?.legs.map((leg) => leg.mode) ?? []);
  if (request.query.live !== "true") {
    execute(
      "INSERT INTO journey_searches (metro, bus, train) VALUES (?, ?, ?)",
      [modes.has("Metro") ? 1 : 0, modes.has("Bus") ? 1 : 0, modes.has("Train") ? 1 : 0],
    );
  }
  response.json({
    origin,
    destination,
    preference,
    departure: String(request.query.departure ?? "now"),
    routes,
    categories: {
      recommended: routes.find((route) => route.categories.includes("recommended"))?.id,
      fastest: routes.find((route) => route.categories.includes("fastest"))?.id,
      cheapest: routes.find((route) => route.categories.includes("cheapest"))?.id,
      transfers: routes.find((route) => route.categories.includes("transfers"))?.id,
    },
  });
}

app.get("/api/routes/search", searchRoutes);
app.get("/api/routes", searchRoutes);

function getJourneyById(request: Request, response: Response) {
  const routeId = String(request.params.id);
  const saved = queryOne<{ itinerary: string }>("SELECT itinerary FROM saved_journeys WHERE id = ?", [routeId]);
  if (saved) {
    response.json(refreshSavedJourney(JSON.parse(saved.itinerary) as Itinerary));
    return;
  }
  const [routePrefix, fromValue, toValue] = routeId.split("-");
  const fromId = Number(fromValue);
  const toId = Number(toValue);
  const origin = queryOne<Stop>("SELECT id, name, latitude, longitude, area FROM stops WHERE id = ?", [fromId]);
  const destination = queryOne<Stop>("SELECT id, name, latitude, longitude, area FROM stops WHERE id = ?", [toId]);
  const journey = routePrefix === "r" && origin && destination
    ? routeOptions(origin.name, destination.name, "fastest").find((route) => route.id === routeId)
    : undefined;
  if (!journey) {
    response.status(404).json({ error: "Journey was not found." });
    return;
  }
  response.json(journey);
}
app.get("/api/routes/:id", getJourneyById);
app.get("/api/journeys/:id", getJourneyById);
app.post("/api/routes/:id/explanation", async (request, response) => {
  const routeId = String(request.params.id);
  const originId = Number(routeId.split("-")[1]);
  const destinationId = Number(routeId.split("-")[2]);
  const origin = queryOne<Stop>("SELECT id, name, latitude, longitude, area FROM stops WHERE id = ?", [originId]);
  const destination = queryOne<Stop>("SELECT id, name, latitude, longitude, area FROM stops WHERE id = ?", [destinationId]);
  const route = origin && destination
    ? routeOptions(origin.name, destination.name, "balanced").find((item) => item.id === routeId)
    : undefined;
  if (!route) {
    response.status(404).json({ error: "Route is no longer available." });
    return;
  }
  const alternative = origin && destination
    ? routeOptions(origin.name, destination.name, "cheapest").find((item) => item.id !== route.id)
    : undefined;
  const routeFacts = {
    durationMinutes: route.duration,
    fareRupees: route.fare,
    transfers: route.transfers,
    delayMinutes: route.delayMinutes,
    status: route.status,
    modes: [...new Set(route.legs.map((leg) => leg.mode))],
    services: route.services,
    alternative: alternative ? {
      durationMinutes: alternative.duration,
      fareRupees: alternative.fare,
      transfers: alternative.transfers,
    } : null,
  };
  const fallback = alternative
    ? `This ${routeFacts.modes.join(" + ")} route takes ${route.duration} minutes, costs ₹${route.fare}, and uses ${route.transfers} transfer${route.transfers === 1 ? "" : "s"}. It is ${Math.abs(alternative.duration - route.duration)} minutes ${route.duration <= alternative.duration ? "faster than" : "slower than"} the available alternative. ${route.delayMinutes ? `It currently includes a ${route.delayMinutes}-minute delay.` : "The listed services are currently on time."}`
    : `This ${routeFacts.modes.join(" + ")} route takes ${route.duration} minutes, costs ₹${route.fare}, and uses ${route.transfers} transfer${route.transfers === 1 ? "" : "s"}. ${route.delayMinutes ? `It currently includes a ${route.delayMinutes}-minute delay.` : "The listed services are currently on time."}`;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    response.json({ explanation: fallback, source: "fallback" });
    return;
  }
  try {
    const result = await fetch(process.env.OPENAI_API_URL ?? "https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(8000),
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content: "Explain why the supplied transit route is useful in one short sentence. Only restate or compare facts supplied in the JSON. Never invent stops, services, fares, times, delays, or route calculations. If the supplied facts do not establish a benefit, describe the route neutrally.",
          },
          { role: "user", content: JSON.stringify(routeFacts) },
        ],
      }),
    });
    if (!result.ok) throw new Error(`Explanation provider returned ${result.status}`);
    const payload = await result.json() as { choices?: Array<{ message?: { content?: string } }> };
    const explanation = payload.choices?.[0]?.message?.content?.trim();
    if (!explanation) throw new Error("Explanation provider returned an empty response");
    response.json({ explanation, source: "ai" });
  } catch (error) {
    console.error("Route explanation provider failed; returning deterministic explanation.", error);
    response.json({ explanation: fallback, source: "fallback" });
  }
});

type SavedJourneySnapshot = Omit<Itinerary, "legs" | "delayMinutes" | "status"> & {
  delayMinutes?: number;
  delay?: number;
  status?: string;
  legs: Array<Omit<Leg, "delayMinutes" | "status"> & { delayMinutes?: number; delay?: number; status?: string }>;
  created_at?: string;
};

function refreshSavedJourney(saved: SavedJourneySnapshot): Itinerary & { created_at?: string } {
  const current = routeOptions(saved.origin, saved.destination, "balanced").find((route) => route.id === saved.id);
  if (current) return { ...current, created_at: saved.created_at };
  const serviceById = new Map(listServices().map((service) => [service.id, service]));
  const savedDelay = Number.isFinite(saved.delayMinutes)
    ? saved.delayMinutes!
    : Number.isFinite(saved.delay)
      ? saved.delay!
      : Math.max(...saved.legs.map((leg) => leg.delayMinutes ?? leg.delay ?? 0), 0);
  const legs = saved.legs.map((leg) => {
    const service = serviceById.get(leg.serviceId);
    if (service) return { ...leg, status: service.status, delayMinutes: service.delayMinutes, service: service.name };
    const legacyStatus = String(leg.status ?? saved.status ?? "");
    const status: Service["status"] = legacyStatus === "Suspended" || legacyStatus === "Disrupted"
      ? "Suspended"
      : legacyStatus === "Delayed" || legacyStatus === "Minor Delays"
        ? "Delayed"
        : "On Time";
    const delayMinutes = status === "On Time" ? 0 : leg.delayMinutes ?? leg.delay ?? savedDelay;
    return { ...leg, status, delayMinutes };
  });
  const affected = legs.filter((leg) => leg.status !== "On Time");
  const delayMinutes = Math.max(...affected.map((leg) => leg.delayMinutes), 0);
  const status = affected.some((leg) => leg.status === "Suspended") ? "Suspended" : affected.length ? "Delayed" : "On Time";
  return {
    ...saved,
    legs,
    delayMinutes,
    status,
    duration: saved.duration + delayMinutes - savedDelay,
  };
}

app.get("/api/saved", (_request, response) => {
  const journeys = queryAll<{ itinerary: string } & Record<string, unknown>>(
    "SELECT id, origin, destination, duration, fare, transfers, itinerary, created_at FROM saved_journeys ORDER BY created_at DESC",
  );
  response.json(journeys.map((journey) => refreshSavedJourney({
    ...(JSON.parse(journey.itinerary) as Itinerary),
    created_at: String(journey.created_at ?? ""),
  })));
});

app.post("/api/saved", (request: Request, response: Response) => {
  const route = request.body as Itinerary;
  if (!route?.id || !route.origin || !route.destination || !Array.isArray(route.legs)) {
    response.status(400).json({ error: "A valid route is required to save a journey." });
    return;
  }
  execute(
    `INSERT INTO saved_journeys (id, origin, destination, duration, fare, transfers, itinerary)
     VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING`,
    [route.id, route.origin, route.destination, route.duration, route.fare, route.transfers, JSON.stringify(route)],
  );
  addNotification("saved", `Saved your journey from ${route.origin} to ${route.destination}.`);
  response.status(201).json({ saved: true, id: route.id });
});

app.delete("/api/saved/:id", (request, response) => {
  const id = String(request.params.id);
  const journey = queryOne<{ origin: string; destination: string }>(
    "SELECT origin, destination FROM saved_journeys WHERE id = ?",
    [id],
  );
  const changes = execute("DELETE FROM saved_journeys WHERE id = ?", [id]);
  if (changes === 0) {
    response.status(404).json({ error: "Saved journey was not found." });
    return;
  }
  addNotification("saved", `Removed your saved journey from ${journey?.origin ?? "a stop"} to ${journey?.destination ?? "a stop"}.`);
  response.status(204).end();
});

app.get("/api/status", (_request, response) => {
  response.json(queryAll("SELECT id, title, description, severity, mode, updated_at FROM service_alerts ORDER BY id"));
});

app.get("/api/admin/summary", (_request, response) => {
  const stops = queryOne<{ count: number }>("SELECT COUNT(*) AS count FROM stops")?.count ?? 0;
  const connections = queryOne<{ count: number }>("SELECT COUNT(*) AS count FROM transit_edges")?.count ?? 0;
  const savedJourneys = queryOne<{ count: number }>("SELECT COUNT(*) AS count FROM saved_journeys")?.count ?? 0;
  const alerts = queryOne<{ count: number }>("SELECT COUNT(*) AS count FROM service_alerts")?.count ?? 0;
  const modes = queryAll("SELECT mode, COUNT(*) AS count FROM transit_edges GROUP BY mode ORDER BY mode");
  const modeUsage = queryAll<{ mode: string; count: number }>(
    "SELECT mode, count FROM (SELECT 'Metro' AS mode, COALESCE(SUM(metro), 0) AS count FROM journey_searches UNION ALL SELECT 'Bus', COALESCE(SUM(bus), 0) FROM journey_searches UNION ALL SELECT 'Train', COALESCE(SUM(train), 0) FROM journey_searches)",
  );
  const activeServices = queryOne<{ count: number }>("SELECT COUNT(*) AS count FROM services WHERE status != 'Suspended'")?.count ?? 0;
  const delayedServices = queryOne<{ count: number }>("SELECT COUNT(*) AS count FROM services WHERE status = 'Delayed'")?.count ?? 0;
  const activeRoutes = Math.floor((queryOne<{ count: number }>(
    "SELECT COUNT(*) AS count FROM transit_edges e JOIN services s ON s.mode=e.mode AND s.line=e.line WHERE s.status != 'Suspended'",
  )?.count ?? 0) / 2);
  const todayJourneys = queryOne<{ count: number }>(
    "SELECT COUNT(*) AS count FROM journey_searches WHERE date(created_at) = date('now')",
  )?.count ?? 0;
  const journeyVolume = queryAll<{ day: string; count: number }>(
    "SELECT date(created_at) AS day, COUNT(*) AS count FROM journey_searches WHERE created_at >= datetime('now', '-6 days') GROUP BY date(created_at) ORDER BY day",
  );
  const delayByMode = queryAll<{ mode: string; minutes: number }>(
    "SELECT mode, SUM(delay_minutes) AS minutes FROM services WHERE status='Delayed' GROUP BY mode ORDER BY mode",
  );
  response.json({
    stops, connections, savedJourneys, alerts, modes, activeRoutes, activeServices, delayedServices, todayJourneys,
    journeyVolume, delayByMode, modeUsage,
  });
});

app.patch("/api/admin/services/:id", (request, response) => {
  const serviceId = Number(request.params.id);
  const service = queryOne<Service>(
    "SELECT id, mode, name, line, status, delay_minutes AS delayMinutes, frequency, updated_at AS updatedAt FROM services WHERE id = ?",
    [serviceId],
  );
  if (!service) {
    response.status(404).json({ error: "Transit service was not found." });
    return;
  }
  const preset = String(request.body?.preset ?? "");
  const status: Service["status"] = preset === "suspended" ? "Suspended"
    : preset === "normal" ? "On Time"
      : preset === "delay10" || preset === "delay15" || preset === "delay20" ? "Delayed"
        : request.body?.status;
  const delayMinutes = preset === "delay10" ? 10
    : preset === "delay15" ? 15
    : preset === "delay20" ? 20
      : preset === "normal" || preset === "suspended" ? 0
        : Number(request.body?.delayMinutes);
  if (!["On Time", "Delayed", "Suspended"].includes(status) || !Number.isInteger(delayMinutes) || delayMinutes < 0 || delayMinutes > 120
    || (status === "Delayed" && ![10, 15, 20].includes(delayMinutes)) || (status !== "Delayed" && delayMinutes !== 0)) {
    response.status(400).json({ error: "Choose Normal, a 10/20-minute delay, or Suspended." });
    return;
  }
  execute(
    "UPDATE services SET status = ?, delay_minutes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    [status, delayMinutes, serviceId],
  );
  const updated = queryOne<Service>(
    "SELECT id, mode, name, line, status, delay_minutes AS delayMinutes, frequency, updated_at AS updatedAt FROM services WHERE id = ?",
    [serviceId],
  );
  addNotification(
    status === "Delayed" || status === "Suspended" ? "delay" : "route-change",
    status === "Delayed"
      ? `${service.name} is delayed by ${delayMinutes} minutes.`
      : status === "Suspended"
        ? `${service.name} has been suspended.`
        : `${service.name} is back on time.`,
  );
  response.json(updated);
});

app.use((error: Error, _request: Request, response: Response, _next: express.NextFunction) => {
  console.error(error);
  response.status(500).json({ error: "Something went wrong while processing your request." });
});

app.listen(port, () => {
  console.log(`SmartRoute API listening at http://localhost:${port}`);
});
