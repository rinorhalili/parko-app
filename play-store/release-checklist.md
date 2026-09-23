# Parko Android / Play Store release checklist

## Kredencialet dhe build-i

- [ ] Kopjo `.env.android.example` në `.env.android` dhe vendos URL-të reale HTTPS.
- [ ] Vendos email real të suportit në `VITE_SUPPORT_EMAIL`.
- [ ] Krijo upload keystore dhe `android/keystore.properties` nga shembulli.
- [ ] Ekzekuto `npm run android:assets`.
- [ ] Ekzekuto `npm run android:bundle`; rezultati pritet te `android/app/build/outputs/bundle/release/app-release.aab`.
- [ ] Ruaj keystore-in dhe fjalëkalimet në password manager/backup të sigurt.

## Testimi

- [ ] Testo instalimin në telefon real: login/register/logout/session restore.
- [ ] Testo lejen e lokacionit: allow precise, allow approximate, deny dhe revoke.
- [ ] Testo hartën, routing-un, çmimet, raportimet, community report/block dhe account deletion.
- [ ] Testo pa internet dhe me server të padisponueshëm.
- [ ] Ngarko AAB në Internal testing dhe kontrollo Pre-launch report.

## Play Console

- [ ] Aktivizo Play App Signing.
- [ ] App category: Maps & Navigation; plotëso contact details.
- [ ] Ngarko app icon 512×512 dhe feature graphic 1024×500 nga ky folder.
- [ ] Shto së paku 2 screenshots telefoni (rekomandohen 4–8) nga build-i final.
- [ ] Plotëso App access me llogari testuese nëse funksionet kërkojnë login.
- [ ] Plotëso Data Safety, Content rating, Ads declaration dhe Target audience.
- [ ] Vendos Privacy Policy dhe Account deletion URL publike HTTPS.
- [ ] Deklaro lejen e lokacionit vetëm për përdorim foreground; app-i nuk kërkon background location.
- [ ] Për llogari personale të reja: përfundo closed test me së paku 12 testues për 14 ditë para production access.
