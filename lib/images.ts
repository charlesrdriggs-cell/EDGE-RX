/**
 * Stock photos from Unsplash (free to use under the Unsplash License, no attribution required,
 * credited here anyway). Swap any URL for your own photo later: put the file in /public and use
 * e.g. "/photos/my-bench.jpg".
 */
const u = (id: string, w: number) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=75`;

export const PHOTOS = {
  hero: {
    src: (w = 1400) => u("photo-1758631130768-f9f77f8a4def", w),
    alt: "Hot waxing a ski base with a red waxing iron",
    credit: "Ostbacher Stern",
    href: "https://unsplash.com/photos/hand-waxing-a-ski-with-a-red-iron-8_NVqfbXVWA",
  },
  bench: {
    src: (w = 1000) => u("photo-1758631130769-8a2899c547cb", w),
    alt: "Working a ski edge on the tuning bench",
    credit: "Ostbacher Stern",
    href: "https://unsplash.com/photos/person-waxing-a-ski-edge-with-a-block-AezX4jEO7mA",
  },
  skier: {
    src: (w = 2000) => u("photo-1691727475583-021a99db1f99", w),
    alt: "Skier carving down a groomed slope",
    credit: "Michelle McEwen",
    href: "https://unsplash.com/photos/a-person-riding-skis-down-a-snow-covered-slope-hkzpBr621QE",
  },
  rider: {
    src: (w = 1000) => u("photo-1580289461070-a2822e63a89e", w),
    alt: "Snowboarder riding fresh snow",
    credit: "Logan Weaver",
    href: "https://unsplash.com/photos/man-in-blue-jacket-and-black-pants-riding-on-snowboard-FHlU2HX8Pdo",
  },
  rack: {
    src: (w = 1000) => u("photo-1572349213424-44d6129638c9", w),
    alt: "A rack of skis",
    credit: "Scott Gummerson",
    href: "https://unsplash.com/photos/assorted-skiis-Qe7zFF6vU2Q",
  },
} as const;
