import { Link } from "react-router-dom";
import { PageHeading } from "../components/Layout";

export function NotFoundPage() {
  return <div className="page-container content-page"><PageHeading eyebrow="A SMALL DETOUR" title="This stop isn’t on our map." subtitle="Let’s get you back to a route that works." /><Link to="/" className="button button-primary">Back to SmartRoute</Link></div>;
}
