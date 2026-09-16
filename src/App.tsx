import NavigationView from "./NavigationView";
import { AppIcon } from "./ui/Icon";
import { BottomSheet, SheetHandle, MapFloatingControl, ParkingActions, PrimaryButton, StatusBadge, InfoRow } from "./ui/components";
import { useRoutingOrigin } from "./hooks/useRoutingOrigin";
import Onboarding from "./onboarding/Onboarding";
import { useOnboarding } from "./onboarding/useOnboarding";
import { LeavingButton, SpotVouching, useCrowdSourcing } from "./crowdsourcing";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  loadVerifiedAvailability,
  mergeVerifiedAvailability,
} from "./availabilityApi";
import LiveParkingMap, { DEFAULT_MAP_SETTINGS } from "./LiveParkingMap";
import {
  reverseGeocodeLocation,
  searchDestinationOnline,
  searchLocalDestinations,
} from "./geocodingApi";
import {
  distanceMeters,
  rankParkings,
  walkableParkingCandidates,
} from "./parkingRanking";
import {
  getPrishtinaParkingSnapshot,
  isWithinPrishtinaMap,
  loadParkingGeometry,
  loadPrishtinaParkings,
  PRISHTINA_CENTER,
  USER_LOCATION,
} from "./parkingApi";
import { parkingAccessPoint } from "./parkingGeometry";
import { PRISHTINA_PARKING_RULES_URL } from "./prishtinaParkingRules";
import { loadPreferences, savePreferences } from "./persistence";
import {
  loadDrivingMatrix,
  loadDrivingRoute,
  loadWalkingRoute,
} from "./routingApi";
import { kartaViewUrl, walkingDirectionsUrl } from "./streetView";
import { handleOpenExternal } from "./externalLinks";
import { captureEvent } from "./telemetry";
import {
  submitParkingObservation,
  type CommunityParkingReport,
} from "./communityApi";
import { useAuth } from "./hooks/useAuth";
import { changePassword, deleteAccount, updateProfile } from "./api/userService";
import { logout } from "./api/authService";
import {
  listFavorites,
  removeParkingFavorite,
  saveParkingFavorite,
} from "./api/favoritesService";
import {
  cancelReservation,
  listMyReservations,
  type Reservation,
} from "./api/reservationService";
import { useSocket } from "./hooks/useSocket";
import { prepareImageAttachment } from "./imageAttachment";
import type { User } from "./api/types";
import type { DrivingMatrixEntry } from "./routingApi";
import type {
  Destination,
  DrivingRoute,
  Filters,
  MapMarkerFilter,
  MapSettings,
  MapVariant,
  Parking,
  ParkingLoadStatus,
  ParkingPalette,
  ParkingPreference,
  RankedParking,
  Screen,
} from "./types";

const EMPTY_SELECTED_PARKING: Parking = {
  id: "__blank-parking__",
  name: "Parking",
  zone: "Prishtinë",
  address: "Prishtinë, Kosovë",
  capacity: null,
  spaces: null,
  status: "unknown",
  pricePerHour: null,
  distanceMeters: 0,
  driveMinutes: 0,
  confidence: "low",
  updatedMinutesAgo: 0,
  type: "public",
  open24h: false,
  covered: false,
  cardPayment: false,
  evCharging: false,
  accessible: false,
  free: false,
  coordinates: PRISHTINA_CENTER,
  access: "unknown",
  source: "community",
};

const Login = lazy(() => import("./Login"));
const CommunityView = lazy(() => import("./CommunityView"));
const CommunitySpots = lazy(() => import("./CommunitySpots"));

const initialFilters: Filters = {
  availableOnly: false,
  verifiedOnly: false,
  maxPrice: 2,
  type: "all",
  freeOnly: false,
  paidOnly: false,
  evCharging: false,
  accessible: false,
  mapMarkerFilter: "all",
};

function normalizedMapSettings(value?: Partial<MapSettings>): MapSettings {
  const variant =
    value?.variant && ["standard", "minimal", "dark", "satellite"].includes(value.variant)
      ? value.variant
      : DEFAULT_MAP_SETTINGS.variant;
  const parkingPalette =
    value?.parkingPalette &&
    ["green", "price", "operator"].includes(value.parkingPalette)
      ? value.parkingPalette
      : DEFAULT_MAP_SETTINGS.parkingPalette;
  return { ...DEFAULT_MAP_SETTINGS, ...value, variant, parkingPalette };
}

const RECENT_DESTINATIONS_KEY = "parko-recent-destinations";
const PARKING_REPORTS_KEY = "parko-parking-reports:v1";
type LocationStatus =
  | "idle"
  | "locating"
  | "ready"
  | "outside"
  | "denied"
  | "unavailable";
type SheetState = "collapsed" | "medium" | "expanded";

function subtleHaptic(duration = 8) {
  if ("vibrate" in navigator) navigator.vibrate(duration);
}


type ParkingReport = CommunityParkingReport;
type ParkingReportPatch = Pick<
  ParkingReport,
  "availability" | "payment" | "policeRisk" | "media"
>;

function reportAgeLabel(report?: ParkingReport) {
  if (!report) return "";
  const minutes = Math.max(
    0,
    Math.round((Date.now() - report.updatedAt) / 60_000),
  );
  if (minutes < 1) return "tani";
  return `${minutes} min me pare`;
}

function reportMessage(parking: Parking, report?: ParkingReport) {
  if (
    report?.availability === "free-spots" ||
    (parking.spaces !== null && parking.spaces > 0)
  ) {
    const spaces =
      parking.spaces !== null && parking.spaces > 0
        ? `${parking.spaces} vende te lira`
        : "ka vende te lira";
    return `Raportim live: ${spaces}${report ? ` • ${reportAgeLabel(report)}` : ""}`;
  }
  if (report?.availability === "full" || parking.status === "full")
    return `Raportim live: parkingu duket plot${report ? ` • ${reportAgeLabel(report)}` : ""}`;
  return "Ska raportime per parking te lire ne kete zone";
}

function policeRiskLabel(report?: ParkingReport) {
  if (!report || report.policeRisk === undefined) return "Siguria: pa raport";
  return report.policeRisk ? "Siguria: polici afër" : "Siguria: duket qetë";
}

function applyParkingReport(parking: Parking, report?: ParkingReport): Parking {
  if (
    !report ||
    Date.now() - report.updatedAt >= 30 * 60_000 ||
    parking.access === "no"
  )
    return parking;
  const ageMinutes = Math.max(
    0,
    Math.round((Date.now() - report.updatedAt) / 60_000),
  );
  const paymentUpdate =
    report.payment === "free"
      ? { pricePerHour: 0, free: true }
      : report.payment === "paid" && parking.pricePerHour === 0
        ? { pricePerHour: null, free: false }
        : report.payment === "paid"
          ? { free: false }
          : {};
  const availabilityUpdate =
    report.availability === "free-spots"
      ? {
          spaces: null,
          status: "available" as const,
          availabilitySource: "Raport perdoruesi",
          updatedMinutesAgo: ageMinutes,
          availabilityUpdatedAt: new Date(report.updatedAt).toISOString(),
        }
      : report.availability === "full"
        ? {
            spaces: null,
            status: "full" as const,
            availabilitySource: "Raport perdoruesi",
            updatedMinutesAgo: ageMinutes,
            availabilityUpdatedAt: new Date(report.updatedAt).toISOString(),
          }
        : {};
  return {
    ...parking,
    ...(parking.pricingSource ? {} : paymentUpdate),
    ...availabilityUpdate,
  };
}
function loadRecentDestinations(): Destination[] {
  try {
    const value = JSON.parse(
      localStorage.getItem(RECENT_DESTINATIONS_KEY) ?? "[]",
    ) as Destination[];
    return Array.isArray(value) ? value.slice(0, 5) : [];
  } catch {
    return [];
  }
}

