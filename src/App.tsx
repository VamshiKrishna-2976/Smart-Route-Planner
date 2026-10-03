import { lazy, Suspense, useEffect, useState } from "react";
import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { HomePage } from "./pages/HomePage";
import { RoutesPage } from "./pages/RoutesPage";
import { JourneyPage } from "./pages/JourneyPage";
import { SavedPage } from "./pages/SavedPage";
import { StatusPage } from "./pages/StatusPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { getStops } from "./api";
import type { Stop } from "./types";

const AdminPage = lazy(() => import("./pages/AdminPage").then((module) => ({ default: module.AdminPage })));

export default function App() {
  const [stops, setStops] = useState<Stop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getStops()
      .then(setStops)
      .catch(() => setError("We couldn’t connect to transit data. Check that the SmartRoute API is running."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Layout>
      {loading ? (
        <div className="loading-page"><span className="spinner" /> Loading Hyderabad transit…</div>
      ) : error ? (
        <div className="page-container"><div className="error-banner">{error}</div></div>
      ) : (
        <Routes>
          <Route path="/" element={<HomePage stops={stops} />} />
          <Route path="/routes" element={<RoutesPage stops={stops} />} />
          <Route path="/journey/:id" element={<JourneyPage stops={stops} />} />
          <Route path="/saved" element={<SavedPage />} />
          <Route path="/status" element={<StatusPage />} />
          <Route path="/admin" element={<Suspense fallback={<div className="loading-page"><span className="spinner" /> Loading transit operations…</div>}><AdminPage /></Suspense>} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      )}
    </Layout>
  );
}
