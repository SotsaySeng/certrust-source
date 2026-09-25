/**
 * Shared helper for one-time seed scripts that need to get a checked-in
 * static image (see bootstrap/assets/homepage/) into Strapi's media
 * library, so a singleType's media field has a real default value instead
 * of shipping empty. Used by global-settings-seed.ts and homepage-seed.ts.
 */

import fs from 'fs';
import path from 'path';

// NOT __dirname: this module runs from dist/src/bootstrap/ once compiled
// (this project's `npm run develop`/`start` compile to dist/ and run from
// there, confirmed via a live boot log - "Compiling TS" then executing out
// of dist/), but the checked-in .svg seed assets live only under the
// source tree (src/bootstrap/assets/homepage/) since tsc doesn't copy
// non-.ts files into dist/. process.cwd() is reliably the backend project
// root regardless of dev/dist, matching how every npm script in this repo
// is always invoked from src/backend/.
const ASSETS_DIR = path.join(process.cwd(), 'src', 'bootstrap', 'assets', 'homepage');

const MIME_TYPES: Record<string, string> = {
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

/**
 * Uploads bootstrap/assets/homepage/<filename> via Strapi's upload plugin
 * service and returns the created file's id (for attaching to a media
 * attribute), or null if the upload fails - callers should treat null as
 * "leave the field empty" rather than crash the whole seed.
 */
export async function uploadSeedImage(strapi: any, filename: string): Promise<number | null> {
  try {
    const filepath = path.join(ASSETS_DIR, filename);
    const ext = path.extname(filename).toLowerCase();
    const mimetype = MIME_TYPES[ext] || 'application/octet-stream';
    const { size } = fs.statSync(filepath);

    const uploaded = await strapi.plugin('upload').service('upload').upload({
      data: {},
      files: {
        filepath,
        originalFilename: filename,
        mimetype,
        size,
      },
    });

    const file = Array.isArray(uploaded) ? uploaded[0] : uploaded;
    return file?.id ?? null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    strapi.log.error(`[Seed] Error uploading seed image ${filename}: ${message}`);
    return null;
  }
}

export default uploadSeedImage;