function loadParkingReports(): Record<string, ParkingReport> {
  try {
    const value = JSON.parse(
      localStorage.getItem(PARKING_REPORTS_KEY) ?? "{}",
    ) as Record<string, ParkingReport>;
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

function saveParkingReports(value: Record<string, ParkingReport>) {
  try {
    localStorage.setItem(PARKING_REPORTS_KEY, JSON.stringify(value));
  } catch {
    /* Storage may be unavailable. */
  }
}

function StatusBar({ light = false }: { light?: boolean }) {
  const time = new Intl.DateTimeFormat("sq-AL", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
  return (
    <div
      className={`status-bar ${light ? "status-bar--light" : ""}`}
      aria-hidden="true"
    >
      <span>{time}</span>
      <span className="status-icons">▮▮▮ ⌁ ▰</span>
    </div>
  );
}

function IosInstallPrompt() {
  const [visible, setVisible] = useState(() => {
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    return (
      isIos &&
      !standalone &&
      localStorage.getItem("parko-ios-install-dismissed") !== "1"
    );
  });
  if (!visible) return null;
  return (
    <aside className="ios-install-prompt" role="status">
      <span className="ios-install-prompt__icon">↑</span>
      <p>
        <b>Instalo Parko në iPhone</b>
        <small>Në Safari prek Share, pastaj “Add to Home Screen”.</small>
      </p>
      <button
        onClick={() => {
          localStorage.setItem("parko-ios-install-dismissed", "1");
          setVisible(false);
        }}
        aria-label="Mbyll udhëzimin e instalimit"
      >
        ×
      </button>
    </aside>
  );
}

function priceLabel(parking: Parking) {
  if (parking.pricePerHour === null) return "Pa çmim";
  return parking.pricePerHour === 0
    ? "Falas"
    : `${parking.pricePerHour.toFixed(2)} €/orë`;
}

function accessLabel(parking: Parking) {
  return {
    public: "Qasje publike",
    permissive: "Qasje e lejuar",
    customers: "Vetëm për klientë",
    private: "Privat",
    permit: "Vetëm me leje",
    no: "Pa qasje publike",
    unknown: "Qasja nuk është konfirmuar",
  }[parking.access];
}

function availabilityLabel(parking: Parking) {
  if (
    parking.availabilitySource &&
    parking.spaces === null &&
    parking.status !== "unknown"
  )
    return `Komuniteti: ${parking.status === "full" ? "raportuar i zënë" : "raportuar i lirë"} · ${parking.updatedMinutesAgo} min më parë`;
  if (parking.spaces !== null)
    return `${parking.spaces} vende të lira${parking.updatedMinutesAgo ? ` • ${parking.updatedMinutesAgo} min më parë` : " • tani"}`;
  if (parking.capacity !== null)
    return `Kapacitet ${parking.capacity} • vendet e lira nuk dihen`;
  return "Disponueshmëria nuk raportohet live";
}

function parkingTrust(parking: Parking) {
  if (parking.availabilitySource)
    return {
      tone: "live",
      label: `Live · ${parking.availabilitySource}`,
      detail: parking.updatedMinutesAgo
        ? `Përditësuar ${parking.updatedMinutesAgo} min më parë`
        : "Përditësuar tani",
    };
  if (parking.municipalManaged)
    return {
      tone: "official",
      label: "Operator i identifikuar",
      detail:
        "Operatori është i identifikuar; shfaqen vetëm të dhënat e konfirmuara.",
    };
  if (parking.confidence === "high")
    return {
      tone: "mapped",
      label:
        parking.source === "openstreetmap"
          ? "OSM · e dokumentuar"
          : "E verifikuar",
      detail:
        parking.source === "openstreetmap"
          ? "Lokacioni dhe konturi janë të hartuar; disponueshmëria nuk është live."
          : "Lokacioni është pranuar si parking i verifikuar.",
    };
  if (parking.confidence === "medium")
    return {
      tone: "partial",
      label:
        parking.source === "openstreetmap"
          ? "OSM · e pjesshme"
          : "E verifikuar pjesërisht",
      detail:
        parking.source === "openstreetmap"
          ? "Disa të dhëna mungojnë; kontrollo tabelën dhe hyrjen."
          : "Parkingu është në listë të verifikuar, por disa detaje mungojnë.",
    };
  return {
    tone: "unknown",
    label: "E pakonfirmuar",
    detail: "Vetëm lokacioni bazë është i hartuar.",
  };
}

function DataTrustBadge({
  parking,
  detailed = false,
}: {
  parking: Parking;
  detailed?: boolean;
}) {
  const trust = parkingTrust(parking);
  return (
    <span
      className={`data-trust data-trust--${trust.tone} ${detailed ? "data-trust--detailed" : ""}`}
    >
      <i />
      <span>
        <b>{trust.label}</b>
        {detailed && <small>{trust.detail}</small>}
      </span>
    </span>
  );
}

function municipalCategoryLabel(parking: Parking) {
  if (!parking.municipalCategory) return null;
  return {
    residential: "Rezidencial",
    commercial: "Komercial",
    combined: "I kombinuar",
    barrier: "Me rampë",
  }[parking.municipalCategory];
}

function parkingTypeLabel(parking: Parking) {
  if (parking.municipalManaged) return "Prishtina Parking";
  return {
    public: "Publik",
    private: "Privat",
    street: "Në rrugë",
  }[parking.type];
}

function BottomNav({
  active = "home",
  onHome,
  onProfile,
  onSettings,
}: {
  active?: "home" | "profile" | "settings";
  onHome?: () => void;
  onProfile: () => void;
  onSettings: () => void;
}) {
  return (
    <nav className="bottom-nav" aria-label="Navigimi kryesor">
      <button
        className={`bottom-nav__item ${active === "home" ? "bottom-nav__item--active" : ""}`}
        onClick={onHome}
        aria-current={active === "home" ? "page" : undefined}
      >
        <span>
          <AppIcon name="map" />
        </span>
        Harta
      </button>
      <button
        className={`bottom-nav__item ${active === "profile" ? "bottom-nav__item--active" : ""}`}
        onClick={onProfile}
        aria-current={active === "profile" ? "page" : undefined}
      >
        <span>
          <AppIcon name="user" />
        </span>
        Profili
      </button>
      <button
        className={`bottom-nav__item ${active === "settings" ? "bottom-nav__item--active" : ""}`}
        onClick={onSettings}
        aria-current={active === "settings" ? "page" : undefined}
      >
        <span>
          <AppIcon name="settings" />
        </span>
        Cilësimet
      </button>
    </nav>
  );
}

function verifiedPriceLabel(parking: Parking) {
  return parking.pricingSource ? priceLabel(parking) : null;
}

function parkingSourceLabel(parking: Parking) {
  if (parking.municipalManaged) return "Prishtina Parking";
  if (parking.source === "openstreetmap" && parking.confidence !== "low")
    return "OpenStreetMap";
  if (parking.confidence !== "low") return "Parko · e verifikuar";
  return "Burim i pakonfirmuar";
}

function ParkingCard({
  parking,
  smartMatch,
  showSource = true,
  showDriving = false,
  onOpen,
}: {
  parking: Parking;
  smartMatch?: RankedParking;
  showSource?: boolean;
  showDriving?: boolean;
  onOpen: () => void;
}) {
  const verifiedPrice = verifiedPriceLabel(parking);
  const liveAvailability =
    parking.status !== "unknown" && parking.availabilitySource
      ? availabilityLabel(parking)
      : null;
  const sourceLabel = parkingSourceLabel(parking);
  const showInlineSource =
    showSource && sourceLabel !== parkingTypeLabel(parking);
  const journey = [
    ...(smartMatch ? [`≈ ${smartMatch.walkMinutes} min ecje`] : []),
    ...(showDriving ? [`≈ ${smartMatch?.driveMinutes ?? parking.driveMinutes} min vozitje`] : []),
  ];
  return (
    <article
      className="parking-card"
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`Hap detajet për ${parking.name}`}
    >
      <div
        className={`parking-card__icon parking-card__icon--${parking.municipalManaged ? "municipal" : parking.type}`}
      >
        {smartMatch?.rank ?? "P"}
      </div>
      <div className="parking-card__content">
        <strong>{parking.name}</strong>
        {liveAvailability && (
          <span
            className={`availability-text availability-text--${parking.status}`}
          >
            {liveAvailability}
          </span>
        )}
        <small>{[...journey, verifiedPrice].filter(Boolean).join(" • ")}</small>
        <span className="parking-card__meta">
          <span
            className={`parking-kind parking-kind--${parking.municipalManaged ? "municipal" : parking.type}`}
          >
            {parkingTypeLabel(parking)}
          </span>
          {showInlineSource && (
            <small className="parking-card__source">{sourceLabel}</small>
          )}
        </span>
      </div>
      <span className="parking-card__chevron" aria-hidden="true">
        <AppIcon name="chevron" size={18} />
      </span>
    </article>
  );
}

function StreetViewPanel({
  parking,
  onClose,
}: {
  parking: Parking;
  onClose: () => void;
}) {
  const target = parking.accessPoint ?? parking.coordinates;
  return (
    <section
      className="street-view-panel"
      role="dialog"
      aria-modal="true"
      aria-label={`KartaView për ${parking.name}`}
    >
      <header>
        <button type="button" onClick={onClose} aria-label="Mbyll KartaView">
          ×
        </button>
        <span>
          <small>KartaView</small>
          <strong>{parking.name}</strong>
        </span>
      </header>
      <iframe
        title={`KartaView ${parking.name}`}
        src={kartaViewUrl(parking)}
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        allow="fullscreen"
      />
      <p>
        <b>
          {target.lat.toFixed(5)}, {target.lng.toFixed(5)}
        </b>
        <span>{parking.address || "Lokacioni i parkingut"}</span>
      </p>
    </section>
  );
}

type ParkingTypeFilter = Extract<
  Filters["type"],
  "all" | "public" | "private" | "street" | "municipal"
>;
type ParkingTypeCounts = Record<ParkingTypeFilter, number>;
type ParkingFeatureCounts = {
  verified: number;
  free: number;
  paid: number;
  ev: number;
  accessible: number;
  live: number;
};

const parkingTypeOptions: Array<[ParkingTypeFilter, string, string]> = [
  ["all", "Të gjitha", "Çdo operator"],
  ["municipal", "Prishtina Parking", "Operatori zyrtar"],
  ["public", "Publike", "Qasje publike"],
  ["street", "Në rrugë", "Parking anësor"],
  ["private", "Private", "Me qasje të kufizuar"],
];

function parkingMatchesType(parking: Parking, type: ParkingTypeFilter) {
  if (type === "all") return true;
  if (type === "municipal") return Boolean(parking.municipalManaged);
  if (parking.municipalManaged) return false;
  return parking.type === type;
}

function accuracyLabel(accuracy: number | null) {
  if (!accuracy) return "";
  return ` · ±${Math.round(accuracy)} m`;
}

function locationStatusLabel(status: LocationStatus, accuracy: number | null) {
  if (status === "locating") return "Duke gjetur GPS-in…";
  if (status === "ready") return `GPS live${accuracyLabel(accuracy)}`;
  if (status === "outside") return "GPS jashtë Prishtinës";
  if (status === "denied") return "Leja e GPS-it u refuzua";
  if (status === "unavailable") return "GPS nuk u gjet";
  return "Përdor GPS-in";
}

function locationActionLabel(status: LocationStatus) {
  if (status === "locating") return "Duke gjetur lokacionin";
  if (status === "ready") return "Lokacioni live në Prishtinë";
  if (status === "outside") return "Lokacioni yt është jashtë Prishtinës";
  if (status === "denied") return "Leja e lokacionit është refuzuar";
  if (status === "unavailable") return "GPS nuk është i disponueshëm";
  return "Përdor lokacionin tim";
}

function ParkingTypeChooser({
  value,
  counts,
  onChange,
}: {
  value: ParkingTypeFilter;
  counts: ParkingTypeCounts;
  onChange: (type: ParkingTypeFilter) => void;
}) {
  return (
    <div
      className="parking-type-chooser"
      aria-label="Zgjedh llojin e parkingut"
    >
      {parkingTypeOptions.map(([type, label, description]) => (
        <button
          key={type}
          className={value === type ? "selected" : ""}
          aria-pressed={value === type}
          disabled={type !== "all" && counts[type] === 0}
          onClick={() => onChange(type)}
        >
          <span>
            <strong>{label}</strong>
            <small>{description}</small>
          </span>
          <b>{counts[type]}</b>
        </button>
      ))}
    </div>
  );
}

function ParkingReportPanel({
  parking,
  report,
  compact = false,
  onReport,
}: {
  parking: Parking;
  report?: ParkingReport;
  compact?: boolean;
  onReport: (parkingId: string, patch: ParkingReportPatch) => Promise<void>;
}) {
  const [photoError, setPhotoError] = useState("");
  const [draft, setDraft] = useState<ParkingReportPatch>({});
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => {
    setDraft({});
    setPhotoError("");
  }, [parking.id]);
  const reportSource = report
    ? `Raportuar ${reportAgeLabel(report)}`
    : parking.availabilitySource
      ? parking.availabilitySource
      : "Pa raport komuniteti";
  const availability = draft.availability ?? report?.availability;
  const payment = draft.payment ?? report?.payment;
  const policeRisk = draft.policeRisk ?? report?.policeRisk;
  const canSubmit = Boolean(
    draft.availability ||
    draft.payment ||
    draft.policeRisk !== undefined ||
    draft.media?.length,
  );
  const attachPhoto = async (file?: File) => {
    if (!file) return;
    try {
      const photo = await prepareImageAttachment(file);
      setPhotoError("");
      setDraft((current) => ({ ...current, media: [photo] }));
    } catch (error) {
      setPhotoError(
        error instanceof Error ? error.message : "Fotoja nuk u përgatit.",
      );
    }
  };
  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setPhotoError("");
    try {
      await onReport(parking.id, draft);
      setDraft({});
    } catch (error) {
      setPhotoError(
        error instanceof Error ? error.message : "Raportimi nuk u dërgua.",
      );
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <section
      className={`parking-report-panel ${compact ? "parking-report-panel--compact" : ""}`}
      aria-label="Raportimet live per zonen e zgjedhur"
    >
      <header className="parking-report-panel__header">
        <span>
          <small>Live</small>
          <strong>Raporto shpejt</strong>
        </span>
        <b title={parking.name}>{parking.name}</b>
      </header>
      <div className="parking-report-panel__status">
        <strong>{reportMessage(parking, report)}</strong>
        <span>
          {reportSource} • {policeRiskLabel(report)}
        </span>
      </div>
      {report?.media?.map((item) => (
        <img
          className="community-post-photo"
          key={item.url}
          src={item.url}
          alt={`Foto e raportit për ${parking.name}`}
          loading="lazy"
        />
      ))}
      <div className="quick-report-groups" aria-label="Raporto parkingun">
        <div className="quick-report-group">
          <p>Vendet</p>
          <div className="quick-report-grid">
            <button
              className={availability === "free-spots" ? "selected" : ""}
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  availability: "free-spots",
                }))
              }
              aria-pressed={availability === "free-spots"}
            >
              <span>+</span>Ka vende
            </button>
            <button
              className={availability === "full" ? "selected" : ""}
              onClick={() =>
                setDraft((current) => ({ ...current, availability: "full" }))
              }
              aria-pressed={availability === "full"}
            >
              <span>0</span>S'ka vende
            </button>
          </div>
        </div>
        <div className="quick-report-group">
          <p>Pagesa</p>
          <div className="quick-report-grid">
            <button
              className={
                payment === "free" || (!payment && parking.free)
                  ? "selected"
                  : ""
              }
              onClick={() =>
                setDraft((current) => ({ ...current, payment: "free" }))
              }
              aria-pressed={payment === "free"}
            >
              <span>€0</span>Falas
            </button>
            <button
              className={payment === "paid" ? "selected" : ""}
              onClick={() =>
                setDraft((current) => ({ ...current, payment: "paid" }))
              }
              aria-pressed={payment === "paid"}
            >
              <span>€</span>Me pagesë
            </button>
          </div>
        </div>
        <div className="quick-report-group">
          <p>Siguria</p>
          <div className="quick-report-grid">
            <button
              className={policeRisk === true ? "selected danger" : ""}
              onClick={() =>
                setDraft((current) => ({ ...current, policeRisk: true }))
              }
              aria-pressed={policeRisk === true}
            >
              <span>!</span>Polici afër
            </button>
            <button
              className={policeRisk === false ? "selected safe" : ""}
              onClick={() =>
                setDraft((current) => ({ ...current, policeRisk: false }))
              }
              aria-pressed={policeRisk === false}
            >
              <span>✓</span>Qetë
            </button>
          </div>
        </div>
      </div>
      <label className="image-attachment-control">
        📷{" "}
        <span>
          {draft.media?.length ? "Foto e bashkëngjitur" : "Shto foto në raport"}
        </span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            void attachPhoto(file);
          }}
        />
      </label>
      {draft.media?.map((item) => (
        <img
          className="community-post-photo"
          key={item.url}
          src={item.url}
          alt="Pamja paraprake e fotos së raportit"
        />
      ))}
      <button
        className="login-button"
        type="button"
        onClick={() => void submit()}
        disabled={!canSubmit || submitting}
      >
        {submitting ? "Duke dërguar…" : "Dërgo raportin"}
      </button>
      {photoError && (
        <small className="crowd-card__error" role="alert">
          {photoError}
        </small>
      )}
    </section>
  );
}

function matchesFilters(parking: Parking, filters: Filters) {
  const matchesAvailability =
    !filters.availableOnly ||
    parking.status === "available" ||
    parking.status === "limited";
  const matchesVerified = !filters.verifiedOnly || parking.confidence !== "low";
  const matchesPrice =
    filters.maxPrice >= 2 ||
    (parking.pricePerHour !== null && parking.pricePerHour <= filters.maxPrice);
  const matchesType = parkingMatchesType(
    parking,
    filters.type as ParkingTypeFilter,
  );
  const matchesFree =
    !filters.freeOnly || (parking.free && Boolean(parking.pricingSource));
  const matchesPaid =
    !filters.paidOnly ||
    (parking.pricePerHour !== null &&
      parking.pricePerHour > 0 &&
      Boolean(parking.pricingSource));
  return (
    matchesAvailability &&
    matchesVerified &&
    matchesPrice &&
    matchesType &&
    matchesFree &&
    matchesPaid &&
    (!filters.evCharging || parking.evCharging) &&
    (!filters.accessible || parking.accessible)
  );
}

function filtersForAvailability(
  filters: Filters,
  hasLiveAvailability: boolean,
): Filters {
  return hasLiveAvailability ? filters : { ...filters, availableOnly: false };
}

