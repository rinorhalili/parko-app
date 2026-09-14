import { lazy, Suspense, useEffect, useState } from "react";
import { AuthProvider } from "./context/AuthContext";
import { NotificationProvider } from "./context/NotificationContext";
import { LoadingState } from "./components/LoadingState";

const HomePage = lazy(() => import("./pages/HomePage"));
const ParkingDetailsPage = lazy(() => import("./pages/ParkingDetailsPage"));
const CommunityFeedPage = lazy(() => import("./pages/CommunityFeedPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const FavoritesPage = lazy(() => import("./pages/FavoritesPage"));
const ParkingHistoryPage = lazy(() => import("./pages/ParkingHistoryPage"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage"));
const ReportParkingPage = lazy(() => import("./pages/ReportParkingPage"));
const ReservationPage = lazy(() => import("./pages/ReservationPage"));
const ModerationPage = lazy(() => import("./pages/ModerationPage"));
const AdminDashboard = lazy(() => import("./AdminDashboard"));
const PrivacyPolicy = lazy(() => import("./PrivacyPolicy"));
const Terms = lazy(() => import("./Terms"));
const NotFound = lazy(() => import("./NotFound"));

function normalizePathname(pathname: string) {
  const basePath = import.meta.env.BASE_URL === "/" ? "" : import.meta.env.BASE_URL.replace(/\/$/, "");
  const withoutBase = basePath && pathname.startsWith(basePath) ? pathname.slice(basePath.length) : pathname;
  return withoutBase.replace(/\/+$/, "") || "/";
}

function routeFor(rawPathname: string) {
  const pathname = normalizePathname(rawPathname);
  const params = new URLSearchParams(window.location.search);
  const view = params.get("view");
  const adminFlag = params.get("admin");
  if (view === "dashboard" || adminFlag === "1" || adminFlag === "true" || pathname === "/admin" || pathname === "/dashboard") return <AdminDashboard />;
  if (view === "privacy" || pathname === "/privacy") return <PrivacyPolicy />;
  if (view === "terms" || pathname === "/terms") return <Terms />;
  if (pathname === "/" || pathname === "") return window.electronAPI ? <AdminDashboard /> : <HomePage />;
  if (pathname.startsWith("/parking/")) return <ParkingDetailsPage />;
  if (pathname === "/community") return <CommunityFeedPage />;
  if (pathname === "/profile") return <ProfilePage />;
  if (pathname === "/settings") return <SettingsPage />;
  if (pathname === "/favorites") return <FavoritesPage />;
  if (pathname === "/parking-history") return <ParkingHistoryPage />;
  if (pathname === "/notifications") return <NotificationsPage />;
  if (pathname === "/report-parking") return <ReportParkingPage />;
  if (pathname === "/reservations") return <ReservationPage />;
  if (pathname === "/moderation") return <ModerationPage />;
  return <NotFound />;
}

export default function Router() {
  const [pathname, setPathname] = useState(window.location.pathname);

  useEffect(() => {
    const normalized = normalizePathname(pathname);
    const titles: Record<string, string> = {
      "/": "Parko - Parking në Prishtinë",
      "/admin": "Paneli i Administratës - Parko",
      "/dashboard": "Paneli i Administratës - Parko",
      "/privacy": "Politika e Privatësisë - Parko",
      "/terms": "Kushtet e Përdorimit - Parko",
      "/community": "Komuniteti - Parko",
      "/profile": "Profili - Parko",
      "/settings": "Cilësimet - Parko",
      "/favorites": "Të ruajtura - Parko",
      "/parking-history": "Historiku - Parko",
      "/notifications": "Njoftimet - Parko",
      "/report-parking": "Raporto parking - Parko",
      "/reservations": "Rezervimet - Parko",
      "/moderation": "Moderimi - Parko",
    };
    document.title = normalized.startsWith("/parking/") ? "Detajet e parkingut - Parko" : (titles[normalized] ?? "Faqja nuk u gjet - Parko");
  }, [pathname]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest("a[href]") as HTMLAnchorElement | null;
      if (!link || link.target || link.origin !== window.location.origin) return;
      event.preventDefault();
      window.history.pushState({}, "", link.href);
      setPathname(window.location.pathname);
    };
    const onPopState = () => setPathname(window.location.pathname);
    document.addEventListener("click", onClick);
    window.addEventListener("popstate", onPopState);
    return () => {
      document.removeEventListener("click", onClick);
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  return (
    <AuthProvider>
      <NotificationProvider>
        <Suspense fallback={<LoadingState />}>{routeFor(pathname)}</Suspense>
      </NotificationProvider>
    </AuthProvider>
  );
}
