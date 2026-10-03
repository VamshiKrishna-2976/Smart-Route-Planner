import { useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { Bell, ChevronDown, CircleUserRound, Menu, TrainFront, X } from "lucide-react";
import { getNotifications } from "../api";
import type { TransitNotification } from "../types";

const links = [
  { to: "/", label: "Plan journey" },
  { to: "/saved", label: "Saved trips" },
  { to: "/status", label: "Live status" },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<TransitNotification[]>([]);
  const [lastSeen, setLastSeen] = useState(() => Number(localStorage.getItem("smartroute-notifications-seen") ?? 0));

  useEffect(() => {
    let active = true;
    const loadNotifications = () => getNotifications().then((items) => {
      if (active) setNotifications(items);
    }).catch(() => undefined);
    void loadNotifications();
    const interval = window.setInterval(loadNotifications, 5000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  const unreadCount = notifications.filter((notification) => notification.id > lastSeen).length;

  function toggleNotifications() {
    setNotificationsOpen((open) => {
      const nextOpen = !open;
      if (nextOpen && notifications[0]) {
        setLastSeen(notifications[0].id);
        localStorage.setItem("smartroute-notifications-seen", String(notifications[0].id));
      }
      return nextOpen;
    });
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="header-inner">
          <Link to="/" className="brand" aria-label="SmartRoute home">
            <span className="brand-mark"><TrainFront size={19} strokeWidth={2.4} /></span>
            <span>smart<span className="brand-strong">route</span></span>
          </Link>
          <nav className={`main-nav ${menuOpen ? "nav-open" : ""}`} aria-label="Main navigation">
            {links.map((link) => (
              <NavLink key={link.to} to={link.to} end={link.to === "/"} onClick={() => setMenuOpen(false)}>
                {link.label}
              </NavLink>
            ))}
          </nav>
          <div className="header-actions">
            <button type="button" className="icon-button notification-button" aria-label="Notifications" aria-expanded={notificationsOpen} onClick={toggleNotifications}>
              <Bell size={19} />
              {unreadCount > 0 && <span className="notification-count">{unreadCount > 9 ? "9+" : unreadCount}</span>}
            </button>
            <button className="profile-button" type="button">
              <span className="avatar">S</span>
              <span className="profile-name">Shreya</span>
              <ChevronDown size={15} />
            </button>
            <button className="icon-button menu-toggle" type="button" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? "Close navigation" : "Open navigation"}>
              {menuOpen ? <X size={21} /> : <Menu size={21} />}
            </button>
          </div>
          {notificationsOpen && <div className="notification-panel">
            <div className="notification-panel-heading"><div><span className="section-kicker">TRANSIT UPDATES</span><h2>Notifications</h2></div><button type="button" onClick={toggleNotifications} aria-label="Close notifications"><X size={16} /></button></div>
            {notifications.length ? <div className="notification-list">{notifications.slice(0, 8).map((notification) => (
              <article className="notification-item" key={notification.id}>
                <span className={`notification-kind-icon notification-${notification.kind}`}><Bell size={14} /></span>
                <div><p>{notification.message}</p><small>{new Date(`${notification.createdAt.replace(" ", "T")}Z`).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</small></div>
              </article>
            ))}</div> : <p className="notification-empty">You’re all caught up. Service changes and saved trips will show up here.</p>}
            <Link className="notification-footer-link" to="/status" onClick={() => setNotificationsOpen(false)}>View live transit status</Link>
          </div>}
        </div>
      </header>
      <main>{children}</main>
      <footer className="site-footer">
        <Link to="/" className="footer-brand"><TrainFront size={15} /> SmartRoute</Link>
        <span>Your smarter way across the city.</span>
        <Link to="/admin" className="footer-admin">Transit operations</Link>
      </footer>
    </div>
  );
}

export function PageHeading({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) {
  return (
    <div className="page-heading">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p className="page-subtitle">{subtitle}</p>
    </div>
  );
}

export function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="empty-state">
      <span className="empty-icon"><CircleUserRound size={22} /></span>
      <h2>{title}</h2>
      <p>{detail}</p>
      <Link className="button button-primary" to="/">Plan a journey</Link>
    </div>
  );
}
