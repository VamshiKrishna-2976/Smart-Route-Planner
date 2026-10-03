export type TransitMode = "Metro" | "Bus" | "Train";

export interface Stop {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  area: string;
}

export interface Leg {
  id: number;
  serviceId: number;
  from_stop: number;
  to_stop: number;
  mode: TransitMode;
  line: string;
  duration: number;
  fare: number;
  frequency: number;
  from: string;
  to: string;
  service: string;
  status: "On Time" | "Delayed" | "Suspended";
  delayMinutes: number;
  distance: number;
}

export type RouteCategory = "recommended" | "fastest" | "cheapest" | "transfers";

export interface Journey {
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
  status: "On Time" | "Delayed" | "Suspended";
  departureTime: string;
  arrivalTime: string;
  services: string[];
  stops: Array<Stop & { transfer: boolean }>;
  categories: RouteCategory[];
  legs: Leg[];
  recommended: boolean;
  created_at?: string;
}

export interface Service {
  id: number;
  mode: TransitMode;
  name: string;
  line: string;
  status: "On Time" | "Delayed" | "Suspended";
  delayMinutes: number;
  frequency: number;
  updatedAt: string;
}

export interface TransitNotification {
  id: number;
  kind: "delay" | "route-change" | "alternative" | "saved";
  message: string;
  createdAt: string;
}

export interface ServiceAlert {
  id: number;
  title: string;
  description: string;
  severity: "minor" | "moderate" | "major";
  mode: TransitMode;
  updated_at: string;
}

export interface TransitStatus {
  id: string;
  title: string;
  description: string;
  severity: string;
  mode: string;
}
