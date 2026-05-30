export default defineEventHandler((event) => {
  // Get the 'count' from query params, default to 10 if missing, max out at 50
  const query = getQuery(event);
  const count = Math.min(Math.max(Number(query.count) || 10, 1), 50);

  // A pool of random authors to select from
  const authors = [
    'Jeff Goldblum', 'Laura Dern', 'Sam Neill', 'Richard Attenborough',
    'Samuel L. Jackson', 'Wayne Knight', 'BD Wong', 'Ariana Richards'
  ];

  // Common aspect ratios and their vertical counterparts (base sizes around 600-900px)
  const aspectRatios = [
    { w: 800, h: 450 }, // 16:9
    { w: 450, h: 800 }, // 9:16
    { w: 800, h: 600 }, // 4:3
    { w: 600, h: 800 }, // 3:4
    { w: 900, h: 600 }, // 3:2
    { w: 600, h: 900 }, // 2:3
    { w: 800, h: 800 }  // 1:1
  ];

  // Generate the requested number of posts
  const posts = Array.from({ length: count }, (_, index) => {
    // Zero-pad the ID (e.g., '0001', '0002')
    const id = String(index + 1).padStart(4, '0');
    
    // Pick a random author
    const author = authors[Math.floor(Math.random() * authors.length)];
    
    // Pick random dimensions
    const dims = aspectRatios[Math.floor(Math.random() * aspectRatios.length)];
    
    // Generate a random seed so Picsum gives unique images even if dimensions match
    const seed = Math.random().toString(36).substring(2, 10);
    const img = `https://picsum.photos/seed/${seed}/${dims?.w}/${dims?.h}`;

    return {
      id,
      author,
      img,
      width: dims?.w,
      height: dims?.h,
    };
  });

  return posts;
});