// Bundled imagery. Content refers to these as `asset:<name>`; anything else is treated as a full URL
// (for example a Supabase Storage or Cloudinary link uploaded through the admin dashboard).
import heroSunrise from '../assets/img/hero-sunrise.webp';
import summitClouds from '../assets/img/summit-clouds.webp';
import sholaForest from '../assets/img/shola-forest.webp';
import waterfall from '../assets/img/waterfall.webp';
import coorgHills from '../assets/img/coorg-hills.webp';
import campingNight from '../assets/img/camping-night.webp';
import grasslandTrail from '../assets/img/grassland-trail.webp';
import predawnRidges from '../assets/img/predawn-ridges.webp';
import tribeSunrise from '../assets/img/tribe-sunrise.webp';
import poster from '../assets/img/poster.webp';
import trekker from '../assets/img/trekker.webp';
import sunriseClouds from '../assets/img/sunrise-clouds.webp';
import panorama from '../assets/img/panorama.webp';
import logo from '../assets/img/logo-mascot.webp';
import contours from '../assets/img/contours.svg';

export const ASSETS: Record<string, string> = {
  'hero-sunrise': heroSunrise,
  'summit-clouds': summitClouds,
  'shola-forest': sholaForest,
  waterfall,
  'coorg-hills': coorgHills,
  'camping-night': campingNight,
  'grassland-trail': grasslandTrail,
  'predawn-ridges': predawnRidges,
  'tribe-sunrise': tribeSunrise,
  poster,
  trekker,
  'sunrise-clouds': sunriseClouds,
  panorama,
};

/** Natural aspect ratios (w/h) so images reserve space before they load. */
export const ASSET_RATIO: Record<string, number> = {
  'hero-sunrise': 1920 / 1134,
  'predawn-ridges': 1920 / 1152,
  waterfall: 1000 / 1286,
  poster: 900 / 1184,
  trekker: 388 / 460,
  'sunrise-clouds': 390 / 470,
  panorama: 1320 / 210,
};

export function img(url: string | null | undefined): string {
  if (!url) return '';
  if (url.startsWith('asset:')) return ASSETS[url.slice(6)] ?? '';
  return url;
}
export function ratioOf(url: string | null | undefined): number {
  if (url?.startsWith('asset:')) return ASSET_RATIO[url.slice(6)] ?? 1.5;
  return 1.5;
}

export const LOGO = logo;
export const CONTOURS = contours;
