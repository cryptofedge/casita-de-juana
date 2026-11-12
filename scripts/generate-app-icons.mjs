// Builds the installable-app icons from the round logo (public/brand/logo.png):
//   - Android "maskable" icons: the launcher crops them to a circle/squircle, so the logo sits inside the
//     safe zone (the middle 80%) on the app's cream background.
//   - iPhone/iPad home-screen icon (src/app/apple-icon.png): iOS fills transparent corners with black, so this
//     one is fully opaque.
// Run after changing the logo:  node scripts/generate-app-icons.mjs
import sharp from "sharp";

const LOGO = "public/brand/logo.png";
const BACKGROUND = "#fbf7ee"; // matches manifest background_color

async function icon(file, size, logoShare) {
  const logoSize = Math.round(size * logoShare);
  const logo = await sharp(LOGO).resize(logoSize, logoSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: BACKGROUND } })
    .composite([{ input: logo, gravity: "centre" }])
    .flatten({ background: BACKGROUND })
    .png({ compressionLevel: 9 })
    .toFile(file);
  console.log(`wrote ${file} (${size}x${size})`);
}

await icon("public/brand/icon-maskable-192.png", 192, 0.72);
await icon("public/brand/icon-maskable-512.png", 512, 0.72);
await icon("src/app/apple-icon.png", 180, 0.88);