function HomeView({
  mapParkings,
  selected,
  filters,
  hasLiveAvailability,
  query,
  onQuery,
  searchResults,
  recentDestinations,
  searchOpen,
  searchingOnline,
  searchError,
  online,
  destination,
  walkingMinutes,
  preference,
  route,
  rankedParkings,
  showAllResults,
  pickingDestination,
  parkingPreviewOpen,
  typeCounts,
  featureCounts,
  onSelect,
  onSelectDestination,
  onClearRecent,
  onSearchFocus,
  onSearchOnline,
  onCloseSearch,
  onClearDestination,
  onWalkingMinutes,
  onPreference,
  onParkingType,
  onFiltersChange,
  onToggleShowAll,
  onStartMapPick,
  onPickDestination,
  recenterToken,
  onRecenter,
  locationStatus,
  locationAccuracy,
  userLocation,
  onDetails,
  onNavigate,
  onStreetView,
  onCloseParkingPreview,
  onProfile,
  onSettings,
  mapSettings,
  mapMarkerFilter,
  onMapMarkerFilter,
  loadStatus,
}: {
  mapParkings: Parking[];
  selected: Parking;
  filters: Filters;
  hasLiveAvailability: boolean;
  query: string;
  onQuery: (value: string) => void;
  searchResults: Destination[];
  recentDestinations: Destination[];
  searchOpen: boolean;
  searchingOnline: boolean;
  searchError: string;
  online: boolean;
  destination: Destination | null;
  walkingMinutes: 5 | 10 | 15;
  preference: ParkingPreference;
  route: DrivingRoute | null;
  rankedParkings: RankedParking[];
  showAllResults: boolean;
  pickingDestination: boolean;
  parkingPreviewOpen: boolean;
  typeCounts: ParkingTypeCounts;
  featureCounts: ParkingFeatureCounts;
  onSelect: (parking: Parking) => void;
  onSelectDestination: (destination: Destination) => void;
  onClearRecent: () => void;
  onSearchFocus: () => void;
  onSearchOnline: () => void;
  onCloseSearch: () => void;
  onClearDestination: () => void;
  onWalkingMinutes: (minutes: 5 | 10 | 15) => void;
  onPreference: (preference: ParkingPreference) => void;
  onParkingType: (type: ParkingTypeFilter) => void;
  onFiltersChange: (filters: Filters) => void;
  onToggleShowAll: () => void;
  onStartMapPick: () => void;
  onPickDestination: (coordinates: { lat: number; lng: number }) => void;
  recenterToken: number;
  onRecenter: () => void;
  locationStatus: LocationStatus;
  locationAccuracy: number | null;
  userLocation: Parking["coordinates"];
  onDetails: () => void;
  onNavigate: () => void;
  onStreetView: () => void;
  onCloseParkingPreview: () => void;
  onProfile: () => void;
  onSettings: () => void;
  mapSettings: MapSettings;
  mapMarkerFilter: MapMarkerFilter;
  mapMarkerCounts: Record<MapMarkerFilter, number>;
  onMapMarkerFilter: (filter: MapMarkerFilter) => void;
  loadStatus: ParkingLoadStatus;
}) {
  const [sheetState, setSheetState] = useState<SheetState>("medium");
  const [plannerOpen, setPlannerOpen] = useState(false);
  const [longPressLocation, setLongPressLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLElement>(null);
  const previewSheetRef = useRef<HTMLElement>(null);
  const destinationSheetStateRef = useRef<SheetState | null>(null);
  const sheetGestureRef = useRef({
    pointerId: -1,
    startY: 0,
    startedAt: 0,
    dragging: false,
  });
  const sheetGestureCleanupRef = useRef<(() => void) | null>(null);
  const previewGestureCleanupRef = useRef<(() => void) | null>(null);
  const previewSheetGestureRef = useRef({
    pointerId: -1,
    startY: 0,
    startedAt: 0,
    dragging: false,
  });
  const suppressSheetClickRef = useRef(false);
  const previewSwipeRef = useRef({ pointerId: -1, startX: 0, startY: 0 });
  const selectedMatch = rankedParkings.find(
    (match) => match.parking.id === selected.id,
  );
  const categoryIcon = { building: "▦", street: "↔", area: "⌂", place: "●" };
  const categoryLabel = {
    building: "Ndërtesë",
    street: "Rrugë",
    area: "Zonë",
    place: "Vend",
  };
  const preferenceLabels: Array<[ParkingPreference, string]> = [
    ["best", "Më e mira"],
    ["closest", "Më afër"],
    ["cheapest", "Më lirë"],
    ["chance", hasLiveAvailability ? "Më shumë shanse" : "Më e dokumentuar"],
  ];
  const recommendationRankMap = useMemo(
    () =>
      new Map(rankedParkings.map((match) => [match.parking.id, match.rank])),
    [rankedParkings],
  );
  const localResults = searchResults.filter(
    (result) => result.source === "local",
  );
  const remoteResults = searchResults.filter(
    (result) => result.source === "geocoder",
  );
  const recentResults = query.trim() ? [] : recentDestinations;
  const sheetMatches = destination
    ? showAllResults
      ? rankedParkings
      : rankedParkings.slice(0, 3)
    : [];
  const sheetParkings = sheetMatches.map((match) => match.parking);
  const nextSheetState =
    sheetState === "collapsed"
      ? "medium"
      : sheetState === "medium"
        ? "expanded"
        : "collapsed";
  const sheetToggleLabel =
    sheetState === "collapsed"
      ? `${rankedParkings.length} parkingje • Hape`
      : sheetState === "medium"
        ? "Shfaq listën"
        : "Mbylle listën";
  const selectedParkingType = filters.type as ParkingTypeFilter;
  const visibleRoute =
    (destination && selectedMatch) || parkingPreviewOpen ? route : null;
  const routeMinutes = route
    ? Math.max(1, Math.ceil(route.durationSeconds / 60))
    : selected.driveMinutes;
  const routeDistance = route?.distanceMeters ?? selected.distanceMeters;
  const activeFilterCount = [
    filters.type !== "all",
    filters.verifiedOnly,
    filters.freeOnly,
    filters.paidOnly,
    filters.evCharging,
    filters.accessible,
    filters.availableOnly,
  ].filter(Boolean).length;
  const locationLabel = locationStatusLabel(locationStatus, locationAccuracy);

  const moveSheet = (direction: "up" | "down") => {
    if (direction === "up") {
      if (sheetState === "collapsed") setSheetState("medium");
      else if (sheetState === "medium") setSheetState("expanded");
      else return;
    } else if (sheetState === "expanded") setSheetState("medium");
    else if (sheetState === "medium") setSheetState("collapsed");
    else {
      onClearDestination();
      return;
    }
    subtleHaptic();
  };

  const handleSheetPointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const target = event.target as Element;
    const toggle = target.closest(".sheet-toggle");
    const list = target.closest(".parking-list") as HTMLElement | null;
    if (!toggle && target.closest("button, a, input, select")) return;
    if (!toggle && !(sheetState === "expanded" && list && list.scrollTop <= 0))
      return;
    sheetGestureCleanupRef.current?.();
    sheetGestureRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startedAt: performance.now(),
      dragging: false,
    };
    const move = (pointerEvent: PointerEvent) => {
      const gesture = sheetGestureRef.current;
      if (gesture.pointerId !== pointerEvent.pointerId) return;
      const deltaY = pointerEvent.clientY - gesture.startY;
      if (!gesture.dragging && Math.abs(deltaY) < 7) return;
      gesture.dragging = true;
      suppressSheetClickRef.current = true;
      const limitedDelta =
        sheetState === "collapsed"
          ? Math.max(-170, Math.min(90, deltaY))
          : sheetState === "expanded"
            ? Math.max(-18, Math.min(210, deltaY))
            : Math.max(-180, Math.min(180, deltaY));
      sheetRef.current?.style.setProperty(
        "--sheet-drag-y",
        `${limitedDelta}px`,
      );
      if (pointerEvent.cancelable) pointerEvent.preventDefault();
    };
    const cleanup = () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", finish);
      document.removeEventListener("pointercancel", finish);
      sheetGestureCleanupRef.current = null;
    };
    const finish = (pointerEvent: PointerEvent) => {
      const gesture = sheetGestureRef.current;
      if (gesture.pointerId !== pointerEvent.pointerId) return;
      const deltaY = pointerEvent.clientY - gesture.startY;
      const elapsed = Math.max(1, performance.now() - gesture.startedAt);
      const velocity = Math.abs(deltaY) / elapsed;
      sheetRef.current?.style.removeProperty("--sheet-drag-y");
      sheetGestureRef.current.pointerId = -1;
      cleanup();
      if (pointerEvent.type !== "pointercancel" && gesture.dragging && (Math.abs(deltaY) >= 44 || velocity >= 0.45))
        moveSheet(deltaY < 0 ? "up" : "down");
      window.setTimeout(() => {
        suppressSheetClickRef.current = false;
      }, 0);
    };
    document.addEventListener("pointermove", move, { passive: false });
    document.addEventListener("pointerup", finish);
    document.addEventListener("pointercancel", finish);
    sheetGestureCleanupRef.current = cleanup;
  };

  const handlePreviewSheetPointerDown = (
    event: React.PointerEvent<HTMLElement>,
  ) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    previewGestureCleanupRef.current?.();
    previewSheetGestureRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startedAt: performance.now(),
      dragging: false,
    };
    const move = (pointerEvent: PointerEvent) => {
      const gesture = previewSheetGestureRef.current;
      if (gesture.pointerId !== pointerEvent.pointerId) return;
      const deltaY = Math.max(0, pointerEvent.clientY - gesture.startY);
      if (!gesture.dragging && deltaY < 7) return;
      gesture.dragging = true;
      previewSheetRef.current?.style.setProperty(
        "--sheet-drag-y",
        `${deltaY}px`,
      );
      if (pointerEvent.cancelable) pointerEvent.preventDefault();
    };
    const cleanup = () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", finish);
      document.removeEventListener("pointercancel", finish);
    };
    const finish = (pointerEvent: PointerEvent) => {
      const gesture = previewSheetGestureRef.current;
      if (gesture.pointerId !== pointerEvent.pointerId) return;
      const deltaY = Math.max(0, pointerEvent.clientY - gesture.startY);
      const elapsed = Math.max(1, performance.now() - gesture.startedAt);
      const velocity = deltaY / elapsed;
      previewSheetRef.current?.style.removeProperty("--sheet-drag-y");
      previewSheetGestureRef.current.pointerId = -1;
      cleanup();
      if (pointerEvent.type !== "pointercancel" && gesture.dragging && (deltaY >= 90 || velocity >= 0.5)) {
        subtleHaptic();
        onCloseParkingPreview();
      }
    };
    document.addEventListener("pointermove", move, { passive: false });
    document.addEventListener("pointerup", finish);
    document.addEventListener("pointercancel", finish);
    previewGestureCleanupRef.current = cleanup;
  };

  const startPreviewSwipe = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    previewSwipeRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const finishPreviewSwipe = (event: React.PointerEvent<HTMLDivElement>) => {
    const swipe = previewSwipeRef.current;
    if (swipe.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - swipe.startX;
    const deltaY = event.clientY - swipe.startY;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    previewSwipeRef.current.pointerId = -1;
    if (event.type === "pointercancel") return;
    if (Math.abs(deltaX) < 46 || Math.abs(deltaX) <= Math.abs(deltaY)) return;
    const candidates = rankedParkings.slice(0, 3);
    const currentIndex = Math.max(
      0,
      candidates.findIndex((match) => match.parking.id === selected.id),
    );
    const nextIndex =
      deltaX < 0
        ? Math.min(candidates.length - 1, currentIndex + 1)
        : Math.max(0, currentIndex - 1);
    if (nextIndex !== currentIndex) {
      subtleHaptic();
      onSelect(candidates[nextIndex].parking);
    }
  };

  useEffect(() => {
    if (!searchOpen && !plannerOpen) return;
    const closeOnOutside = (event: PointerEvent) => {
      if (controlsRef.current?.contains(event.target as Node)) return;
      onCloseSearch();
      setPlannerOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      onCloseSearch();
      setPlannerOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [searchOpen, plannerOpen, onCloseSearch]);

  useEffect(() => {
    if (destination) {
      setSheetState(destinationSheetStateRef.current ?? "medium");
      destinationSheetStateRef.current = null;
    }
    setPlannerOpen(false);
  }, [destination?.id]);

  useEffect(() => {
    if (pickingDestination) setSheetState("collapsed");
  }, [pickingDestination]);

  useEffect(() => {
    if (!longPressLocation) return;
    const closeMenu = (event: PointerEvent) => {
      if ((event.target as Element).closest?.(".map-context-menu")) return;
      setLongPressLocation(null);
    };
    document.addEventListener("pointerdown", closeMenu);
    return () => document.removeEventListener("pointerdown", closeMenu);
  }, [longPressLocation]);

  useEffect(() => () => {
    sheetGestureCleanupRef.current?.();
    previewGestureCleanupRef.current?.();
  }, []);

  return (
    <div
      className={`screen screen--map ${destination ? `screen--smart screen--sheet-${sheetState}` : ""} ${parkingPreviewOpen && !destination ? "screen--parking-preview" : ""} ${plannerOpen || searchOpen ? "screen--top-panel-open" : ""}`}
    >
      <StatusBar />
      <LiveParkingMap
        parkings={mapParkings}
        selected={selected}
        onSelect={onSelect}
        mode="home"
        loadStatus={loadStatus}
        destination={destination}
        walkMinutes={walkingMinutes}
        recommendationRanks={recommendationRankMap}
        route={visibleRoute}
        pickingDestination={pickingDestination}
        onPickDestination={onPickDestination}
        onLongPress={(coordinates) => {
          setLongPressLocation(coordinates);
          setPlannerOpen(false);
          onCloseSearch();
          subtleHaptic(10);
        }}
        recenterToken={recenterToken}
        userLocation={userLocation}
        userLocationLive={locationStatus === "ready"}
        userLocationAccuracy={locationAccuracy}
        mapSettings={mapSettings}
        markerFilter={mapMarkerFilter}
      />
      <div className="home-controls" ref={controlsRef}>
        <div className="search-box">
          <span className="search-box__pin">
            <AppIcon name="search" size={18} />
          </span>
          <span className="search-box__copy">
            <input
              value={query}
              onFocus={() => {
                setPlannerOpen(false);
                onSearchFocus();
              }}
              onChange={(event) => onQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                const firstResult = localResults[0] ?? remoteResults[0];
                if (firstResult) onSelectDestination(firstResult);
                else onSearchOnline();
              }}
              placeholder="Kërko zonë, rrugë ose ndërtesë"
              aria-label="Kërko destinacion"
            />
          </span>
          {destination ? (
            <button
              type="button"
              className="round-button"
              onClick={onClearDestination}
              aria-label="Pastro destinacionin"
            >
              ×
            </button>
          ) : query ? (
            <button
              type="button"
              className="round-button"
              onClick={onClearDestination}
              aria-label="Pastro kërkimin"
            >
              ×
            </button>
          ) : (
            <button
              type="button"
              className="round-button"
              onClick={onSearchOnline}
              aria-label="Kërko destinacionin online"
            >
              <AppIcon name="search" size={18} />
            </button>
          )}
        </div>

        {searchOpen && (
          <div
            className="search-suggestions"
            role="dialog"
            aria-label="Rezultatet e destinacionit"
          >
            <div className="search-sheet-header">
              <strong>Kërko destinacion</strong>
              <button onClick={onCloseSearch} aria-label="Mbyll kërkimin">
                ×
              </button>
            </div>
            {recentResults.length > 0 && (
              <div className="search-section-label">
                <span>Të fundit</span>
                <button onClick={onClearRecent}>Pastro</button>
              </div>
            )}
            {recentResults.map((result) => (
              <button
                key={`recent-${result.id}`}
                onClick={() => onSelectDestination(result)}
              >
                <i>↻</i>
                <span>
                  <strong>{result.name}</strong>
                  <small>
                    {categoryLabel[result.category]} · {result.subtitle}
                  </small>
                </span>
                <b>›</b>
              </button>
            ))}
            {localResults.length > 0 && (
              <div className="search-section-label">Sugjerime në Prishtinë</div>
            )}
            {localResults.map((result) => (
              <button
                key={result.id}
                onClick={() => onSelectDestination(result)}
              >
                <i>{categoryIcon[result.category]}</i>
                <span>
                  <strong>{result.name}</strong>
                  <small>
                    {categoryLabel[result.category]} · {result.subtitle}
                  </small>
                </span>
                <b>›</b>
              </button>
            ))}
            {remoteResults.length > 0 && (
              <div className="search-section-label">Rezultate online</div>
            )}
            {remoteResults.map((result) => (
              <button
                key={result.id}
                onClick={() => onSelectDestination(result)}
              >
                <i>{categoryIcon[result.category]}</i>
                <span>
                  <strong>{result.name}</strong>
                  <small>
                    {categoryLabel[result.category]} · {result.subtitle}
                  </small>
                </span>
                <b>›</b>
              </button>
            ))}
            {query.trim().length >= 2 && (
              <button
                className="online-search-row"
                onClick={onSearchOnline}
                disabled={searchingOnline}
              >
                <i>⌕</i>
                <span>
                  <strong>
                    {searchingOnline
                      ? "Duke kërkuar…"
                      : online
                        ? `Kërko “${query}” online`
                        : "Kërkimi online nuk është i disponueshëm"}
                  </strong>
                  <small>
                    {online
                      ? "Rrugë, biznese dhe ndërtesa"
                      : "Kontrollo lidhjen me internet"}
                  </small>
                </span>
              </button>
            )}
            {searchError && (
              <p className="search-message search-message--error" role="status">
                {searchError}
              </p>
            )}
            <button
              className="map-pick-search-row"
              onClick={() => {
                setPlannerOpen(false);
                onStartMapPick();
              }}
            >
              <i>
                <AppIcon name="pin" size={18} />
              </i>
              <span>
                <strong>Zgjidh në hartë</strong>
                <small>Vendose pin-in në lokacionin e saktë</small>
              </span>
              <b>›</b>
            </button>
            {!recentResults.length &&
              !searchResults.length &&
              query.trim().length < 2 && (
                <p className="search-message">Shkruaj të paktën dy shkronja.</p>
              )}
          </div>
        )}

        <div className="map-action-row" aria-label="Veprimet e hartës">
          <MapFloatingControl
            className={`${plannerOpen ? "map-action-button--active" : ""}`}
            onClick={() => {
              onCloseSearch();
              setPlannerOpen((value) => !value);
            }}
            aria-expanded={plannerOpen}
            aria-label={plannerOpen ? "Mbyll filtrat" : "Hap filtrat"}
          >
            <span>
              <AppIcon name="filter" />
            </span>
            <b>Filtra</b>
            {activeFilterCount > 0 && <small>{activeFilterCount}</small>}
          </MapFloatingControl>
          <MapFloatingControl
            className={`map-action-button--pick ${pickingDestination ? "map-action-button--active" : ""}`}
            onClick={() => {
              setPlannerOpen(false);
              onCloseSearch();
              onStartMapPick();
            }}
            aria-pressed={pickingDestination}
            aria-label={
              pickingDestination
                ? "Anulo zgjedhjen e destinacionit në hartë"
                : "Zgjidh destinacionin në hartë"
            }
          >
            <span>
              <AppIcon name="pin" />
            </span>
            <b>{pickingDestination ? "Anulo" : "Zgjidh pikë"}</b>
          </MapFloatingControl>
          <MapFloatingControl
            className={`map-action-button--location map-action-button--${locationStatus}`}
            onClick={() => {
              setPlannerOpen(false);
              onCloseSearch();
              onRecenter();
            }}
            disabled={locationStatus === "locating"}
            aria-label={locationActionLabel(locationStatus)}
          >
            <span>
              <AppIcon name="location" />
            </span>
            <b>
              {locationStatus === "locating"
                ? "Duke gjetur"
                : locationStatus === "ready"
                  ? "Lokacioni"
                  : "Ku jam"}
            </b>
          </MapFloatingControl>
          <MapFloatingControl
            className="map-action-button--admin"
            onClick={() => {
              window.location.assign("/admin");
            }}
            aria-label="Hap admin map për pika parkingu"
          >
            <span>
              <AppIcon name="pin" />
            </span>
            <b>Admin point</b>
          </MapFloatingControl>
        </div>
        {!pickingDestination && locationStatus !== "idle" && locationStatus !== "ready" && (
          <p
            className={`location-inline-status location-inline-status--${locationStatus}`}
            role="status"
          >
            {locationLabel}
          </p>
        )}

        {plannerOpen ? (
          <section className="smart-planner" aria-label="Filtrat e parkingjeve">
            <header>
              <span>
                <small>Filtrat</small>
                <strong>
                  {destination
                    ? `Parking për ${destination.name}`
                    : "Cilat parkingje dëshiron?"}
                </strong>
              </span>
              <div className="planner-header-actions">
                <button
                  onClick={() => setPlannerOpen(false)}
                  aria-label="Mbyll filtrat"
                >
                  ×
                </button>
              </div>
            </header>
            {destination && (
              <div className="planner-options">
                <label>
                  <span>Ecje</span>
                  <select
                    value={walkingMinutes}
                    onChange={(event) =>
                      onWalkingMinutes(
                        Number(event.target.value) as 5 | 10 | 15,
                      )
                    }
                    aria-label="Koha maksimale e ecjes"
                  >
                    <option value="5">5 min</option>
                    <option value="10">10 min</option>
                    <option value="15">15 min</option>
                  </select>
                </label>
                <label>
                  <span>Rendit</span>
                  <select
                    value={preference}
                    onChange={(event) =>
                      onPreference(event.target.value as ParkingPreference)
                    }
                    aria-label="Mënyra e renditjes"
                  >
                    {preferenceLabels.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
            <p className="filter-section-label">Lloji dhe operatori</p>
            {mapMarkerFilter !== "all" && <button className="clear-filters-button" onClick={() => onMapMarkerFilter("all")}>Hiq filtrin e mëparshëm të hartës</button>}
            <ParkingTypeChooser
              value={selectedParkingType}
              counts={typeCounts}
              onChange={onParkingType}
            />
            <p className="filter-section-label">Veçori</p>
            <div className="filter-chip-grid">
              <button
                disabled={featureCounts.verified === 0}
                className={filters.verifiedOnly ? "selected" : ""}
                aria-pressed={filters.verifiedOnly}
                onClick={() =>
                  onFiltersChange({
                    ...filters,
                    verifiedOnly: !filters.verifiedOnly,
                  })
                }
              >
                Të verifikuara <small>{featureCounts.verified}</small>
              </button>
              <button
                disabled={featureCounts.free === 0}
                className={filters.freeOnly ? "selected" : ""}
                aria-pressed={filters.freeOnly}
                onClick={() =>
                  onFiltersChange({
                    ...filters,
                    freeOnly: !filters.freeOnly,
                    paidOnly: false,
                  })
                }
              >
                Falas <small>{featureCounts.free}</small>
              </button>
              <button
                disabled={featureCounts.paid === 0}
                className={filters.paidOnly ? "selected" : ""}
                aria-pressed={filters.paidOnly}
                onClick={() =>
                  onFiltersChange({
                    ...filters,
                    paidOnly: !filters.paidOnly,
                    freeOnly: false,
                  })
                }
              >
                Me pagesë <small>{featureCounts.paid}</small>
              </button>
              <button
                disabled={featureCounts.ev === 0}
                className={filters.evCharging ? "selected" : ""}
                aria-pressed={filters.evCharging}
                onClick={() =>
                  onFiltersChange({
                    ...filters,
                    evCharging: !filters.evCharging,
                  })
                }
              >
                Karikim EV <small>{featureCounts.ev}</small>
              </button>
              <button
                disabled={featureCounts.accessible === 0}
                className={filters.accessible ? "selected" : ""}
                aria-pressed={filters.accessible}
                onClick={() =>
                  onFiltersChange({
                    ...filters,
                    accessible: !filters.accessible,
                  })
                }
              >
                Qasje e lehtë <small>{featureCounts.accessible}</small>
              </button>
              <button
                disabled={!hasLiveAvailability}
                className={filters.availableOnly ? "selected" : ""}
                aria-pressed={filters.availableOnly}
                onClick={() =>
                  onFiltersChange({
                    ...filters,
                    availableOnly: !filters.availableOnly,
                  })
                }
              >
                Ka vende live <small>{featureCounts.live}</small>
              </button>
            </div>
            {(activeFilterCount > 0 || mapMarkerFilter !== "all") && (
              <button
                className="clear-filters-button"
                onClick={() => onFiltersChange(initialFilters)}
              >
                Pastro të gjithë filtrat
              </button>
            )}
          </section>
        ) : null}
      </div>

      {!destination && !parkingPreviewOpen && !searchOpen && !plannerOpen && !pickingDestination && (loadStatus !== "live" || mapParkings.length === 0) && (
        <div className="discovery-status" role="status">
          <AppIcon name={loadStatus === "loading" ? "map" : "info"} size={18} />
          <span>{loadStatus === "loading" ? "Duke rifreskuar parkingjet…" : !mapParkings.length ? "Nuk ka parkingje për këta filtra." : "Të dhëna rezervë · rifreskimi nuk u krye"}</span>
          {loadStatus !== "loading" && !mapParkings.length && <button onClick={() => setPlannerOpen(true)}>Ndrysho filtrat</button>}
        </div>
      )}
      {parkingPreviewOpen && !destination && (
        <BottomSheet
          ref={previewSheetRef}
          className="parking-preview-sheet"
          aria-label={`Parkingu i zgjedhur: ${selected.name}`}
        >
          <SheetHandle className="parking-preview-sheet__handle" onPointerDown={handlePreviewSheetPointerDown} aria-label="Mbyll parkingun e zgjedhur" onClick={(event) => { if (event.detail === 0 || !previewSheetGestureRef.current.dragging) onCloseParkingPreview(); }} />
          <header>
            <span>
              <small>{parkingTypeLabel(selected)}</small>
              <strong>{selected.name}</strong>
            </span>
            <button
              onClick={onCloseParkingPreview}
              aria-label="Mbyll parkingun e zgjedhur"
            >
              ×
            </button>
          </header>
          {mapSettings.showDataSources && (
            <p className="parking-preview-source">
              <i />
              {parkingSourceLabel(selected)}
            </p>
          )}
          <div className="parking-route-summary">
            <span>
              <small>Me veturë</small>
              <strong>{route ? `${routeMinutes} min` : "—"}</strong>
            </span>
            <span>
              <small>Largësia</small>
              <strong>
                {!route ? "—" : routeDistance >= 1000
                  ? `${(routeDistance / 1000).toFixed(1)} km`
                  : `${routeDistance} m`}
              </strong>
            </span>
            {verifiedPriceLabel(selected) && (
              <span>
                <small>Çmimi</small>
                <strong>{verifiedPriceLabel(selected)}</strong>
              </span>
            )}
          </div>
          <InfoRow icon="pin" label="Adresa e parkingut">{selected.address || "Adresa nuk është konfirmuar"}</InfoRow>
          <ParkingActions onNavigate={onNavigate} onDetails={onDetails} onStreetView={onStreetView} />
        </BottomSheet>
      )}
      {longPressLocation && (
        <section
          className="map-context-menu"
          role="dialog"
          aria-label="Veprimet për pikën në hartë"
        >
          <span>
            <strong>Pika në hartë</strong>
            <small>Zgjidh çfarë dëshiron të bësh këtu.</small>
          </span>
          <button
            onClick={() => {
              destinationSheetStateRef.current = "medium";
              onPickDestination(longPressLocation);
              setLongPressLocation(null);
            }}
          >
            ⌖ Destinacion këtu
          </button>
          <button
            onClick={() => {
              destinationSheetStateRef.current = "expanded";
              onPickDestination(longPressLocation);
              setLongPressLocation(null);
            }}
          >
            P Gjej parking afër
          </button>
          <button
            className="map-context-menu__cancel"
            onClick={() => setLongPressLocation(null)}
          >
            Anulo
          </button>
        </section>
      )}
      {destination && (
        <BottomSheet
          ref={sheetRef}
          aria-label="Parkingjet pranë destinacionit"
          className={`home-sheet home-sheet--smart home-sheet--${sheetState}`}
          onPointerDown={handleSheetPointerDown}
        >
          <SheetHandle
            className="sheet-toggle"
            onClick={() => {
              if (suppressSheetClickRef.current) return;
              setSheetState(nextSheetState);
              subtleHaptic();
            }}
            aria-expanded={sheetState !== "collapsed"}
            aria-label={
              sheetState === "collapsed"
                ? "Hap parkingjet"
                : sheetState === "medium"
                  ? "Zgjero listën e parkingjeve"
                  : "Mbyll listën e parkingjeve"
            }
          >
            <span>{sheetToggleLabel}</span>
            <b>
              {sheetState === "collapsed"
                ? "⌃"
                : sheetState === "medium"
                  ? "⌃"
                  : "⌄"}
            </b>
          </SheetHandle>
          <div className="home-sheet__content">
            <div className="sheet-heading">
              <h1>{`Parking për ${destination.name}`}</h1>
              <button onClick={onToggleShowAll}>
                {showAllResults
                  ? "Top 3"
                  : `Të gjitha (${rankedParkings.length})`}
              </button>
            </div>
            {sheetState === "medium" &&
              destination &&
              rankedParkings.length > 0 && (
                <div
                  className="recommendation-tabs"
                  aria-label="Parkingjet e rekomanduara"
                  onPointerDown={startPreviewSwipe}
                  onPointerUp={finishPreviewSwipe}
                  onPointerCancel={finishPreviewSwipe}
                >
                  {rankedParkings.slice(0, 3).map((match) => (
                    <button
                      key={match.parking.id}
                      className={
                        selected.id === match.parking.id ? "selected" : ""
                      }
                      onClick={() => onSelect(match.parking)}
                      aria-pressed={selected.id === match.parking.id}
                    >
                      <b>{match.rank}</b>
                      <span>
                        {match.walkMinutes} min ecje
                        <small>{accessLabel(match.parking)}</small>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            {sheetState === "medium" && mapParkings.length ? (
              <>
                <ParkingCard
                  parking={selected}
                  smartMatch={selectedMatch}
                  showSource={mapSettings.showDataSources}
                  showDriving={locationStatus === "ready"}
                  onOpen={onDetails}
                />
                <ParkingActions onNavigate={onNavigate} onDetails={onDetails} onStreetView={onStreetView} />
              </>
            ) : sheetState === "medium" ? (
              <div className="empty-state">
                <strong>Nuk gjetëm parking në këtë zonë</strong>
                <span>Provo 10 ose 15 minuta ecje.</span>
              </div>
            ) : null}
            {sheetState === "expanded" && (
              <>
                <section
                  className="expanded-parking-summary"
                  aria-label="Përmbledhja e parkingut të zgjedhur"
                >
                  <span>
                    <strong>{selected.name}</strong>
                    <small>
                      {parkingTypeLabel(selected)} · {accessLabel(selected)}
                    </small>
                  </span>
                  <span>
                    <b>
                      {selected.accessPoint
                        ? "Hyrje e hartuar"
                        : "Hyrje e përafërt"}
                    </b>
                    <small>
                      {selected.openingHours ??
                        selected.usageHours ??
                        "Orari nuk është konfirmuar"}
                    </small>
                  </span>
                  <button onClick={onNavigate}>Shko këtu</button>
                </section>
                <div className="parking-list" aria-label="Lista e parkingjeve">
                  {sheetParkings.length ? (
                    sheetParkings.map((parking) => (
                      <ParkingCard
                        key={parking.id}
                        parking={parking}
                        smartMatch={rankedParkings.find(
                          (match) => match.parking.id === parking.id,
                        )}
                        showSource={mapSettings.showDataSources}
                        showDriving={locationStatus === "ready"}
                        onOpen={() => {
                          onSelect(parking);
                          onDetails();
                        }}
                      />
                    ))
                  ) : (
                    <div className="empty-state">
                      <strong>Nuk gjetëm parking</strong>
                      <span>Zgjero ecjen ose provo tip tjetër parkingu.</span>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </BottomSheet>
      )}

      <BottomNav onProfile={onProfile} onSettings={onSettings} />
    </div>
  );
}

function ProfileView({
  user,
  onHome,
  onSettings,
  onLogin,
  onProfile,
}: {
  user: User | null;
  onHome: () => void;
  onSettings: () => void;
  onLogin: () => void;
  onProfile: () => void;
}) {
  const [profile, setProfile] = useState({
    name: "",
    username: "",
    bio: "",
    avatar: "",
  });
  const [profileStatus, setProfileStatus] = useState("");
  const [password, setPassword] = useState({
    currentPassword: "",
    newPassword: "",
    confirm: "",
  });
  const [passwordStatus, setPasswordStatus] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState({
    currentPassword: "",
    open: false,
  });
  const [deleteStatus, setDeleteStatus] = useState("");
  const [reservationScope, setReservationScope] = useState<
    "active" | "history"
  >("active");
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [reservationStatus, setReservationStatus] = useState("");

  function refreshReservations() {
    if (!user) return;
    setReservationStatus("Duke ngarkuar…");
    void listMyReservations({ scope: reservationScope })
      .then(({ items }) => {
        setReservations(items);
        setReservationStatus("");
      })
      .catch(() =>
        setReservationStatus(
          "Rezervimet nuk mund të ngarkohen. Provo përsëri.",
        ),
      );
  }

  useSocket({
    enabled: Boolean(user),
    onReservationCreated: () => refreshReservations(),
    onReservationCancelled: () => refreshReservations(),
  });

  useEffect(() => {
    setProfile({
      name: user?.name ?? "",
      username: user?.username ?? "",
      bio: user?.bio ?? "",
      avatar: user?.avatar ?? "",
    });
  }, [user]);

  useEffect(() => {
    if (!user) {
      setReservations([]);
      return;
    }
    refreshReservations();
    // Refreshes when the selected reservation tab changes or the session changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, reservationScope]);

  async function removeReservation(id: string) {
    if (!window.confirm("A dëshiron ta anulosh këtë rezervim?")) return;
    setReservationStatus("Duke anuluar…");
    try {
      await cancelReservation(id);
      setReservations((items) => items.filter((item) => item.id !== id));
      setReservationStatus("Rezervimi u anulua.");
    } catch {
      setReservationStatus("Rezervimi nuk u anulua. Provo përsëri.");
    }
  }

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileStatus("Duke ruajtur…");
    try {
      await updateProfile({
        name: profile.name,
        username: profile.username,
        bio: profile.bio,
        ...(profile.avatar.trim() ? { avatar: profile.avatar.trim() } : {}),
      });
      setProfileStatus("Ndryshimet u ruajtën.");
    } catch {
      setProfileStatus("Ndryshimet nuk u ruajtën. Provo përsëri.");
    }
  }

  async function savePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.newPassword !== password.confirm) {
      setPasswordStatus("Fjalëkalimet e reja nuk përputhen.");
      return;
    }
    setPasswordStatus("Duke ruajtur…");
    try {
      await changePassword({
        currentPassword: password.currentPassword,
        newPassword: password.newPassword,
      });
      setPassword({ currentPassword: "", newPassword: "", confirm: "" });
      setPasswordStatus("Fjalëkalimi u ndryshua.");
    } catch {
      setPasswordStatus("Fjalëkalimi nuk u ndryshua. Provo përsëri.");
    }
  }

  async function handleDeleteAccount() {
    try {
      await deleteAccount({ currentPassword: deleteConfirm.currentPassword });
      void logout().finally(onHome);
    } catch {
      setDeleteStatus("Fshirja dështoi. Kontrollo fjalëkalimin dhe provo përsëri.");
    }
  }

  return (
    <div className="screen saved-screen">
      <StatusBar />
      <header className="saved-header">
        <div>
          <small>Parko</small>
          <h1>Profili</h1>
        </div>
      </header>
      <main className="saved-list">
        {!user ? (
          <section className="empty-state profile-welcome">
            <span className="profile-welcome__icon" aria-hidden="true"><AppIcon name="user" size={32} /></span>
            <strong>Parkingjet e tua, në një vend.</strong>
            <p>Hyr për të ruajtur parkingje, për të parë rezervimet dhe për të kontribuar në komunitet.</p>
            <button type="button" onClick={onLogin}>
              Hyr ose regjistrohu
            </button>
          </section>
        ) : (
          <>
            <section className="profile-header">
              {user.avatar ? (
                <img src={user.avatar} alt="" className="profile-avatar" />
              ) : (
                <span className="profile-avatar" aria-hidden="true">
                  {user.name.charAt(0).toUpperCase()}
                </span>
              )}
              <div>
                <h2>{user.name}</h2>
                <p>@{user.username}</p>
                {user.bio && <p>{user.bio}</p>}
              </div>
            </section>
            <details className="account-disclosure">
              <summary>Ndrysho profilin</summary>
            <form
              onSubmit={saveProfile}
              className="settings-section profile-form"
            >

              <label>
                Emri
                <input
                  value={profile.name}
                  onChange={(event) =>
                    setProfile({ ...profile, name: event.target.value })
                  }
                />
              </label>
              <label>
                Emri i përdoruesit
                <input
                  value={profile.username}
                  onChange={(event) =>
                    setProfile({ ...profile, username: event.target.value })
                  }
                />
              </label>
              <label>
                Bio
                <textarea
                  value={profile.bio}
                  onChange={(event) =>
                    setProfile({ ...profile, bio: event.target.value })
                  }
                />
              </label>
              <label>
                URL e avatarit
                <input
                  type="url"
                  value={profile.avatar}
                  onChange={(event) =>
                    setProfile({ ...profile, avatar: event.target.value })
                  }
                />
              </label>
              <button type="submit">Ruaj ndryshimet</button>
              {profileStatus && <p role="status">{profileStatus}</p>}
            </form>
            </details>
            <details className="account-disclosure">
              <summary>Siguria e llogarisë</summary>
            <form
              onSubmit={savePassword}
              className="settings-section profile-form"
            >

              <label>
                Fjalëkalimi aktual
                <input
                  required
                  type="password"
                  value={password.currentPassword}
                  onChange={(event) =>
                    setPassword({
                      ...password,
                      currentPassword: event.target.value,
                    })
                  }
                />
              </label>
              <label>
                Fjalëkalimi i ri
                <input
                  required
                  minLength={8}
                  type="password"
                  value={password.newPassword}
                  onChange={(event) =>
                    setPassword({
                      ...password,
                      newPassword: event.target.value,
                    })
                  }
                />
              </label>
              <label>
                Konfirmo fjalëkalimin e ri
                <input
                  required
                  minLength={8}
                  type="password"
                  value={password.confirm}
                  onChange={(event) =>
                    setPassword({ ...password, confirm: event.target.value })
                  }
                />
              </label>
              <button type="submit">Ndrysho fjalëkalimin</button>
              {passwordStatus && <p role="status">{passwordStatus}</p>}
            </form>
            </details>
            <section className="settings-section reservation-list">
              <h2>Rezervimet e mia</h2>
              <div className="reservation-tabs">
                <button
                  className={reservationScope === "active" ? "selected" : ""}
                  onClick={() => setReservationScope("active")}
                >
                  Aktive
                </button>
                <button
                  className={reservationScope === "history" ? "selected" : ""}
                  onClick={() => setReservationScope("history")}
                >
                  Historiku
                </button>
              </div>
              {reservationStatus && <p role="status">{reservationStatus}</p>}
              {(!reservationStatus || reservationStatus === "Rezervimi u anulua.") &&
                (reservations.length ? (
                  <ul>
                    {reservations.map((item) => (
                      <li key={item.id}>
                        <strong>{item.parkingSpot?.title ?? "Parking"}</strong>
                        <br />
                        <small>
                          {new Date(item.startsAt).toLocaleString("sq-AL")} –{" "}
                          {new Date(item.expiresAt).toLocaleTimeString(
                            "sq-AL",
                            { hour: "2-digit", minute: "2-digit" },
                          )}
                        </small>
                        {reservationScope === "active" && (
                          <button
                            onClick={() => void removeReservation(item.id)}
                          >
                            Anulo
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>
                    {reservationScope === "active"
                      ? "Nuk ke rezervime aktive."
                      : "Nuk ka rezervime të mëparshme."}
                  </p>
                ))}
            </section>
            <button
              type="button"
              className="profile-logout-button"
              onClick={() => {
                void logout().finally(onHome);
              }}
            >
              Dil nga llogaria
            </button>
            <button
              type="button"
              className="danger"
              onClick={() => {
                setDeleteStatus("");
                setDeleteConfirm({ ...deleteConfirm, open: true });
              }}
            >
              Fshi llogarinë
            </button>
            {deleteConfirm.open && (
              <div className="settings-section">
                <p>Kjo do të fshijë përgjithmonë llogarinë tënde. Ky veprim nuk mund të kthehet mbrapsht.</p>
                <input
                  type="password"
                  placeholder="Fjalëkalimi aktual"
                  value={deleteConfirm.currentPassword}
                  onChange={(event) =>
                    setDeleteConfirm({
                      ...deleteConfirm,
                      currentPassword: event.target.value,
                    })
                  }
                />
                <button type="button" className="danger" onClick={() => void handleDeleteAccount()}>
                  Fshi llogarinë
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteConfirm({ currentPassword: "", open: false })}
                >
                  Anulo
                </button>
                {deleteStatus && <p role="status">{deleteStatus}</p>}
              </div>
            )}
          </>
        )}
      </main>
      <BottomNav
        active="profile"
        onHome={onHome}
        onProfile={onProfile}
        onSettings={onSettings}
      />
    </div>
  );
}

const mapVariantOptions: Array<{
  value: MapVariant;
  label: string;
  description: string;
}> = [
  {
    value: "standard",
    label: "Rrugët",
    description: "Rrugë, lagje dhe vende për orientim të përditshëm.",
  },
  {
    value: "minimal",
    label: "E çelët",
    description: "Hartë e çelët dhe e pastër që nxjerr në pah parkingjet.",
  },
  {
    value: "dark",
    label: "E errët",
    description: "Ngjyra të errëta për përdorim në mbrëmje.",
  },
  {
    value: "satellite",
    label: "Satelit",
    description: "Pamje satelitore me emra rrugësh dhe vendesh.",
  },
];

const parkingPaletteOptions: Array<{
  value: ParkingPalette;
  label: string;
  description: string;
}> = [
  { value: "green", label: "E gjelbër", description: "Maksimum dukshmërie" },
  { value: "price", label: "Sipas çmimit", description: "Ngjyrat e legjendës" },
  {
    value: "operator",
    label: "Sipas operatorit",
    description: "Prishtina Parking / OSM / privat",
  },
];

function SettingsView({
  user,
  settings,
  preferredType,
  walkingMinutes,
  typeCounts,
  onChange,
  onPreferredType,
  onWalkingMinutes,
  onReset,
  onLogin,
  onHome,
  onProfile,
  onCommunity,
  onCommunitySpots,
  onRestartOnboarding,
  onEditOnboardingPreferences,
}: {
  user: User | null;
  settings: MapSettings;
  preferredType: ParkingTypeFilter;
  walkingMinutes: 5 | 10 | 15;
  typeCounts: ParkingTypeCounts;
  onChange: (settings: MapSettings) => void;
  onPreferredType: (type: ParkingTypeFilter) => void;
  onWalkingMinutes: (minutes: 5 | 10 | 15) => void;
  onReset: () => void;
  onLogin: () => void;
  onHome: () => void;
  onProfile: () => void;
  onCommunity: () => void;
  onCommunitySpots: () => void;
  onRestartOnboarding: () => void;
  onEditOnboardingPreferences: () => void;
}) {
  const toggle = (
    key:
      | "emphasizeAreas"
      | "largePointMarkers"
      | "showPointParking"
      | "largeLabels"
      | "showDataSources",
  ) => onChange({ ...settings, [key]: !settings[key] });
  return (
    <div className="screen settings-screen">
      <StatusBar />
      <header className="settings-header">
        <div>
          <small>Parko</small>
          <h1>Cilësimet</h1>
          <p>Harta dhe preferencat e tua.</p>
        </div>
        <button
          className="settings-reset-button"
          onClick={onReset}
          aria-label="Rivendos cilësimet e hartës dhe filtrat"
        >
          <AppIcon name="recenter" size={16} /> Rivendos
        </button>
      </header>
      <main className="settings-content">
        <section className="settings-section">
          <div className="settings-section__heading">
            <span>
              <small>Stili</small>
              <h2>Varianti i hartës</h2>
            </span>

          </div>
          <div className="map-variant-grid">
            {mapVariantOptions.map((option) => (
              <button
                key={option.value}
                className={settings.variant === option.value ? "selected" : ""}
                onClick={() => onChange({ ...settings, variant: option.value })}
                aria-pressed={settings.variant === option.value}
              >
                <AppIcon name="map" size={22} />
                <span>
                  <strong>{option.label}</strong>
                  <small>{option.description}</small>
                </span>
                <span className="selection-check" aria-hidden="true">{settings.variant === option.value ? "✓" : ""}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="settings-section">
          <div className="settings-section__heading">
            <span>
              <small>Parkingjet</small>
              <h2>Ngjyrat</h2>
            </span>
          </div>
          <div className="parking-palette-options">
            {parkingPaletteOptions.map((option) => (
              <button
                key={option.value}
                className={
                  settings.parkingPalette === option.value ? "selected" : ""
                }
                onClick={() =>
                  onChange({ ...settings, parkingPalette: option.value })
                }
                aria-pressed={settings.parkingPalette === option.value}
              >
                <span
                  className={`palette-swatch palette-swatch--${option.value}`}
                >
                  <i />
                  <i />
                  <i />
                </span>
                <span>
                  <strong>{option.label}</strong>
                  <small>{option.description}</small>
                </span>
                <b>{settings.parkingPalette === option.value ? "✓" : ""}</b>
              </button>
            ))}
          </div>
        </section>

        <section className="settings-section settings-section--toggles">
          <div className="settings-section__heading">
            <span>
              <small>Dukshmëria</small>
              <h2>Zonat dhe pikat</h2>
            </span>
          </div>
          <button
            role="switch"
            aria-checked={settings.emphasizeAreas}
            onClick={() => toggle("emphasizeAreas")}
          >
            <span>
              <strong>Zona më të dukshme</strong>
              <small>Forcon vetëm kufijtë realë të parkingjeve.</small>
            </span>
            <i className={settings.emphasizeAreas ? "on" : ""} />
          </button>
          <button
            role="switch"
            aria-checked={settings.largePointMarkers}
            onClick={() => toggle("largePointMarkers")}
          >
            <span>
              <strong>Parkingje më të mëdha</strong>
              <small>Rrit pikat vetëm kur zona nuk është e hartuar.</small>
            </span>
            <i className={settings.largePointMarkers ? "on" : ""} />
          </button>
          <button
            role="switch"
            aria-checked={settings.largeLabels}
            onClick={() => toggle("largeLabels")}
          >
            <span>
              <strong>Etiketa më të mëdha</strong>
              <small>Rrit emrat dhe etiketat interaktive të hartës.</small>
            </span>
            <i className={settings.largeLabels ? "on" : ""} />
          </button>
          <button
            role="switch"
            aria-checked={settings.showDataSources}
            onClick={() => toggle("showDataSources")}
          >
            <span>
              <strong>Shfaq burimin e të dhënave</strong>
              <small>Tregon Prishtina Parking, OSM ose të pakonfirmuar.</small>
            </span>
            <i className={settings.showDataSources ? "on" : ""} />
          </button>
          <button
            role="switch"
            aria-checked={settings.showPointParking}
            onClick={() => toggle("showPointParking")}
          >
            <span>
              <strong>Shfaq parkingjet pa kontur</strong>
              <small>Çaktivizoje për të parë vetëm zonat me kufij realë.</small>
            </span>
            <i className={settings.showPointParking ? "on" : ""} />
          </button>
        </section>

        <section className="settings-section settings-section--defaults">
          <div className="settings-section__heading">
            <span>
              <small>Preferencat</small>
              <h2>Kërkimi i parkingut</h2>
            </span>
          </div>
          <label>
            <span>
              <strong>Lloji i preferuar</strong>
              <small>Përdoret si filtër fillestar.</small>
            </span>
            <select
              value={preferredType}
              onChange={(event) =>
                onPreferredType(event.target.value as ParkingTypeFilter)
              }
            >
              {parkingTypeOptions.map(([value, label]) => (
                <option
                  key={value}
                  value={value}
                  disabled={value !== "all" && typeCounts[value] === 0}
                >
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>
              <strong>Ecja maksimale</strong>
              <small>Rrezja kur kërkon pranë destinacionit.</small>
            </span>
            <select
              value={walkingMinutes}
              onChange={(event) =>
                onWalkingMinutes(Number(event.target.value) as 5 | 10 | 15)
              }
            >
              <option value="5">5 min</option>
              <option value="10">10 min</option>
              <option value="15">15 min</option>
            </select>
          </label>
        </section>

        <section className="settings-section settings-section--account">
          <div className="settings-section__heading">
            <span>
              <h2>Komuniteti dhe informacioni</h2>
            </span>
          </div>
          <button className="settings-login-button" onClick={onEditOnboardingPreferences}>
            <AppIcon name="filter" size={21} />
            <span><strong>Preferencat e parkingut</strong><small>Zgjedhjet e ruajtura gjatë prezantimit.</small></span>
            <AppIcon name="chevron" size={18} />
          </button>
          <button className="settings-login-button" onClick={onRestartOnboarding}>
            <AppIcon name="info" size={21} />
            <span><strong>Shfaq prezantimin</strong><small>Njihu përsëri me Parko.</small></span>
            <AppIcon name="chevron" size={18} />
          </button>
          <button className="settings-login-button" onClick={onCommunity}>
            <AppIcon name="user" size={21} />
            <span>
              <strong>Komuniteti dhe njoftimet</strong>
              <small>Postime dhe njoftime nga llogaria jote.</small>
            </span>
            <AppIcon name="chevron" size={18} />
          </button>
          <button className="settings-login-button" onClick={onCommunitySpots}>
            <AppIcon name="map" size={21} />
            <span>
              <strong>Parkingjet e komunitetit</strong>
              <small>
                Shiko vendet e regjistruara dhe rezervo kur është e mundur.
              </small>
            </span>
            <AppIcon name="chevron" size={18} />
          </button>
          {!user && (
            <button className="settings-login-button" onClick={onLogin}>
            <AppIcon name="user" size={21} />
              <span>
                <strong>Hyr ose regjistrohu</strong>
                <small>Ruaj preferencat dhe parkingjet e tua.</small>
              </span>
              <AppIcon name="chevron" size={18} />
            </button>
          )}
          <a
            className="settings-login-button settings-login-button--link"
            href="/privacy"
          >
            <AppIcon name="info" size={21} />
            <span>
              <strong>Politika e privatësisë</strong>
            </span>
            <AppIcon name="chevron" size={18} />
          </a>
          <a
            className="settings-login-button settings-login-button--link"
            href="/terms"
          >
            <AppIcon name="info" size={21} />
            <span>
              <strong>Kushtet e përdorimit</strong>
            </span>
            <AppIcon name="chevron" size={18} />
          </a>
        </section>

        <p className="settings-data-note">
          Zonat tregojnë kufijtë e hartuar. Pikat tregojnë parkingje pa kontur të disponueshëm.
        </p>
      </main>
      <BottomNav
        active="settings"
        onHome={onHome}
        onProfile={onProfile}
        onSettings={() => undefined}
      />
    </div>
  );
}

function DetailsView({
  parking,
  report,
  onReport,
  route,
  routeLoading,
  routeError,
  destination,
  smartMatch,
  saved,
  userLocation,
  userLocationLive,
  userLocationAccuracy,
  mapSettings,
  onToggleSaved,
  onBack,
  onNavigate,
  onStreetView,
}: {
  parking: Parking;
  report?: ParkingReport;
  onReport: (parkingId: string, patch: ParkingReportPatch) => Promise<void>;
  route: DrivingRoute | null;
  routeLoading: boolean;
  routeError: string;
  destination: Destination | null;
  smartMatch?: RankedParking;
  saved: boolean;
  userLocation: Parking["coordinates"];
  userLocationLive: boolean;
  userLocationAccuracy: number | null;
  mapSettings: MapSettings;
  onToggleSaved: () => void;
  onBack: () => void;
  onNavigate: () => void;
  onStreetView: () => void;
}) {
  const [reportOpen, setReportOpen] = useState(false);
  const [sheetState, setSheetState] = useState<"peek" | "half" | "full">("half");
  const sheetRef = useRef<HTMLElement>(null);
  const gestureRef = useRef<{
    pointerId: number;
    startY: number;
    startedAt: number;
    dragging: boolean;
  } | null>(null);
  const gestureCleanupRef = useRef<(() => void) | null>(null);
  const suppressDetailsClickRef = useRef(false);
  const [sheetDragging, setSheetDragging] = useState(false);
  const routeMinutes = route
    ? Math.max(1, Math.ceil(route.durationSeconds / 60))
    : parking.driveMinutes;
  const routeDistance = route?.distanceMeters ?? parking.distanceMeters;
  const categoryLabel = municipalCategoryLabel(parking);
  const usefulRouteSteps = (route?.steps ?? [])
    .filter((step) => step.maneuverType !== "depart")
    .slice(0, 4);
  const routeSourceLabel = !userLocationLive
    ? "Nevojitet lokacioni"
    : route
      ? "Rruga është gati"
      : routeLoading
        ? "Duke llogaritur rutën…"
        : "Rruga nuk është e disponueshme";

  const handleDetailsSheetPointerDown = (
    event: React.PointerEvent<HTMLElement>,
  ) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (gestureRef.current?.pointerId === event.pointerId) return;
    const target = event.target as Element;
    if (!target.closest(".details-sheet-toggle") && target.closest("button, a, input, select, textarea, summary")) return;
    const header = target.closest(".details-sheet__header");
    if (!header && !(sheetState === "full" && sheetRef.current?.scrollTop === 0))
      return;
    gestureCleanupRef.current?.();
    gestureRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startedAt: performance.now(),
      dragging: false,
    };
    const move = (pointerEvent: PointerEvent) => {
      const gesture = gestureRef.current;
      if (!gesture || gesture.pointerId !== pointerEvent.pointerId) return;
      const deltaY = pointerEvent.clientY - gesture.startY;
      if (!gesture.dragging && Math.abs(deltaY) < 7) return;
      gesture.dragging = true;
      suppressDetailsClickRef.current = true;
      setSheetDragging(true);
      const limitedDelta =
        sheetState === "peek"
          ? Math.max(-220, Math.min(60, deltaY))
          : sheetState === "full"
            ? Math.max(-20, Math.min(260, deltaY))
            : Math.max(-180, Math.min(220, deltaY));
      sheetRef.current?.style.setProperty(
        "--sheet-drag-y",
        `${limitedDelta}px`,
      );
      if (pointerEvent.cancelable) pointerEvent.preventDefault();
    };
    const cleanup = () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", finish);
      document.removeEventListener("pointercancel", finish);
      gestureCleanupRef.current = null;
      setSheetDragging(false);
    };
    const finish = (pointerEvent: PointerEvent) => {
      const gesture = gestureRef.current;
      if (!gesture || gesture.pointerId !== pointerEvent.pointerId) return;
      const deltaY = pointerEvent.clientY - gesture.startY;
      const elapsed = Math.max(1, performance.now() - gesture.startedAt);
      const velocity = Math.abs(deltaY) / elapsed;
      sheetRef.current?.style.removeProperty("--sheet-drag-y");
      gestureRef.current = null;
      cleanup();
      window.setTimeout(() => { suppressDetailsClickRef.current = false; }, 0);
      if (pointerEvent.type === "pointercancel") return;
      if (!gesture.dragging) {
        if (target.closest(".details-sheet-toggle")) return;
        setSheetState((current) =>
          current === "peek" ? "half" : current === "half" ? "full" : "half",
        );
        return;
      }
      if (sheetState === "peek" && deltaY > 0 && (deltaY >= 90 || velocity >= 0.5)) {
        onBack();
        return;
      }
      if (Math.abs(deltaY) < 44 && velocity < 0.45) return;
      setSheetState((current) => {
        if (deltaY < 0) return current === "peek" ? "half" : "full";
        return current === "full" ? "half" : "peek";
      });
    };
    document.addEventListener("pointermove", move, { passive: false });
    document.addEventListener("pointerup", finish);
    document.addEventListener("pointercancel", finish);
    gestureCleanupRef.current = cleanup;
  };

  useEffect(() => () => gestureCleanupRef.current?.(), []);

  return (
    <div className="screen screen--map">
      <StatusBar />
      <LiveParkingMap
        parkings={[parking]}
        selected={parking}
        onSelect={() => undefined}
        mode="details"
        route={route}
        destination={destination}
        userLocation={userLocation}
        userLocationLive={userLocationLive}
        userLocationAccuracy={userLocationAccuracy}
        mapSettings={mapSettings}
      />
      <button className="floating-back" onClick={onBack} aria-label="Kthehu">
        <AppIcon name="chevron" size={22} />
      </button>
      <button
        className={`floating-add ${saved ? "floating-add--saved" : ""}`}
        onClick={onToggleSaved}
        aria-label={
          saved ? "Hiqe parkingun nga të ruajturat" : "Ruaje parkingun"
        }
      >
        <AppIcon name="heart" size={22} />
      </button>

      <BottomSheet
        ref={sheetRef}
        aria-label={`Detajet për ${parking.name}`}
        className={`details-sheet details-sheet--${sheetState}${sheetDragging ? " details-sheet--dragging" : ""}`}
        onPointerDown={handleDetailsSheetPointerDown}
      >
        <div
          className="details-sheet__header"
          onPointerDown={handleDetailsSheetPointerDown}
        >
          <SheetHandle className="details-sheet-toggle" aria-label={sheetState === "full" ? "Zvogëlo detajet" : "Zgjero detajet"} aria-expanded={sheetState === "full"} onClick={() => { if (!suppressDetailsClickRef.current) setSheetState(current => current === "full" ? "half" : "full"); }} />
          <h1>{parking.name}</h1>
          <StatusBadge tone={parking.status === "available" ? "success" : parking.status === "full" ? "danger" : "warning"}>{availabilityLabel(parking)}</StatusBadge>
          <InfoRow icon="pin">{parking.address || parking.zone}</InfoRow>
        </div>
        {mapSettings.showDataSources && (
          <DataTrustBadge parking={parking} detailed />
        )}
        <p className="muted-copy">
          {accessLabel(parking)}
          {mapSettings.showDataSources
            ? ` • ${parkingSourceLabel(parking)}`
            : ""}
          {parking.availabilitySource
            ? ` • Disponueshmëri nga ${parking.availabilitySource}`
            : ""}
        </p>

        <div
          className={`stat-grid ${verifiedPriceLabel(parking) ? "" : "stat-grid--two"}`}
        >
          <div>
            <span>Largësia</span>
            <strong>
              {!route ? "—" : routeDistance >= 1000
                ? `${(routeDistance / 1000).toFixed(1)} km`
                : `${routeDistance} m`}
            </strong>
          </div>
          <div>
            <span>Koha</span>
            <strong>{route ? `${routeMinutes} min` : "—"}</strong>
          </div>
          {verifiedPriceLabel(parking) && (
            <div>
              <span>Çmimi</span>
              <strong>{verifiedPriceLabel(parking)}</strong>
            </div>
          )}
        </div>

        <section
          className="parking-route-card"
          aria-label="Rruga deri te parkingu"
        >
          <header>
            <span>
              <small>Si të shkosh</small>
              <strong>Rruga deri te hyrja</strong>
            </span>
            <b>{routeSourceLabel}</b>
          </header>
          <div className="parking-entry-note">
            <i>↗</i>
            <span>
              <strong>
                {parking.accessPoint
                  ? "Hyrja e parkingut është e hartuar"
                  : parking.geometry?.length
                    ? "Hyrje e përafërt nga konturi"
                    : "Hyrja nuk është hartuar"}
              </strong>
              <small>{parking.address}</small>
            </span>
          </div>
          {usefulRouteSteps.length ? (
            <ol>
              {usefulRouteSteps.map((step, index) => (
                <li key={`${step.maneuverType}-${step.roadName}-${index}`}>
                  <b>{index + 1}</b>
                  <span>
                    <strong>{step.instruction}</strong>
                    <small>
                      {step.roadName} •{" "}
                      {step.distanceMeters >= 1000
                        ? `${(step.distanceMeters / 1000).toFixed(1)} km`
                        : `${step.distanceMeters} m`}
                    </small>
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p role="status">
              {!userLocationLive
                ? "Aktivizo lejen e lokacionit për të llogaritur rrugën nga vendndodhja jote."
                : routeLoading
                  ? "Po kërkojmë rrugën deri te hyrja e parkingut."
                  : routeError || "Provo përsëri për të llogaritur rrugën."}
            </p>
          )}
        </section>
        <button
          className="street-view-inline street-view-inline--details"
          onClick={onStreetView}
          aria-label={`Hap Street View për ${parking.name}`}
        >
          ◎ Hap Street View 360°
        </button>

        <h2>Detajet</h2>
        <div className="detail-tags">
          {parking.open24h && <span>24/7 hapur</span>}
          {parking.covered && <span>I mbuluar</span>}
          {parking.cardPayment && <span>Pagesë me kartë</span>}
          {parking.evCharging && <span>EV charging</span>}
        </div>
        <p className="muted-copy">
          {parking.address}
          {parking.geometry?.length
            ? " • Konturi real është i hartuar"
            : " • Konturi nuk është hartuar ende"}
        </p>
        {parking.municipalManaged ? (
          <section className="municipal-data-card">
            <header>
              <strong>Prishtina Parking</strong>
              <span>E identifikuar nga operatori</span>
            </header>
            <div>
              {parking.municipalZone && (
                <span>
                  <small>Zona</small>
                  <b>{parking.municipalZone}</b>
                </span>
              )}
              {categoryLabel && (
                <span>
                  <small>Kategoria</small>
                  <b>{categoryLabel}</b>
                </span>
              )}
              {parking.municipalCode && (
                <span>
                  <small>Kodi</small>
                  <b>{parking.municipalCode}</b>
                </span>
              )}
            </div>
            <p>
              {parking.usageHours ??
                "Orari specifik nuk është publikuar në të dhënat e këtij parkingu; kontrollo tabelën në hyrje."}
            </p>
            <small>
              {parking.pricingSource === "official-zone"
                ? "Tarifa e vizitorit nga rregullorja zyrtare e zonës."
                : parking.pricingSource === "osm-sign"
                  ? "Tarifa vjen nga etiketa e publikuar në OpenStreetMap; kontrollo tabelën lokale."
                  : "Tarifa nuk supozohet pa të dhëna të verifikueshme."}
            </small>
            <a
              href={PRISHTINA_PARKING_RULES_URL}
              target="_blank"
              rel="noreferrer"
              onClick={(event) => {
                event.preventDefault();
                void handleOpenExternal(PRISHTINA_PARKING_RULES_URL);
              }}
            >
              Shiko rregullat zyrtare
            </a>
          </section>
        ) : (
          <p className="unverified-parking-note">
            <strong>Jo e konfirmuar si Prishtina Parking.</strong>{" "}
            {parking.pricingSource === "osm-sign"
              ? "Tarifa e shfaqur vjen nga OpenStreetMap; zona zyrtare dhe orari nuk dihen."
              : "Çmimi, zona zyrtare dhe orari nuk plotësohen pa burim të verifikueshëm."}
          </p>
        )}
        {destination && smartMatch && (
          <p className="walk-after-parking">
            Pastaj <strong>{smartMatch.walkMinutes} min ecje</strong> deri te{" "}
            {destination.name}
          </p>
        )}

        <details className="details-community account-disclosure">
          <summary>Raportime nga komuniteti</summary>
          <SpotVouching parking={parking} />
          <LeavingButton parking={parking} />
          <div className="report-control-row report-control-row--details">
            <span className="report-control-label">
              Diçka nuk shkon me këtë parking?
            </span>
            <button
              className={`report-warning-button ${reportOpen ? "report-warning-button--active" : ""}`}
              onClick={() => setReportOpen((value) => !value)}
              aria-expanded={reportOpen}
              aria-label={reportOpen ? "Mbyll raportimet" : "Hap raportimet"}
            >
              <span>⚠</span>
              <b>Raporto</b>
            </button>
          </div>
          {reportOpen && (
            <ParkingReportPanel
              parking={parking}
              report={report}
              onReport={onReport}
            />
          )}
        </details>

        {parking.osmUrl ? (
          <a
            className="text-button report-link"
            href={parking.osmUrl}
            target="_blank"
            rel="noreferrer"
            onClick={(event) => {
              event.preventDefault();
              void handleOpenExternal(parking.osmUrl!);
            }}
          >
            Kontrollo ose korrigjo në OpenStreetMap
          </a>
        ) : (
          <span className="text-button report-link report-link--disabled">
            Burimi nuk ka faqe raportimi
          </span>
        )}
      </BottomSheet>
      <div className="details-actions">
        <PrimaryButton onClick={onNavigate}><AppIcon name="route" />Shko këtu</PrimaryButton>
        {(!userLocationLive || routeLoading || !route) && <small role="status">{!userLocationLive ? "Nevojitet lokacioni për udhëzime nga vendndodhja jote" : routeLoading ? "Duke llogaritur rrugën…" : "Rruga nuk u ngarkua · provo përsëri"}</small>}
      </div>
    </div>
  );
}

function WalkingView({
  parking,
  destination,
  route,
  match,
  directionsHref,
  userLocation,
  userLocationLive,
  userLocationAccuracy,
  mapSettings,
  onFinish,
}: {
  parking: Parking;
  destination: Destination;
  route: DrivingRoute;
  match: RankedParking;
  directionsHref: string;
  userLocation: Parking["coordinates"];
  userLocationLive: boolean;
  userLocationAccuracy: number | null;
  mapSettings: MapSettings;
  onFinish: () => void;
}) {
  const routeMinutes = Math.max(1, Math.ceil(route.durationSeconds / 60));
  const isRealRoute = route.source === "valhalla";
  return (
    <div className="screen screen--map">
      <StatusBar />
      <LiveParkingMap
        parkings={[parking]}
        selected={parking}
        onSelect={() => undefined}
        mode="walking"
        route={route}
        destination={destination}
        userLocation={userLocation}
        userLocationLive={userLocationLive}
        userLocationAccuracy={userLocationAccuracy}
        mapSettings={mapSettings}
      />

      <section className="direction-card direction-card--walking">
        <span className="turn-icon">↑</span>
        <div>
          <small>
            {isRealRoute ? "Rutë këmbësorësh" : "Distancë e përafërt"}
          </small>
          <strong>Drejt {destination.name}</strong>
          <span>
            {isRealRoute
              ? "Rrugë e llogaritur nga Valhalla"
              : "Hap alternativën në Google Maps"}
          </span>
        </div>
        <a
          href={directionsHref}
          target="_blank"
          rel="noreferrer"
          onClick={(event) => {
            event.preventDefault();
            void handleOpenExternal(directionsHref);
          }}
          aria-label="Hap udhëzimet e ecjes"
        >
          ↗
        </a>
      </section>

      <section className="walking-arrival-card">
        <div>
          <small>MBËRRITJA NË KËMBË</small>
          <strong>{routeMinutes || match.walkMinutes} min</strong>
          <span>
            {route.distanceMeters || match.walkDistanceMeters} m deri te
            destinacioni
          </span>
        </div>
        <button onClick={onFinish}>Përfundo</button>
      </section>
    </div>
  );
}

export default function App() {
  const onboarding = useOnboarding();
  const { user, isLoading: authLoading } = useAuth();
  const persistedPreferences = useRef(loadPreferences()).current;
  const [screen, setScreen] = useState<Screen>("home");
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [selected, setSelected] = useState(() => {
    const snapshot = getPrishtinaParkingSnapshot();
    return (
      snapshot.find(
        (parking) => parking.id === persistedPreferences.selectedParkingId,
      ) ?? snapshot[0] ?? EMPTY_SELECTED_PARKING
    );
  });
  const [filters, setFilters] = useState<Filters>(() => ({
    ...initialFilters,
    ...persistedPreferences.filters,
  }));
  const [mapSettings, setMapSettings] = useState<MapSettings>(() =>
    normalizedMapSettings(persistedPreferences.mapSettings),
  );
  const [query, setQuery] = useState("");
  const [online, setOnline] = useState(navigator.onLine);
  const [parkings, setParkings] = useState<Parking[]>(
    getPrishtinaParkingSnapshot,
  );
  const [loadStatus, setLoadStatus] = useState<ParkingLoadStatus>("loading");
  const [route, setRoute] = useState<DrivingRoute | null>(null);
  const [routeNotice, setRouteNotice] = useState("");
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState("");
  const [routeRetry, setRouteRetry] = useState(0);
  const { reports: communityReports, submitReport } = useCrowdSourcing();
  const [parkingReports, setParkingReports] =
    useState<Record<string, ParkingReport>>(loadParkingReports);
  const [availabilityClock, setAvailabilityClock] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setAvailabilityClock(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  const [walkingRoute, setWalkingRoute] = useState<DrivingRoute | null>(null);
  const [destination, setDestination] = useState<Destination | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [onlineSearchResults, setOnlineSearchResults] = useState<Destination[]>(
    [],
  );
  const [searchingOnline, setSearchingOnline] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [recentDestinations, setRecentDestinations] = useState<Destination[]>(
    loadRecentDestinations,
  );
  const [walkingMinutes, setWalkingMinutes] = useState<5 | 10 | 15>(() =>
    [5, 10, 15].includes(persistedPreferences.walkingMinutes ?? 10)
      ? (persistedPreferences.walkingMinutes ?? 10)
      : 10,
  );
  const [preference, setPreference] = useState<ParkingPreference>("best");
  const [showAllResults, setShowAllResults] = useState(true);
  const [drivingMatrix, setDrivingMatrix] = useState<DrivingMatrixEntry[]>([]);
  const [pickingDestination, setPickingDestination] = useState(false);
  const [parkingPreviewOpen, setParkingPreviewOpen] = useState(false);
  const [recenterToken, setRecenterToken] = useState(0);
  const [savedParkingIds, setSavedParkingIds] = useState<Set<string>>(
    () => new Set(persistedPreferences.savedParkingIds ?? []),
  );
  const [userLocation, setUserLocation] = useState(USER_LOCATION);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>("idle");
  const [locationTimestamp, setLocationTimestamp] = useState<number | null>(null);
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null);
  const [streetViewParking, setStreetViewParking] = useState<Parking | null>(
    null,
  );

  useEffect(() => {
    if (!user) return;
    let active = true;
    void listFavorites()
      .then(({ parkingIds }) => {
        if (active)
          setSavedParkingIds((current) => new Set([...current, ...parkingIds]));
      })
      .catch(() => {
        /* Local favorites remain available while the API is unreachable. */
      });
    return () => {
      active = false;
    };
  }, [user?.id]);
  const parkingSelectedByUserRef = useRef(false);
  const parkingDetailsAttemptedRef = useRef(new Set<string>());
  const onlineSearchRequestRef = useRef(0);
  const userLocationInPrishtina =
    locationStatus === "ready" && isWithinPrishtinaMap(userLocation);
  const activeUserLocation = userLocationInPrishtina
    ? userLocation
    : USER_LOCATION;
  const routingOrigin = useRoutingOrigin(
    activeUserLocation,
    screen === "navigation",
  );
  const routeEntrance = parkingAccessPoint(selected, routingOrigin);
  useEffect(
    () => setRoute(null),
    [selected.id, routeEntrance.lat, routeEntrance.lng],
  );
  const shouldLoadRoute =
    userLocationInPrishtina &&
    (parkingPreviewOpen || screen === "details" || screen === "navigation");

  useEffect(() => {
    const controller = new AbortController();
    if (!shouldLoadRoute) {
      setRoute(null);
      setRouteLoading(false);
      setRouteError("");
      return;
    }
    setRouteNotice("");
    setRouteError("");
    setRouteLoading(true);
    loadDrivingRoute(routingOrigin, routeEntrance, controller.signal)
      .then((next) => {
        if (!controller.signal.aborted) setRoute(next);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setRoute(null);
          setRouteError(
            "Rruga nuk u gjet. Kontrollo lidhjen dhe provo përsëri.",
          );
          setRouteNotice(
            "Rruga nuk u gjet. Kontrollo lidhjen dhe provo përsëri.",
          );
          captureEvent("driving_route_failed");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setRouteLoading(false);
      });
    return () => controller.abort();
  }, [
    selected.id,
    routeEntrance.lat,
    routeEntrance.lng,
    routingOrigin,
    shouldLoadRoute,
    routeRetry,
  ]);

  useEffect(() => {
    savePreferences({
      filters,
      savedParkingIds: [...savedParkingIds],
      selectedParkingId: selected.id,
      mapSettings,
      walkingMinutes,
    });
  }, [filters, savedParkingIds, selected.id, mapSettings, walkingMinutes]);

  useEffect(() => {
    if (
      selected.id.startsWith("osm-node-") ||
      parkingDetailsAttemptedRef.current.has(selected.id)
    )
      return;
    parkingDetailsAttemptedRef.current.add(selected.id);
    const controller = new AbortController();
    loadParkingGeometry(selected, controller.signal)
      .then((details) => {
        if (!details.geometry?.length && !details.accessPoint) return;
        setParkings((current) =>
          current.map((parking) =>
            parking.id === selected.id ? { ...parking, ...details } : parking,
          ),
        );
        setSelected((current) =>
          current.id === selected.id ? { ...current, ...details } : current,
        );
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError"))
          return;
      });
    return () => controller.abort();
  }, [selected.id]);

  useEffect(() => {
    const controller = new AbortController();
    loadPrishtinaParkings(controller.signal, setParkings)
      .then((results) => {
        setParkings(results);
        setLoadStatus("live");
        const restored = results.find(
          (parking) => parking.id === persistedPreferences.selectedParkingId,
        );
        if (restored && !parkingSelectedByUserRef.current)
          setSelected(restored);
        else if (results[0] && selected.id === EMPTY_SELECTED_PARKING.id)
          setSelected(results[0]);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        setParkings(getPrishtinaParkingSnapshot());
        setLoadStatus("fallback");
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    let disposed = false;
    const refresh = async () => {
      const controller = new AbortController();
      try {
        const feed = await loadVerifiedAvailability(controller.signal);
        if (feed && !disposed) {
          setParkings((current) => mergeVerifiedAvailability(current, feed));
          captureEvent("occupancy_feed_refreshed", {
            source: feed.source,
            count: feed.parkings.length,
          });
        }
      } catch {
        captureEvent("occupancy_feed_failed");
      }
      return controller;
    };
    void refresh();
    const interval = window.setInterval(() => void refresh(), 60_000);
    return () => {
      disposed = true;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  function updateLocationFromPosition(
    position: GeolocationPosition,
    options: { recenter: boolean; report?: boolean },
  ) {
    const nextLocation = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
    };
    const insidePrishtina = isWithinPrishtinaMap(nextLocation);
    setUserLocation(nextLocation);
    setLocationTimestamp(position.timestamp);
    setLocationAccuracy(Math.round(position.coords.accuracy));
    setLocationStatus(insidePrishtina ? "ready" : "outside");
    if (options.recenter && insidePrishtina)
      setRecenterToken((value) => value + 1);
    if (options.report) {
      captureEvent("location_ready", {
        accuracyBucket:
          position.coords.accuracy < 30
            ? "high"
            : position.coords.accuracy < 100
              ? "medium"
              : "low",
        coverage: insidePrishtina ? "prishtina" : "outside-prishtina",
      });
    }
  }

  useEffect(() => {
    if (
      (locationStatus !== "ready" && locationStatus !== "outside") ||
      !navigator.geolocation
    )
      return;
    const watchId = navigator.geolocation.watchPosition(
      (position) => updateLocationFromPosition(position, { recenter: false }),
      (error) => {
        if (error.code === error.PERMISSION_DENIED) setLocationStatus("denied");
      },
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [locationStatus]);

  useEffect(() => {
    if (onboarding.mode || !navigator.geolocation || !navigator.permissions) return;
    let cancelled = false;
    // Resume only an already-granted permission. First-time and "Not now" users
    // must never see an automatic browser prompt, even after reloading the map.
    void navigator.permissions.query({ name: "geolocation" }).then((permission) => {
      if (!cancelled && permission.state === "granted" && locationStatus === "idle") {
        requestUserLocation({ recenter: false });
      }
    }).catch(() => { /* Browsers without permission queries retain the explicit location button. */ });
    return () => { cancelled = true; };
  }, [onboarding.mode]);

  const reportedParkings = useMemo(
    () =>
      parkings.map((parking) => {
        const stale =
          parking.availabilityUpdatedAt &&
          availabilityClock - Date.parse(parking.availabilityUpdatedAt) >=
            30 * 60_000;
        let result: Parking = stale
          ? {
              ...parking,
              spaces: null,
              status: "unknown",
              availabilitySource: undefined,
            }
          : parking;
        const community = communityReports.find(
          (report) =>
            report.parkingId === parking.id &&
            report.expiresAt > availabilityClock,
        );
        if (
          community?.availability &&
          result.access !== "no" &&
          (!result.availabilityUpdatedAt ||
            community.createdAt > Date.parse(result.availabilityUpdatedAt))
        ) {
          result = {
            ...result,
            spaces: null,
            status: community.status === "AVAILABLE" ? "available" : "full",
            availabilitySource: "Komuniteti Parko",
            availabilityUpdatedAt: new Date(community.createdAt).toISOString(),
            updatedMinutesAgo: Math.floor(
              (availabilityClock - community.createdAt) / 60_000,
            ),
          };
        }
        return applyParkingReport(result, community);
      }),
    [parkings, communityReports, availabilityClock],
  );
  const locatedParkings = useMemo(
    () =>
      reportedParkings.map((parking) => ({
        ...parking,
        distanceMeters: distanceMeters(routingOrigin, parking.coordinates),
      })),
    [reportedParkings, routingOrigin],
  );
  const currentSelected =
    locatedParkings.find((parking) => parking.id === selected.id) ?? selected;
  const hasLiveAvailability = useMemo(
    () =>
      locatedParkings.some(
        (parking) => parking.spaces !== null && parking.availabilitySource,
      ),
    [locatedParkings],
  );
  const effectiveFilters = useMemo(
    () => filtersForAvailability(filters, hasLiveAvailability),
    [filters, hasLiveAvailability],
  );
  const workflowFilters = effectiveFilters;
  const filteredParkings = useMemo(
    () =>
      locatedParkings
        .filter((parking) => matchesFilters(parking, workflowFilters))
        .sort((first, second) => first.distanceMeters - second.distanceMeters),
    [workflowFilters, locatedParkings],
  );

  const localSearchResults = useMemo(
    () => searchLocalDestinations(query),
    [query],
  );
  const searchResults = useMemo(() => {
    const seen = new Set<string>();
    return [...localSearchResults, ...onlineSearchResults]
      .filter((result) => {
        const key = `${result.name.toLowerCase()}-${result.coordinates.lat.toFixed(4)}-${result.coordinates.lng.toFixed(4)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 9);
  }, [localSearchResults, onlineSearchResults]);

  const candidates = useMemo(
    () =>
      destination
        ? walkableParkingCandidates(
            filteredParkings,
            destination,
            walkingMinutes,
          )
        : [],
    [destination, filteredParkings, walkingMinutes],
  );
  const typeCountSource = useMemo(
    () =>
      destination
        ? walkableParkingCandidates(
            locatedParkings,
            destination,
            walkingMinutes,
          ).map(({ parking }) => parking)
        : locatedParkings,
    [destination, locatedParkings, walkingMinutes],
  );
  const typeCounts = useMemo<ParkingTypeCounts>(
    () => ({
      all: typeCountSource.length,
      public: typeCountSource.filter((parking) =>
        parkingMatchesType(parking, "public"),
      ).length,
      private: typeCountSource.filter((parking) =>
        parkingMatchesType(parking, "private"),
      ).length,
      street: typeCountSource.filter((parking) =>
        parkingMatchesType(parking, "street"),
      ).length,
      municipal: typeCountSource.filter((parking) =>
        parkingMatchesType(parking, "municipal"),
      ).length,
    }),
    [typeCountSource],
  );
  const globalTypeCounts = useMemo<ParkingTypeCounts>(
    () => ({
      all: locatedParkings.length,
      public: locatedParkings.filter((parking) =>
        parkingMatchesType(parking, "public"),
      ).length,
      private: locatedParkings.filter((parking) =>
        parkingMatchesType(parking, "private"),
      ).length,
      street: locatedParkings.filter((parking) =>
        parkingMatchesType(parking, "street"),
      ).length,
      municipal: locatedParkings.filter((parking) =>
        parkingMatchesType(parking, "municipal"),
      ).length,
    }),
    [locatedParkings],
  );
  const featureCounts = useMemo<ParkingFeatureCounts>(
    () => ({
      verified: typeCountSource.filter(
        (parking) => parking.confidence !== "low",
      ).length,
      free: typeCountSource.filter(
        (parking) => parking.free && parking.pricingSource,
      ).length,
      paid: typeCountSource.filter(
        (parking) =>
          parking.pricePerHour !== null &&
          parking.pricePerHour > 0 &&
          parking.pricingSource,
      ).length,
      ev: typeCountSource.filter((parking) => parking.evCharging).length,
      accessible: typeCountSource.filter((parking) => parking.accessible)
        .length,
      live: typeCountSource.filter(
        (parking) => parking.spaces !== null && parking.availabilitySource,
      ).length,
    }),
    [typeCountSource],
  );
  const candidateKey = candidates.map(({ parking }) => parking.id).join("|");

  useEffect(() => {
    if (!destination || !candidates.length) {
      setDrivingMatrix([]);
      return;
    }
    const controller = new AbortController();
    setDrivingMatrix([]);
    loadDrivingMatrix(
      routingOrigin,
      candidates.map(({ parking }) => parking),
      controller.signal,
    )
      .then(setDrivingMatrix)
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError"))
          setDrivingMatrix([]);
      });
    return () => controller.abort();
  }, [candidateKey, destination?.id, routingOrigin]);

  const rankedParkings = useMemo(
    () => rankParkings(candidates, drivingMatrix, preference),
    [candidates, drivingMatrix, preference],
  );
  const mapRankedParkings = useMemo(
    () => (showAllResults ? rankedParkings : rankedParkings.slice(0, 3)),
    [showAllResults, rankedParkings],
  );
  const mapParkings = useMemo(
    () =>
      destination
        ? mapRankedParkings.map(({ parking }) => parking)
        : filteredParkings,
    [destination?.id, mapRankedParkings, filteredParkings],
  );
  const mapMarkerCounts = useMemo<Record<MapMarkerFilter, number>>(
    () => ({
      all: mapParkings.length,
      free: mapParkings.filter(
        (parking) => parking.pricePerHour === 0 && parking.pricingSource,
      ).length,
      paid: mapParkings.filter(
        (parking) =>
          parking.pricePerHour !== null &&
          parking.pricePerHour > 0 &&
          parking.pricingSource,
      ).length,
      municipal: mapParkings.filter((parking) => parking.municipalManaged)
        .length,
    }),
    [mapParkings],
  );
  const selectedRankedParking = rankedParkings.find(
    (match) => match.parking.id === currentSelected.id,
  );
  const selectedWalkingDirectionsHref = useMemo(
    () =>
      destination ? walkingDirectionsUrl(currentSelected, destination) : "",
    [currentSelected, destination],
  );

  useEffect(() => {
    if (!destination) {
      parkingSelectedByUserRef.current = false;
      return;
    }
    if (
      rankedParkings.length &&
      !parkingSelectedByUserRef.current &&
      selected.id !== rankedParkings[0].parking.id
    ) {
      setSelected(rankedParkings[0].parking);
    }
  }, [destination, rankedParkings, selected.id]);
  useEffect(() => {
    if (!destination || !selectedRankedParking) {
      setWalkingRoute(null);
      return;
    }
    const controller = new AbortController();
    setWalkingRoute(null);
    const start = parkingAccessPoint(
      selectedRankedParking.parking,
      destination.coordinates,
    );
    loadWalkingRoute(start, destination.coordinates, controller.signal)
      .then(setWalkingRoute)
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError"))
          captureEvent("walking_route_failed");
      });
    return () => controller.abort();
  }, [
    destination?.id,
    destination?.coordinates.lat,
    destination?.coordinates.lng,
    selectedRankedParking?.parking.id,
    selectedRankedParking?.parking.accessPoint?.lat,
    selectedRankedParking?.parking.accessPoint?.lng,
  ]);

  const displayedWalkingRoute = useMemo<DrivingRoute | null>(() => {
    if (walkingRoute) return walkingRoute;
    if (!destination || !selectedRankedParking) return null;
    const start = parkingAccessPoint(
      selectedRankedParking.parking,
      destination.coordinates,
    );
    return {
      coordinates: [start, destination.coordinates],
      distanceMeters: selectedRankedParking.walkDistanceMeters,
      durationSeconds: selectedRankedParking.walkMinutes * 60,
      steps: [
        {
          instruction: `Ec drejt ${destination.name}`,
          roadName: destination.subtitle,
          distanceMeters: selectedRankedParking.walkDistanceMeters,
          maneuverType: "walk",
        },
      ],
      source: "estimated-walking",
    };
  }, [destination, selectedRankedParking, walkingRoute]);

  async function runOnlineSearch() {
    if (query.trim().length < 2 || searchingOnline) return;
    const searchTerm = query.trim();
    const requestId = ++onlineSearchRequestRef.current;
    setSearchOpen(true);
    setSearchError("");
    if (!online) {
      setSearchError(
        "Je offline. Përdor sugjerimet lokale ose provo përsëri kur lidhet interneti.",
      );
      return;
    }
    setSearchingOnline(true);
    try {
      const results = await searchDestinationOnline(searchTerm);
      if (requestId !== onlineSearchRequestRef.current) return;
      setOnlineSearchResults(results);
      if (!results.length)
        setSearchError(
          "Nuk u gjet asnjë rezultat online. Provo emrin e rrugës ose zonës.",
        );
    } catch {
      if (requestId !== onlineSearchRequestRef.current) return;
      setOnlineSearchResults([]);
      setSearchError("Kërkimi online dështoi. Provo përsëri.");
    } finally {
      if (requestId === onlineSearchRequestRef.current)
        setSearchingOnline(false);
    }
  }

  function rememberDestination(nextDestination: Destination) {
    setRecentDestinations((current) => {
      const next = [
        nextDestination,
        ...current.filter(
          (item) =>
            item.id !== nextDestination.id &&
            (Math.abs(item.coordinates.lat - nextDestination.coordinates.lat) >
              0.00001 ||
              Math.abs(item.coordinates.lng - nextDestination.coordinates.lng) >
                0.00001),
        ),
      ].slice(0, 5);
      try {
        localStorage.setItem(RECENT_DESTINATIONS_KEY, JSON.stringify(next));
      } catch {
        /* storage can be unavailable */
      }
      return next;
    });
  }

  function selectDestination(nextDestination: Destination) {
    if (document.activeElement instanceof HTMLElement)
      document.activeElement.blur();
    onlineSearchRequestRef.current += 1;
    setSearchingOnline(false);
    parkingSelectedByUserRef.current = false;
    setDestination(nextDestination);
    setQuery(nextDestination.name);
    setParkingPreviewOpen(false);
    setSearchOpen(false);
    setOnlineSearchResults([]);
    setSearchError("");
    setShowAllResults(true);
    setPickingDestination(false);
    rememberDestination(nextDestination);
  }

  function clearDestination() {
    onlineSearchRequestRef.current += 1;
    setSearchingOnline(false);
    setDestination(null);
    setQuery("");
    setSearchOpen(false);
    setOnlineSearchResults([]);
    setSearchError("");
    setShowAllResults(true);
    setPickingDestination(false);
    setParkingPreviewOpen(false);
  }

  function toggleMapDestinationPicker() {
    if (pickingDestination) {
      setPickingDestination(false);
      return;
    }
    setQuery(destination?.name ?? "");
    onlineSearchRequestRef.current += 1;
    setSearchingOnline(false);
    setSearchOpen(false);
    setOnlineSearchResults([]);
    setSearchError("");
    setParkingPreviewOpen(false);
    setPickingDestination(true);
  }

  async function pickDestinationOnMap(coordinates: {
    lat: number;
    lng: number;
  }) {
    const pendingDestination: Destination = {
      id: `map-${coordinates.lat.toFixed(5)}-${coordinates.lng.toFixed(5)}`,
      name: "Pika e zgjedhur",
      subtitle: "Duke identifikuar rrugën…",
      category: "place",
      coordinates,
      aliases: [],
      source: "map",
    };
    selectDestination(pendingDestination);
    try {
      const resolved = await reverseGeocodeLocation(coordinates);
      setDestination((current) =>
        current?.id === pendingDestination.id ? resolved : current,
      );
      setQuery((current) =>
        current === pendingDestination.name ? resolved.name : current,
      );
      rememberDestination(resolved);
    } catch {
      setDestination((current) =>
        current?.id === pendingDestination.id
          ? { ...pendingDestination, subtitle: "Destinacion nga harta" }
          : current,
      );
    }
  }

  function selectParking(nextParking: Parking) {
    parkingSelectedByUserRef.current = true;
    setRoute(null);
    setSelected(nextParking);
    setParkingPreviewOpen(true);
  }

  async function reportParking(parkingId: string, patch: ParkingReportPatch) {
    const parking = parkings.find((item) => item.id === parkingId);
    if (!parking) return;
    const previous = parkingReports[parkingId];
    try {
      const report = await submitParkingObservation(parking, {
        availability:
          patch.availability === "free-spots"
            ? "AVAILABLE"
            : patch.availability === "full"
              ? "OCCUPIED"
              : previous?.availability === "free-spots"
                ? "AVAILABLE"
                : previous?.availability === "full"
                  ? "OCCUPIED"
                  : undefined,
        payment: patch.payment ?? previous?.payment,
        policeRisk: patch.policeRisk ?? previous?.policeRisk,
        media: patch.media,
      });
      setParkingReports((current) => {
        const next = { ...current, [parkingId]: report };
        saveParkingReports(next);
        return next;
      });
    } catch (error) {
      setRouteNotice(
        error instanceof Error ? error.message : "Raportimi nuk u dërgua.",
      );
      throw error;
    }
  }

  async function toggleSavedParking() {
    const wasSaved = savedParkingIds.has(selected.id);
    setSavedParkingIds((current) => {
      const next = new Set(current);
      if (wasSaved) next.delete(selected.id);
      else next.add(selected.id);
      return next;
    });
    if (
      !user ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        selected.id,
      )
    )
      return;
    try {
      if (wasSaved) await removeParkingFavorite(selected.id);
      else await saveParkingFavorite(selected.id);
    } catch (error) {
      setSavedParkingIds((current) => {
        const next = new Set(current);
        if (wasSaved) next.add(selected.id);
        else next.delete(selected.id);
        return next;
      });
      setRouteNotice(
        error instanceof Error ? error.message : "Parkingu nuk u ruajt.",
      );
    }
  }

  function requestUserLocation(options: { recenter?: boolean } = {}) {
    if (!navigator.geolocation) {
      setLocationStatus("unavailable");
      setLocationAccuracy(null);
      return;
    }
    const shouldRecenter = options.recenter !== false;
    const hasLiveLocation =
      locationStatus === "ready" && isWithinPrishtinaMap(userLocation);
    // Keep the last valid GPS fix active while refreshing it. Falling back to the
    // demo city-center coordinate here would temporarily rebuild the route from
    // the wrong road and make the blue dot disappear.
    if (hasLiveLocation) {
      if (shouldRecenter) setRecenterToken((value) => value + 1);
    } else {
      setLocationStatus("locating");
    }
    navigator.geolocation.getCurrentPosition(
      (position) =>
        updateLocationFromPosition(position, {
          recenter: shouldRecenter,
          report: true,
        }),
      (error) => {
        setLocationStatus(
          error.code === error.PERMISSION_DENIED ? "denied" : "unavailable",
        );
        setLocationAccuracy(null);
        captureEvent("location_failed", { code: error.code });
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  }

  useEffect(() => {
    const selectable = destination ? rankedParkings : filteredParkings;
    if (selectable.length) {
      const selectableParkings = destination
        ? (selectable as RankedParking[]).map((match) => match.parking)
        : (selectable as Parking[]);
      if (!selectableParkings.some((parking) => parking.id === selected.id))
        setSelected(selectableParkings[0]);
    }
  }, [destination, filteredParkings, rankedParkings, selected.id]);

  if (onboarding.mode) {
    return <div className="app-shell"><div className="phone-frame">
      <Onboarding
        key={onboarding.mode}
        mode={onboarding.mode}
        preferences={onboarding.preferences}
        storageAvailable={onboarding.storageAvailable}
        locationStatus={locationStatus}
        onRequestLocation={() => requestUserLocation({ recenter: false })}
        onCancel={onboarding.cancelEdit}
        onFinish={(preferences) => {
          const wasIntro = onboarding.mode === "intro";
          onboarding.finish(preferences);
          if (wasIntro) setScreen("home");
        }}
      />
    </div></div>;
  }

  return (
    <div className="app-shell">
      <style>{`
        .login-auth-button {
          position: fixed;
          bottom: 24px;
          right: 24px;
          z-index: 100;
          padding: 12px 24px;
          background: #246bfd;
          color: white;
          border: none;
          border-radius: 14px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          box-shadow: 0 8px 20px rgba(36, 107, 253, 0.22);
          transition: all 0.3s ease;
        }

        .login-auth-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 24px rgba(36, 107, 253, 0.28);
        }

        .login-auth-button:active {
          transform: translateY(0);
        }

        .profile-header {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 16px;
          border-radius: 16px;
          background: #f4f7ff;
        }

        .profile-header h2, .profile-header p { margin: 0; }
        .profile-header p + p { margin-top: 4px; }

        .profile-avatar {
          display: grid;
          place-items: center;
          flex: 0 0 56px;
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: #246bfd;
          color: white;
          font-size: 22px;
          font-weight: 700;
          object-fit: cover;
        }

        .profile-form {
          display: grid;
          gap: 12px;
          padding: 16px;
        }

        .profile-form h2, .profile-form p { margin: 0; }

        .profile-form label {
          display: grid;
          gap: 6px;
          color: #23354d;
          font-size: 14px;
          font-weight: 600;
        }

        .profile-form input, .profile-form textarea {
          box-sizing: border-box;
          width: 100%;
          border: 1px solid #cbd5e1;
          border-radius: 10px;
          padding: 10px 12px;
          background: white;
          color: #10233d;
          font: inherit;
        }

        .profile-form textarea { min-height: 84px; resize: vertical; }

        .profile-form button, .empty-state button {
          justify-self: start;
          border: 0;
          border-radius: 10px;
          padding: 10px 14px;
          background: #246bfd;
          color: white;
          font: inherit;
          font-weight: 700;
          cursor: pointer;
        }

        .profile-logout-button {
          min-height: 58px;
          padding: 8px 12px;
          border: 0;
          border-radius: 14px;
          background: #fef2f2;
          color: #b91c1c;
          font: inherit;
          font-weight: 700;
          cursor: pointer;
        }

        @media (max-width: 520px) {
          .login-auth-button { display: none; }
        }
      `}</style>
      {!authLoading && !user && (
        <button
          className="login-auth-button"
          onClick={() => setShowLoginModal(true)}
        >
          Hyr në llogari
        </button>
      )}
      {routeNotice && (
        <div className="app-feedback" role="status">
          <span>{routeNotice}</span>
          <button
            onClick={() => {
              setRouteRetry((value) => value + 1);
              setRouteNotice("");
            }}
          >
            Provo përsëri
          </button>
          <button
            aria-label="Mbyll njoftimin"
            onClick={() => setRouteNotice("")}
          >
            ×
          </button>
        </div>
      )}
      {showLoginModal && (
        <Suspense
          fallback={
            <div className="modal-loading" role="status">
              Duke hapur hyrjen…
            </div>
          }
        >
          <Login onClose={() => setShowLoginModal(false)} />
        </Suspense>
      )}
      {!online && (
        <div className="offline-banner" role="status">
          Je offline — po shfaqim të dhënat e fundit të ruajtura.
        </div>
      )}
      <div className="phone-frame">
        <IosInstallPrompt />
        {screen === "home" && (
          <HomeView
            mapParkings={mapParkings}
            selected={currentSelected}
            filters={workflowFilters}
            hasLiveAvailability={hasLiveAvailability}
            query={query}
            onQuery={(value) => {
              onlineSearchRequestRef.current += 1;
              setSearchingOnline(false);
              setQuery(value);
              setSearchOpen(true);
              setOnlineSearchResults([]);
              setSearchError("");
            }}
            searchResults={searchResults}
            recentDestinations={recentDestinations}
            searchOpen={searchOpen}
            searchingOnline={searchingOnline}
            searchError={searchError}
            online={online}
            destination={destination}
            walkingMinutes={walkingMinutes}
            preference={preference}
            route={route}
            rankedParkings={rankedParkings}
            showAllResults={showAllResults}
            pickingDestination={pickingDestination}
            parkingPreviewOpen={parkingPreviewOpen}
            typeCounts={typeCounts}
            featureCounts={featureCounts}
            onSelect={selectParking}
            onSelectDestination={selectDestination}
            onClearRecent={() => {
              setRecentDestinations([]);
              try {
                localStorage.removeItem(RECENT_DESTINATIONS_KEY);
              } catch {
                /* storage can be unavailable */
              }
            }}
            onSearchFocus={() => setSearchOpen(true)}
            onSearchOnline={runOnlineSearch}
            onCloseSearch={() => setSearchOpen(false)}
            onClearDestination={clearDestination}
            onWalkingMinutes={setWalkingMinutes}
            onPreference={setPreference}
            onParkingType={(type) =>
              setFilters((current) => ({ ...current, type }))
            }
            onFiltersChange={setFilters}
            onToggleShowAll={() => setShowAllResults((value) => !value)}
            onStartMapPick={toggleMapDestinationPicker}
            onPickDestination={pickDestinationOnMap}
            recenterToken={recenterToken}
            onRecenter={requestUserLocation}
            locationStatus={locationStatus}
            locationAccuracy={locationAccuracy}
            userLocation={activeUserLocation}
            onDetails={() => setScreen("details")}
            onNavigate={() => {
              setRouteNotice("");
              setScreen("navigation");
              if (!userLocationInPrishtina) {
                requestUserLocation({ recenter: false });
                return;
              }
              if (
                !route ||
                route.source !== "osrm" ||
                selected.id !== currentSelected.id
              ) {
                setRouteRetry((value) => value + 1);
                return;
              }
            }}
            onStreetView={() => setStreetViewParking(currentSelected)}
            onCloseParkingPreview={() => setParkingPreviewOpen(false)}
            onProfile={() => setScreen("profile")}
            onSettings={() => setScreen("settings")}
            mapSettings={mapSettings}
            mapMarkerFilter={filters.mapMarkerFilter}
            mapMarkerCounts={mapMarkerCounts}
            onMapMarkerFilter={(mapMarkerFilter) =>
              setFilters((current) => ({ ...current, mapMarkerFilter }))
            }
            loadStatus={loadStatus}
          />
        )}
        {screen === "profile" && (
          <ProfileView
            user={user}
            onLogin={() => setShowLoginModal(true)}
            onHome={() => setScreen("home")}
            onProfile={() => undefined}
            onSettings={() => setScreen("settings")}
          />
        )}
        {screen === "settings" && (
          <SettingsView
            user={user}
            settings={mapSettings}
            preferredType={filters.type as ParkingTypeFilter}
            walkingMinutes={walkingMinutes}
            typeCounts={globalTypeCounts}
            onChange={(value) => setMapSettings(normalizedMapSettings(value))}
            onPreferredType={(type) =>
              setFilters((current) => ({ ...current, type }))
            }
            onWalkingMinutes={setWalkingMinutes}
            onReset={() => {
              setMapSettings(DEFAULT_MAP_SETTINGS);
              setFilters(initialFilters);
              setWalkingMinutes(10);
            }}
            onLogin={() => setShowLoginModal(true)}
            onHome={() => setScreen("home")}
            onProfile={() => setScreen("profile")}
            onCommunity={() => setScreen("community")}
            onCommunitySpots={() => setScreen("community-spots")}
            onRestartOnboarding={onboarding.restart}
            onEditOnboardingPreferences={onboarding.editPreferences}
          />
        )}
        {screen === "community" && (
          <Suspense
            fallback={
              <div className="app-loading" role="status">
                Duke hapur komunitetin…
              </div>
            }
          >
            <CommunityView
              onBack={() => setScreen("settings")}
              onLogin={() => setShowLoginModal(true)}
            />
          </Suspense>
        )}
        {screen === "community-spots" && (
          <Suspense
            fallback={
              <div className="app-loading" role="status">
                Duke hapur parkingjet…
              </div>
            }
          >
            <CommunitySpots
              userLocation={
                userLocationInPrishtina ? activeUserLocation : undefined
              }
              canReserve={Boolean(user)}
              onBack={() => setScreen("settings")}
              onLogin={() => setShowLoginModal(true)}
            />
          </Suspense>
        )}
        {screen === "details" && (
          <DetailsView
            parking={currentSelected}
            report={parkingReports[currentSelected.id]}
            onReport={reportParking}
            route={route}
            routeLoading={routeLoading}
            routeError={routeError}
            destination={destination}
            smartMatch={selectedRankedParking}
            saved={savedParkingIds.has(currentSelected.id)}
            userLocation={activeUserLocation}
            userLocationLive={userLocationInPrishtina}
            userLocationAccuracy={locationAccuracy}
            mapSettings={mapSettings}
            onToggleSaved={() => {
              void toggleSavedParking();
            }}
            onBack={() => setScreen("home")}
            onNavigate={() => {
              setRouteNotice("");
              setScreen("navigation");
              if (!userLocationInPrishtina) {
                requestUserLocation({ recenter: false });
                return;
              }
              if (routeLoading) return;
              if (!route) {
                setRouteNotice("");
                setRouteRetry((value) => value + 1);
                return;
              }
            }}
            onStreetView={() => setStreetViewParking(currentSelected)}
          />
        )}
        {screen === "navigation" && (
          <NavigationView
            key={currentSelected.id}
            routeLoading={routeLoading}
            routeError={routeError}
            locationTimestamp={locationTimestamp}
            parking={currentSelected}
            route={route}
            userLocation={activeUserLocation}
            userLocationLive={userLocationInPrishtina}
            userLocationAccuracy={locationAccuracy}
            mapSettings={mapSettings}
            recenterToken={recenterToken}
            hasDestination={Boolean(destination)}
            onRecenter={requestUserLocation}
            onStop={() => setScreen("details")}
            onArrive={() => setScreen(destination ? "walking" : "home")}
          />
        )}
        {screen === "walking" &&
          destination &&
          displayedWalkingRoute &&
          selectedRankedParking && (
            <WalkingView
              parking={currentSelected}
              destination={destination}
              route={displayedWalkingRoute}
              match={selectedRankedParking}
              directionsHref={selectedWalkingDirectionsHref}
              userLocation={activeUserLocation}
              userLocationLive={userLocationInPrishtina}
              userLocationAccuracy={locationAccuracy}
              mapSettings={mapSettings}
              onFinish={() => setScreen("home")}
            />
          )}
        {streetViewParking && (
          <StreetViewPanel
            parking={streetViewParking}
            onClose={() => setStreetViewParking(null)}
          />
        )}
      </div>
      <p className="desktop-caption">
        Parko • prototip interaktiv për Prishtinën
      </p>
    </div>
  );
}
