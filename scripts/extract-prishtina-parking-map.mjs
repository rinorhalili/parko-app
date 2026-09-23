import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const SOURCE_URL = "https://prishtinaparking.net/harta/";
const targetPath = fileURLToPath(
  new URL("../src/officialPrishtinaParking.ts", import.meta.url),
);

const categoryByCodePrefix = {
  A: "residential",
  B: "residential",
  D: "residential",
  K: "commercial",
  P: "combined",
  U: "residential",
  X: "barrier",
};

const knownCapacities = new Map([
  ["110", 450],
  ["111", 64],
  ["112", 207],
  ["113", 76],
  ["119", 66],
  ["125", 110],
  ["127", 110],
  ["129", 224],
]);

// The municipal tariff is 1 €/hour in Zone 1 and 0.50 €/hour in Zone 2.
// A codes are explicitly documented as Zone 1; B, D, U and P locations are
// Zone 2. Commercial and barrier codes span both zones, so keep their Zone 1
// locations explicit. X1 (Dritan Hoxha) is the published 0.50 €/hour exception.
// Sources:
// - https://prishtinaparking.net/leje-tjera/
// - https://prishtinaparking.net/rreth-nesh/
// - marker descriptions embedded in https://prishtinaparking.net/harta/
const zoneOneCodes = new Set(["K1", "K2", "K3", "X2", "X3", "X6"]);

function visitorPrice(marker) {
  const code = markerCode(marker.title);
  if (code?.startsWith("A") || zoneOneCodes.has(code)) return 1;
  return 0.5;
}

function unescapeHtmlJson(value) {
  return value
    .replace(/\\\//g, "/")
    .replace(/\\u003C/g, "<")
    .replace(/\\u003E/g, ">")
    .replace(/\\u0026/g, "&");
}

function extractMarkerArray(html) {
  const markerKey = '"markers":[';
  const start = html.indexOf(markerKey);
  if (start === -1) throw new Error("Could not find map markers in page HTML.");

  let index = start + markerKey.length - 1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (; index < html.length; index += 1) {
    const char = html[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') {
      inString = true;
    } else if (char === "[") {
      depth += 1;
    } else if (char === "]") {
      depth -= 1;
      if (depth === 0) return html.slice(start + markerKey.length - 1, index + 1);
    }
  }

  throw new Error("Map marker JSON was not closed.");
}

function markerCode(title) {
  return title.match(/^([A-Z]\d+):/)?.[1] ?? null;
}

function markerAddress(title) {
  const match = title.match(/,\s*((?:rr\.?|Parku)[^,]*)$/i);
  if (match) return match[0].replace(/^,\s*/, "").trim();
  return title.includes("Isa Boletini") ? "rr. Isa Boletini" : "Prishtinë";
}

function markerCategory(marker) {
  const code = markerCode(marker.title);
  if (code) return categoryByCodePrefix[code[0]] ?? "residential";
  if (/perzier|kombinuar/i.test(marker.title)) return "combined";
  if (/rezidencial/i.test(marker.title)) return "residential";
  return "commercial";
}

function isPrishtinaParkingMarker(marker) {
  if (/^J\d+:/i.test(marker.title)) return false;
  if (/^Zyra Qendrore/i.test(marker.title)) return false;
  if (/pa pagese|pa kontroll/i.test(marker.title)) return false;
  return Boolean(
    markerCode(marker.title) ||
      /Parking(u)?\s+(Rezidencial|i perzier)/i.test(marker.title),
  );
}

function toOfficialMarker(marker) {
  return {
    markerId: String(marker.id),
    code: markerCode(marker.title),
    title: marker.title,
    address: marker.address || markerAddress(marker.title),
    lat: Number(marker.coord_x),
    lng: Number(marker.coord_y),
    capacity: knownCapacities.get(String(marker.id)) ?? null,
    pricePerHour: visitorPrice(marker),
    category: markerCategory(marker),
  };
}

function renderMarkers(markers) {
  return markers.map((marker) => `  ${JSON.stringify(marker)},`).join("\n");
}

const shouldWrite = process.argv.includes("--write");
const response = await fetch(SOURCE_URL);
if (!response.ok) throw new Error(`Failed to read ${SOURCE_URL}: ${response.status}`);

const html = await response.text();
const rawMarkers = JSON.parse(unescapeHtmlJson(extractMarkerArray(html)));
const officialMarkers = rawMarkers.filter(isPrishtinaParkingMarker).map(toOfficialMarker);

const source = await readFile(targetPath, "utf8");
const updated = source.replace(
  /OFFICIAL_PRISHTINA_PARKING_MARKERS: OfficialPrishtinaParkingMarker\[\] = \[[\s\S]*?\n\]/,
  `OFFICIAL_PRISHTINA_PARKING_MARKERS: OfficialPrishtinaParkingMarker[] = [\n${renderMarkers(officialMarkers)}\n]`,
);

if (source !== updated && shouldWrite) {
  await writeFile(targetPath, updated);
}

console.info(
  `${shouldWrite && source !== updated ? "Updated" : "Extracted"} ${officialMarkers.length} Prishtina Parking markers from ${rawMarkers.length} map markers.`,
);
if (source !== updated && !shouldWrite) {
  console.info("Dataset differs. Re-run with --write to update src/officialPrishtinaParking.ts.");
}
