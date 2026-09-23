import { useEffect, useMemo, useState } from "react";
import type { Parking } from "./types";

export type QuickParkingReportValue = {
  availability?: "free-spots" | "full";
  payment?: "free" | "paid";
  policeRisk?: boolean;
  description?: string;
};

type ReportChoice = {
  id: string;
  icon: string;
  label: string;
  hint: string;
  tone?: "success" | "warning" | "danger";
  value: QuickParkingReportValue;
};

const REPORT_CHOICES: ReportChoice[] = [
  {
    id: "free-spots",
    icon: "P+",
    label: "Ka vende të lira",
    hint: "Ka së paku një vend të lirë tani",
    tone: "success",
    value: { availability: "free-spots", description: "Ka vende të lira." },
  },
  {
    id: "full",
    icon: "P0",
    label: "Parking plot",
    hint: "Nuk ka vende të lira",
    tone: "danger",
    value: { availability: "full", description: "Parkingu është plot." },
  },
  {
    id: "public",
    icon: "P",
    label: "Parking publik",
    hint: "Konfirmo që përdoret nga publiku",
    value: { description: "Ky lokacion është parking publik." },
  },
  {
    id: "free-parking",
    icon: "€0",
    label: "Parking falas",
    hint: "Nuk kërkohet pagesë",
    tone: "success",
    value: { payment: "free", description: "Ky parking është pa pagesë." },
  },
  {
    id: "wrong-price",
    icon: "€?",
    label: "Çmim i gabuar",
    hint: "Tarifa në hartë nuk përputhet",
    tone: "warning",
    value: { description: "Çmimi i shfaqur në hartë është i gabuar." },
  },
  {
    id: "blocked",
    icon: "⛔",
    label: "Hyrje e bllokuar",
    hint: "Nuk mund të hyhet në parking",
    tone: "danger",
    value: { availability: "full", description: "Hyrja e parkingut është e bllokuar." },
  },
  {
    id: "closed",
    icon: "×",
    label: "Parking i mbyllur",
    hint: "Përkohësisht ose përgjithmonë",
    tone: "danger",
    value: { availability: "full", description: "Parkingu është i mbyllur." },
  },
  {
    id: "other",
    icon: "…",
    label: "Problem tjetër",
    hint: "Shkruaj një sqarim të shkurtër",
    value: { description: "Problem tjetër me parkingun." },
  },
];

export default function QuickParkingReportSheet({
  parking,
  canReport = true,
  onClose,
  onRequireLogin,
  onSubmit,
}: {
  parking: Parking;
  canReport?: boolean;
  onClose: () => void;
  onRequireLogin?: () => void;
  onSubmit: (value: QuickParkingReportValue) => Promise<void>;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [error, setError] = useState("");
  const selectedChoice = useMemo(
    () => REPORT_CHOICES.find((choice) => choice.id === selectedId),
    [selectedId],
  );

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  const submit = async () => {
    if (!selectedChoice || submitting) return;
    if (!canReport) {
      onRequireLogin?.();
      return;
    }
    setSubmitting(true);
    setStatus("idle");
    setError("");
    try {
      const description = [selectedChoice.value.description, note.trim()]
        .filter(Boolean)
        .join(" Shënim: ");
      await onSubmit({ ...selectedChoice.value, description });
      setStatus("success");
    } catch (reason) {
      setStatus("error");
      setError(
        reason instanceof Error ? reason.message : "Raporti nuk u dërgua.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="quick-parking-report-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="quick-parking-report-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-parking-report-title"
      >
        <div className="quick-parking-report-handle" aria-hidden="true" />
        <header>
          <span>
            <small>Raport komuniteti</small>
            <strong id="quick-parking-report-title">Çfarë po sheh?</strong>
          </span>
          <button type="button" onClick={onClose} aria-label="Mbyll raportimin">
            ×
          </button>
        </header>

        <p className="quick-parking-report-target">
          <span aria-hidden="true">⌖</span>
          <span>
            <small>Raporti lidhet me</small>
            <strong>{parking.name}</strong>
          </span>
        </p>

        <div className="quick-parking-report-grid" aria-label="Llojet e raportimit">
          {REPORT_CHOICES.map((choice) => (
            <button
              type="button"
              key={choice.id}
              className={`${selectedId === choice.id ? "selected" : ""} ${choice.tone ? `quick-parking-report-choice--${choice.tone}` : ""}`}
              onClick={() => {
                setSelectedId(choice.id);
                setStatus("idle");
                setError("");
              }}
              aria-pressed={selectedId === choice.id}
            >
              <b aria-hidden="true">{choice.icon}</b>
              <span>
                <strong>{choice.label}</strong>
                <small>{choice.hint}</small>
              </span>
            </button>
          ))}
        </div>

        {selectedChoice && (
          <label className="quick-parking-report-note">
            <span>Shënim shtesë <small>(opsional)</small></span>
            <textarea
              value={note}
              maxLength={300}
              rows={2}
              placeholder="P.sh. hyrja është nga rruga anësore…"
              onChange={(event) => setNote(event.target.value)}
            />
          </label>
        )}

        {status === "success" ? (
          <div className="quick-parking-report-success" role="status">
            <b>✓</b>
            <span>
              <strong>Raporti u dërgua</strong>
              <small>Faleminderit që po e ndihmon komunitetin.</small>
            </span>
            <button type="button" onClick={onClose}>Mbyll</button>
          </div>
        ) : (
          <button
            type="button"
            className="quick-parking-report-submit"
            disabled={!selectedChoice || submitting}
            onClick={() => void submit()}
          >
            {submitting
              ? "Duke dërguar…"
              : canReport
                ? "Dërgo raportin"
                : "Kyçu për të raportuar"}
          </button>
        )}
        {status === "error" && (
          <p className="quick-parking-report-error" role="alert">{error}</p>
        )}
        <p className="quick-parking-report-disclaimer">
          Raportet janë të përkohshme dhe verifikohen nga komuniteti.
        </p>
      </section>
    </div>
  );
}
