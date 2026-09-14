export type ValidationResult = { valid: true } | { valid: false; message: string };

export function required(value: unknown, message = "Kjo fushë është e detyrueshme"): ValidationResult {
  return typeof value === "string" ? value.trim() ? { valid: true } : { valid: false, message } : value ? { valid: true } : { valid: false, message };
}

export function validEmail(value: string): ValidationResult {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
    ? { valid: true }
    : { valid: false, message: "Shkruaj një email të vlefshëm" };
}

export function validCoordinate(lat: number, lng: number): ValidationResult {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
    ? { valid: true }
    : { valid: false, message: "Koordinatat nuk janë të vlefshme" };
}
