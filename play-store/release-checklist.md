# Parko Android / Play Store release checklist

## Kredencialet dhe build-i

- [x] `.env.android` përdor URL-të reale HTTPS të Render dhe emailin real të suportit.
- [x] `VITE_SUPPORT_EMAIL=doriangalaxyeu@gmail.com`.
- [x] Upload keystore dhe `android/keystore.properties` u krijuan lokalisht dhe janë të përjashtuara nga Git.
- [x] `npm run android:assets` kaloi.
- [x] `npm run android:bundle` kaloi; AAB: `android/app/build/outputs/bundle/release/app-release.aab`.
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

## URL-të e prodhimit

- Web: https://parko-app.vercel.app
- API: https://parko-api-mz8b.onrender.com
- Privacy: https://parko-app.vercel.app/privacy
- Account deletion: https://parko-app.vercel.app/delete-account
