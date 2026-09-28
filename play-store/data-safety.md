# Google Play Data Safety — deklarimi i propozuar

Plotëso formularin sipas konfigurimit real të prodhimit. Ky dokument është checklist, jo zëvendësim i formularit në Play Console.

## Të dhëna që aplikacioni mbledh

- Location: approximate dhe precise, për parking afër dhe navigim. Jo për reklama.
- Personal info: name, email, user ID/username. Google account ID and profile photo are used by web sign-in only; the current Android build does not offer Google sign-in, so do not declare these as Android-collected data unless native Google sign-in is added.
- Photos: vetëm kur përdoruesi zgjedh t’i bashkëngjisë një postimi/raportimi.
- App activity: community posts, comments, reactions, parking reports dhe favorites.
- Device or other IDs: push notification token; IP/user-agent për siguri të sesionit.
- App info and performance: limited error and diagnostic events (event type, time, screen path, and technical status); telemetry forwarding is optional and must be checked against the production environment.

## Praktikat

- Data encrypted in transit: po, prodhimi duhet të përdorë vetëm HTTPS.
- User can request deletion: po, në app dhe në `/delete-account`.
- Account data is not sold and is not used for advertising.
- For the web version only, Google receives the sign-in request; Parko receives the verified Google account ID, email, name and, if available, profile photo. The temporary Google ID token is verified server-side and is not retained.
- Map, geocoding, hosting and routing providers receive technical requests such as IP, search text, or the coordinates required for the requested feature.

## Para dorëzimit

- Kontrollo çdo SDK të përfshirë në AAB në Play Console SDK Index.
- Kontrollo cilat ofrues të telemetry, analytics dhe push janë aktivë realisht në prodhim.
- Publiko Privacy Policy dhe Account Deletion URL në domain real HTTPS.
