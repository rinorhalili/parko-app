const html = await (await fetch("https://prishtinaparking.net/harta/")).text();
const markerKey = '"markers":[';
const start = html.indexOf(markerKey);
let index = start + markerKey.length - 1;
let depth = 0;
let inString = false;
let escaped = false;
let end = -1;

for (; index < html.length; index += 1) {
  const char = html[index];
  if (inString) {
    if (escaped) escaped = false;
    else if (char === "\\") escaped = true;
    else if (char === '"') inString = false;
    continue;
  }
  if (char === '"') inString = true;
  else if (char === "[") depth += 1;
  else if (char === "]") {
    depth -= 1;
    if (depth === 0) {
      end = index + 1;
      break;
    }
  }
}

const markers = JSON.parse(
  html
    .slice(start + markerKey.length - 1, end)
    .replace(/\\\//g, "/")
    .replace(/\\u003C/g, "<")
    .replace(/\\u003E/g, ">")
    .replace(/\\u0026/g, "&"),
);

for (const marker of markers) {
  if (/^(J\d+:|Zyra)/i.test(marker.title)) continue;
  if (/pa pagese|pa kontroll/i.test(marker.title)) continue;
  if (!(/^([A-Z]\d+):/.test(marker.title) || /Parking(u)?\s+(Rezidencial|i perzier)/i.test(marker.title))) continue;

  const description = String(marker.description || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (description) {
    console.log(`${marker.id} | ${marker.title} | ${description}`);
  }
}
