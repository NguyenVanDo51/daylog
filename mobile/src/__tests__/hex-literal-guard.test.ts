import fs from 'fs';
import path from 'path';

// Files that must not contain raw hex / rgba literals. Adding a file to this
// list means it is considered "theme-clean" and any future hex/rgba added to
// it will fail the build. Extend this list as more screens are migrated.
const THEME_CLEAN_FILES = [
  'src/components/ui/Mascot.tsx',
  'src/components/ui/StickerCard.tsx',
  'src/components/ui/StickerChip.tsx',
  'src/components/ui/StickerButton.tsx',
  'src/components/ui/Avatar.tsx',
  'src/components/tabs/AlbumsPage.tsx',
  'src/components/tabs/CameraPage.tsx',
  'src/components/album/DayCell.tsx',
  'src/components/family/AlbumMenuSheet.tsx',
  'src/components/tabs/SettingsSheet.tsx',
  'src/components/ui/SheetModal.tsx',
  'src/components/family/MembersSheet.tsx',
  'src/components/family/MemberList.tsx',
  'src/components/family/InviteSheet.tsx',
  'src/components/family/QRSheet.tsx',
];

// app/photo-review.tsx is at a different relative root; use the app/ prefix.
const THEME_CLEAN_APP_FILES = [
  'app/photo-review.tsx',
  'app/onboarding.tsx',
  'app/(auth)/index.tsx',
  'app/albums/[id].tsx',
  'app/story/[albumId]/[date].tsx',
  'app/story/[albumId]/_components/VlogOverlay.tsx',
  'app/photo/[id].tsx',
  'app/story/[albumId]/[date]/manage.tsx',
  'app/(tabs)/settings/index.tsx',
  'app/(tabs)/settings/profile.tsx',
  'app/(tabs)/settings/language.tsx',
];

const HEX_OR_RGBA = /#[0-9a-fA-F]{3,8}\b|rgba?\s*\(/;

describe('hex-literal guard', () => {
  it.each(THEME_CLEAN_FILES)('%s contains no raw hex or rgba literals', (rel) => {
    const abs = path.resolve(__dirname, '../../', rel);
    runGuard(abs, rel);
  });
  it.each(THEME_CLEAN_APP_FILES)('%s contains no raw hex or rgba literals', (rel) => {
    const abs = path.resolve(__dirname, '../../', rel);
    runGuard(abs, rel);
  });
});

function runGuard(abs: string, rel: string): void {
  const src = fs.readFileSync(abs, 'utf8');
  // Strip line comments so explanatory `// #ABC` in a comment doesn't trip the check.
  const stripped = src.replace(/\/\/.*$/gm, '');
  const match = stripped.match(HEX_OR_RGBA);
  if (match) {
    const line = stripped.slice(0, match.index).split('\n').length;
    throw new Error(
      `${rel}:${line} contains a raw color literal "${match[0]}". ` +
      `All colors must come from theme.colors.* (see Theme System section ` +
      `of docs/superpowers/specs/2026-06-11-sticker-world-redesign-design.md).`,
    );
  }
}
