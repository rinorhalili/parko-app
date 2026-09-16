# Parko PWA UI

Presentation primitives for the existing parking journey. No new dependency or asset service is required.

## Foundations

`product-ui.css` owns the PWA presentation tokens and shared component styles. `navigation.css` owns the active-trip layout. Use the existing `--primary`, `--ink`, `--muted`, `--line`, surface, radius and shadow tokens instead of introducing screen-specific palettes.

- Inter/system font stack; regular body text, medium metadata, semibold headings.
- Blue is the primary action/selection color; green, amber and red communicate status alongside text.
- Primary actions are 52px high; map controls and marker/cluster hit areas are at least 44px.
- Reduced-motion preferences, safe-area insets and visible keyboard focus remain supported.

## Components

- `AppIcon`: shared decorative SVG icons with hidden accessibility semantics.
- `PrimaryButton`: consistent primary action; does not submit a form by default.
- `MapFloatingControl`: common map-control surface with caller-owned labels/state/callbacks.
- `BottomSheet` / `SheetHandle`: common sheet surface and keyboard-accessible handle. Existing screens retain their snap states and gesture handlers.
- `ParkingActions`: one full-width “Shko këtu” CTA, followed by secondary details/street-view actions.
- `StatusBadge` / `InfoRow`: status and supporting metadata, never color-only.
- `TripSummary`: supplied time/ETA/distance values; no calculations or invented fallback estimates.
- `parkingMarkerHtml`: Leaflet-compatible P-marker presentation. Numbers remain cluster counts; restricted access has a dashed outline.

## Boundaries and verification

Keep API calls, geometry, clustering settings, route progress, GPS reliability, arrival detection and persistence in their existing modules. Map-setting IDs and stored defaults are unchanged. The native app and backend are outside this redesign.

Run `npm run check`, `npm test` and `npm run build`.

Browser checks covered desktop framing, 390px and 320px portrait layouts, search, filters, parking selection, detail sheets, keyboard/touch sheet controls, GPS-unavailable navigation, manual arrival and the walking continuation. Real-device GPS/turn-by-turn and authenticated account/reservation actions still require device/account testing.
