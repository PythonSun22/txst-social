import { colleges as feedColleges } from "./colleges";

// Presentation and choreography follow references/colleges. Only feed IDs and
// asset URLs are adapted to the real application. Keep per-character positioning here.
// Prototype copy and palettes. Character transforms are independent of GSAP's
// animation wrapper, so each asset can be tuned without changing choreography.
const presentation = [
  { id: 'engineering', name: 'Science & Engineering', prefix: 'College of', label: 'The innovators', description: 'For the curious minds and fearless problem-solvers. Find your people at the intersection of discovery, technology, and what comes next.', tags: ['Discover', 'Build', 'Innovate'], color: '#a65329', glow: '#e9a557', dark: '#30231e', position: { x: '0%', y: '1%', scale: 1.02 } },
  { id: 'business', name: 'Business', prefix: 'McCoy College of', label: 'The trailblazers', description: 'Big ideas start with a conversation. Connect with future founders, thoughtful leaders, and the people turning ambition into action.', tags: ['Lead', 'Connect', 'Create'], color: '#6b3042', glow: '#d98990', dark: '#2f1b27', position: { x: '0%', y: '0%', scale: 1 } },
  { id: 'applied_arts', name: 'Applied Arts', prefix: 'College of', label: 'The changemakers', description: 'Bring your perspective to the real world. Meet the hands-on thinkers making a difference in communities, industries, and everyday lives.', tags: ['Make', 'Serve', 'Transform'], color: '#446854', glow: '#a8c288', dark: '#1b2c25', position: { x: '0%', y: '1%', scale: 1 } },
  { id: 'education', name: 'Education', prefix: 'College of', label: 'The inspirers', description: 'A brighter future starts with someone who cares. Find a community of mentors and educators ready to inspire the next generation.', tags: ['Teach', 'Inspire', 'Empower'], color: '#9b6335', glow: '#e5be73', dark: '#352a20', position: { x: '0%', y: '0%', scale: 1 } },
  { id: 'fine_arts', name: 'Fine Arts & Communication', prefix: 'College of', label: 'The storytellers', description: 'Make something worth sharing. Meet the artists, performers, and communicators bringing fresh voices and bold expression to campus.', tags: ['Express', 'Perform', 'Connect'], color: '#76518b', glow: '#c7a0da', dark: '#2d2039', position: { x: '0%', y: '0%', scale: 1 } },
  { id: 'health', name: 'Health Professions', prefix: 'College of', label: 'The caregivers', description: 'Compassion meets purpose. Connect with the people putting care into practice and working toward healthier futures for everyone.', tags: ['Care', 'Support', 'Heal'], color: '#337a80', glow: '#86d5cf', dark: '#183335', position: { x: '0%', y: '0%', scale: 1 } },
  { id: 'honors', name: 'Honors', prefix: 'Honors College', label: 'The questioners', description: 'Follow your curiosity beyond the expected. Find fellow thinkers who ask bigger questions, challenge assumptions, and explore together.', tags: ['Question', 'Explore', 'Discover'], color: '#8b7332', glow: '#e1d18b', dark: '#302c1b', position: { x: '0%', y: '0%', scale: 1 } },
  { id: 'liberal_arts', name: 'Liberal Arts', prefix: 'College of', label: 'The perspectives', description: 'Understand the world. Then help shape it. Meet a community exploring people, cultures, ideas, and the stories that connect us all.', tags: ['Think', 'Understand', 'Connect'], color: '#42618a', glow: '#96b8d8', dark: '#1c293d', position: { x: '0%', y: '0%', scale: 1 } },
  { id: 'graduate', name: 'Graduate College', prefix: 'The', label: 'The pathfinders', description: 'Take your next chapter further. Connect with researchers and creators pursuing deeper questions, new possibilities, and meaningful work.', tags: ['Research', 'Advance', 'Discover'], color: '#673e48', glow: '#ca9d93', dark: '#2d2026', position: { x: '0%', y: '0%', scale: 1 } },
  { id: 'university', name: 'University College', prefix: 'Find your direction', label: 'The explorers', description: 'You don’t need every answer to find your people. Explore possibilities, discover what moves you, and make your own way forward.', tags: ['Explore', 'Belong', 'Begin'], color: '#537b73', glow: '#a0c6ac', dark: '#20352f', position: { x: '0%', y: '0%', scale: 1 } },
];

const feedSlugs: Record<string, string> = {
  engineering: "science_engineering",
  health: "health_professions",
  university: "university_college",
};

export const carouselColleges = presentation.map((college) => {
  const slug = feedSlugs[college.id] ?? college.id;
  const feed = feedColleges.find((item) => item.slug === slug);
  if (!feed) throw new Error(`Missing college feed for ${college.id}`);
  return { ...college, slug, feedName: feed.name, asset: `/colleges/${college.id}.png` };
});

export type CarouselCollege = (typeof carouselColleges)[number];
