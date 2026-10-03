import axios from "axios";
import type { Journey, Service, ServiceAlert, Stop, TransitNotification } from "./types";

const api = axios.create({ baseURL: "/api" });

export async function getStops(): Promise<Stop[]> {
  return (await api.get<Stop[]>("/stops")).data;
}

export async function findRoutes(
  from: string,
  to: string,
  preference: string,
  departure: string,
  time = "",
  recordSearch = true,
): Promise<Journey[]> {
  return (await api.get<{ routes: Journey[] }>("/routes/search", {
    params: { from, to, preference, departure, time, live: !recordSearch },
  })).data.routes;
}

export async function getJourney(id: string): Promise<Journey> {
  return (await api.get<Journey>(`/routes/${encodeURIComponent(id)}`)).data;
}

export async function getServices(): Promise<Service[]> {
  return (await api.get<Service[]>("/services")).data;
}

export async function updateService(
  id: number,
  preset: "normal" | "delay10" | "delay15" | "delay20" | "suspended",
): Promise<Service> {
  return (await api.patch<Service>(`/admin/services/${id}`, { preset })).data;
}

export async function getNotifications(): Promise<TransitNotification[]> {
  return (await api.get<TransitNotification[]>("/notifications")).data;
}

export async function createNotification(kind: TransitNotification["kind"], message: string): Promise<void> {
  await api.post("/notifications", { kind, message });
}

export async function explainJourney(id: string): Promise<{ explanation: string; source: "ai" | "fallback" }> {
  return (await api.post<{ explanation: string; source: "ai" | "fallback" }>(`/routes/${encodeURIComponent(id)}/explanation`)).data;
}

export async function getSavedJourneys(): Promise<Journey[]> {
  return (await api.get<Journey[]>("/saved")).data;
}

export async function saveJourney(journey: Journey): Promise<void> {
  await api.post("/saved", journey);
}

export async function removeSavedJourney(id: string): Promise<void> {
  await api.delete(`/saved/${encodeURIComponent(id)}`);
}

export async function getServiceAlerts(): Promise<ServiceAlert[]> {
  return (await api.get<ServiceAlert[]>("/status")).data;
}

export async function getAdminSummary(): Promise<{
  stops: number;
  connections: number;
  savedJourneys: number;
  alerts: number;
  modes: Array<{ mode: string; count: number }>;
  activeRoutes: number;
  activeServices: number;
  delayedServices: number;
  todayJourneys: number;
  journeyVolume: Array<{ day: string; count: number }>;
  delayByMode: Array<{ mode: string; minutes: number }>;
  modeUsage: Array<{ mode: string; count: number }>;
}> {
  return (await api.get("/admin/summary")).data;
}

export function apiErrorMessage(reason: unknown, fallback: string): string {
  if (axios.isAxiosError<{ error?: string }>(reason)) {
    return reason.response?.data?.error ?? (reason.message || fallback);
  }
  return reason instanceof Error ? reason.message : fallback;
}
