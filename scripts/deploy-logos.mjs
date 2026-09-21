import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const srcDir = 'D:/PROJECTS/WEBSITES/Zolo-fund-reference';
const rootDir = process.cwd();
const webAssetsDir = path.join(rootDir, 'public', 'assets');
const webPublicDir = path.join(rootDir, 'public');
const mobileAssetsDir = path.join(rootDir, 'mobile', 'assets', 'images');
const androidResDir = path.join(rootDir, 'mobile', 'android', 'app', 'src', 'main', 'res');
const iosAppIconDir = path.join(rootDir, 'mobile', 'ios', 'Runner', 'Assets.xcassets', 'AppIcon.appiconset');

if (!fs.existsSync(webAssetsDir)) fs.mkdirSync(webAssetsDir, { recursive: true });
if (!fs.existsSync(mobileAssetsDir)) fs.mkdirSync(mobileAssetsDir, { recursive: true });

async function deployLogos() {
  console.log('Deploying logos from', srcDir);

  const hDark = path.join(srcDir, 'logo-horizontal-for-dark-bg.png');
  const hLight = path.join(srcDir, 'logo-horizontal-for-light-bg.png');
  const sDark = path.join(srcDir, 'logo-vertical-for-dark-bg.png');
  const sLight = path.join(srcDir, 'logo-vertical-for-light-bg.png.png');

  // 1. Web public assets
  await sharp(hDark).png().toFile(path.join(webAssetsDir, 'logo-horizontal-dark.png'));
  await sharp(hLight).png().toFile(path.join(webAssetsDir, 'logo-horizontal-light.png'));
  await sharp(sDark).png().toFile(path.join(webAssetsDir, 'logo-square-dark.png'));
  await sharp(sLight).png().toFile(path.join(webAssetsDir, 'logo-square-light.png'));

  // Root fallback logo and touch icons
  await sharp(hDark).png().toFile(path.join(webPublicDir, 'logo.png'));
  await sharp(sDark).resize(180, 180).png().toFile(path.join(webPublicDir, 'apple-touch-icon.png'));
  await sharp(sDark).resize(32, 32).png().toFile(path.join(webPublicDir, 'favicon.ico'));
  await sharp(sDark).resize(192, 192).png().toFile(path.join(webAssetsDir, 'logo-192.png'));
  await sharp(sDark).resize(512, 512).png().toFile(path.join(webAssetsDir, 'logo-512.png'));

  console.log('Web assets deployed.');

  // 2. Mobile assets in mobile/assets/images/
  await sharp(hDark).png().toFile(path.join(mobileAssetsDir, 'logo-horizontal-dark.png'));
  await sharp(hLight).png().toFile(path.join(mobileAssetsDir, 'logo-horizontal-light.png'));
  await sharp(sDark).png().toFile(path.join(mobileAssetsDir, 'logo-square-dark.png'));
  await sharp(sLight).png().toFile(path.join(mobileAssetsDir, 'logo-square-light.png'));
  await sharp(sDark).resize(1024, 1024).png().toFile(path.join(mobileAssetsDir, 'app_icon.png'));
  await sharp(hDark).png().toFile(path.join(mobileAssetsDir, 'logo.png'));

  console.log('Mobile image assets deployed.');

  // 3. Android mipmap launcher icons
  const androidMipmaps = [
    { dir: 'mipmap-mdpi', size: 48 },
    { dir: 'mipmap-hdpi', size: 72 },
    { dir: 'mipmap-xhdpi', size: 96 },
    { dir: 'mipmap-xxhdpi', size: 144 },
    { dir: 'mipmap-xxxhdpi', size: 192 },
  ];

  for (const { dir, size } of androidMipmaps) {
    const targetDir = path.join(androidResDir, dir);
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
    await sharp(sDark).resize(size, size).png().toFile(path.join(targetDir, 'ic_launcher.png'));
    await sharp(sDark).resize(size, size).png().toFile(path.join(targetDir, 'launcher_icon.png'));
  }
  console.log('Android launcher icons deployed.');

  // 4. Android push notification icon (crisp white monochrome silhouette for status bar)
  // For status bar notifications in Android 5.0+, the icon must be entirely white with alpha.
  // We extract the alpha channel and create a pure white mask with the same alpha.
  const notifSizes = [
    { dir: 'drawable', size: 24 },
    { dir: 'drawable-hdpi', size: 36 },
    { dir: 'drawable-mdpi', size: 24 },
    { dir: 'drawable-xhdpi', size: 48 },
    { dir: 'drawable-xxhdpi', size: 72 },
    { dir: 'drawable-xxxhdpi', size: 96 },
  ];

  for (const { dir, size } of notifSizes) {
    const targetDir = path.join(androidResDir, dir);
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
    
    // Create notification icon: extract alpha and tint pure white
    const alphaBuffer = await sharp(sDark)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .ensureAlpha()
      .extractChannel(3) // alpha channel
      .toBuffer();

    await sharp({
      create: {
        width: size,
        height: size,
        channels: 3,
        background: { r: 255, g: 255, b: 255 },
      },
    })
      .joinChannel(alphaBuffer)
      .png()
      .toFile(path.join(targetDir, 'ic_notification.png'));
  }
  console.log('Android push notification icons deployed.');

  // 5. iOS AppIcon sizes
  const iosIcons = [
    { name: 'Icon-App-20x20@1x.png', size: 20 },
    { name: 'Icon-App-20x20@2x.png', size: 40 },
    { name: 'Icon-App-20x20@3x.png', size: 60 },
    { name: 'Icon-App-29x29@1x.png', size: 29 },
    { name: 'Icon-App-29x29@2x.png', size: 58 },
    { name: 'Icon-App-29x29@3x.png', size: 87 },
    { name: 'Icon-App-40x40@1x.png', size: 40 },
    { name: 'Icon-App-40x40@2x.png', size: 80 },
    { name: 'Icon-App-40x40@3x.png', size: 120 },
    { name: 'Icon-App-60x60@2x.png', size: 120 },
    { name: 'Icon-App-60x60@3x.png', size: 180 },
    { name: 'Icon-App-76x76@1x.png', size: 76 },
    { name: 'Icon-App-76x76@2x.png', size: 152 },
    { name: 'Icon-App-83.5x83.5@2x.png', size: 167 },
    { name: 'Icon-App-1024x1024@1x.png', size: 1024 },
  ];

  if (fs.existsSync(iosAppIconDir)) {
    for (const { name, size } of iosIcons) {
      // iOS app store icon requires no alpha channel (fill background with brand dark color #1A1D23)
      await sharp(sDark)
        .resize(size, size, { fit: 'contain' })
        .flatten({ background: { r: 26, g: 29, b: 35 } })
        .png()
        .toFile(path.join(iosAppIconDir, name));
    }
    console.log('iOS AppIcon assets deployed.');
  }

  console.log('All brand logos deployed and processed successfully!');
}

deployLogos().catch((err) => {
  console.error('Failed to deploy logos:', err);
  process.exit(1);
});
