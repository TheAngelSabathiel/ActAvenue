/**
 * Every static image the site uses lives in /public/images.
 * Replace a file there (same name) or change its path here.
 */
export const IMAGES = {
  /** Navbar logo + favicon. 256x256 */
  logo: "/images/AA_logo.png",
  /** Navbar background texture. 1600x120 */
  navbar: "/images/navbar.png",
  /** Section background texture. 1600x900 */
  background: "/images/background.png",
  /** Fallback when a production has no poster. 600x900 */
  posterPlaceholder: "/images/placeholder-poster.png",
  /** Fallback when a production has no banner. 1600x600 */
  bannerPlaceholder: "/images/placeholder-banner.png",
  /** Fallback when an actor has no photo. 400x400 */
  headshotPlaceholder: "/images/placeholder-headshot.png",
} as const;
