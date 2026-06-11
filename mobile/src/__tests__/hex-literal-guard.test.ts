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
];

const HEX_OR_RGBA = /#[0-9a-fA-F]{3,8}\b|rgba?\s*\(/;

describe('hex-literal guard', () => {
  it.each(THEME_CLEAN_FILES)('%s contains no raw hex or rgba literals', (rel) => {
    const abs = path.resolve(__dirname, '../../', rel);
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
  });
});
