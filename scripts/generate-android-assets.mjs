import sharp from 'sharp'
import { mkdir, readdir, rename } from 'node:fs/promises'
import { resolve, join } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const source = resolve(root, 'public/icons/android-chrome-512x512.png')
const res = resolve(root, 'android/app/src/main/res')
const store = resolve(root, 'play-store')
const densities = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 }

await mkdir(store, { recursive: true })
for (const [density, size] of Object.entries(densities)) {
  const dir = join(res, `mipmap-${density}`)
  await mkdir(dir, { recursive: true })
  await sharp(source).resize(size, size).png().toFile(join(dir, 'ic_launcher.png'))
  await sharp(source).resize(size, size).png().toFile(join(dir, 'ic_launcher_round.png'))
  await sharp(source).resize(size * 2.25, size * 2.25).png().toFile(join(dir, 'ic_launcher_foreground.png'))
}

for (const entry of await readdir(res, { withFileTypes: true })) {
  if (!entry.isDirectory() || !entry.name.startsWith('drawable')) continue
  const splashPath = join(res, entry.name, 'splash.png')
  try {
    const metadata = await sharp(splashPath).metadata()
    const width = metadata.width || 1080
    const height = metadata.height || 1920
    const logoSize = Math.round(Math.min(width, height) * 0.24)
    const logo = await sharp(source).resize(logoSize, logoSize).png().toBuffer()
    const temporaryPath = `${splashPath}.tmp`
    await sharp({ create: { width, height, channels: 4, background: '#f3f7fb' } })
      .composite([{ input: logo, gravity: 'centre' }])
      .png()
      .toFile(temporaryPath)
    await rename(temporaryPath, splashPath)
  } catch { /* A density folder without a splash image is expected. */ }
}

await sharp(source).resize(512, 512).png().toFile(join(store, 'app-icon-512.png'))
const featureSvg = Buffer.from(`<svg width="1024" height="500" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#1557e8"/><stop offset="1" stop-color="#2f8cff"/></linearGradient></defs><rect width="1024" height="500" fill="url(#g)"/><circle cx="825" cy="250" r="205" fill="#fff" opacity=".09"/><text x="90" y="205" fill="white" font-family="Arial,sans-serif" font-size="92" font-weight="700">Parko</text><text x="94" y="282" fill="#dce9ff" font-family="Arial,sans-serif" font-size="34">Parking më i lehtë në Prishtinë</text><text x="94" y="342" fill="white" font-family="Arial,sans-serif" font-size="25">Gjej • Raporto • Parko</text></svg>`)
const logo = await sharp(source).resize(260, 260).png().toBuffer()
await sharp(featureSvg).composite([{ input: logo, left: 690, top: 120 }]).png().toFile(join(store, 'feature-graphic-1024x500.png'))
console.log('Android dhe Play Store assets u gjeneruan.')
