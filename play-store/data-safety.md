# Google Play Data Safety — deklarimi i propozuar

Plotëso formularin sipas konfigurimit real të prodhimit. Ky dokument është checklist, jo zëvendësim i formularit në Play Console.

## Të dhëna që aplikacioni mbledh

- Location: approximate dhe precise, për parking afër dhe navigim. Jo për reklama.
- Personal info: name, email, user ID/username, për llogari dhe suport.
- Photos: vetëm kur përdoruesi zgjedh t’i bashkëngjisë një postimi/raportimi.
- App activity: community posts, comments, reactions, parking reports dhe favorites.
- Device or other IDs: push notification token; IP/user-agent për siguri të sesionit.
- App info and performance: crash/diagnostic events vetëm nëse endpoint-i i telemetry aktivizohet.

## Praktikat

- Data encrypted in transit: po, prodhimi duhet të përdorë vetëm HTTPS.
- User can request deletion: po, në app dhe në `/delete-account`.
- Account data is not sold and is not used for advertising.
- Map/routing providers receive technical requests such as IP and required coordinates; verifiko kontratat dhe deklarimin final.

## Para dorëzimit

- Kontrollo çdo SDK të përfshirë në AAB në Play Console SDK Index.
- Përputhe formularin me endpoint-et reale të telemetry, analytics dhe push.
- Publiko Privacy Policy dhe Account Deletion URL në domain real HTTPS.
