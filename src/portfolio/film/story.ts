import { experiences } from '../experience';
// Fitzza is an undated interlude: the résumé contains inconsistent dates.
export const story = [
  {
    name: 'Prologue',
    year: 'A WORK IN PROGRESS',
    title: 'A life,\nin the making.',
    line: 'Jongwoo Lim / Full-stack software engineer',
    text: 'From a live broadcast to a business finding its next owner. A journey through the systems I build, and the people they serve.',
    color: '#e5b898',
    experience: null,
  },
  {
    name: 'Broadcasting',
    year: '2021 — 2022 / BYU BROADCASTING',
    title: 'Give a moment\na longer life.',
    line: 'Software Engineer · Provo, Utah',
    text: 'A live broadcast ends. Its story shouldn’t. I built a serverless pipeline to carry live audio into a lasting digital library.',
    color: '#dca77d',
    experience: experiences[4],
  },
  {
    name: 'Neighbor',
    year: '2022 — 2024 / NEIGHBOR',
    title: 'Make room\nfor connection.',
    line: 'Full-Stack Engineer · Lehi, Utah',
    text: 'Behind every listing is someone with space, and someone who needs it. I worked on the systems that help them find each other.',
    color: '#98bed2',
    experience: experiences[3],
  },
  {
    name: 'Fitzza',
    year: 'AN INTERLUDE / FITZZA',
    title: 'Build a place\nto belong.',
    line: 'Mobile Application Developer · Remote',
    text: 'From a first sign-in to a conversation with a host. I built a shared-workspace marketplace from the ground up.',
    color: '#b4a6dc',
    experience: experiences[2],
  },
  {
    name: 'Archaeology',
    year: '2024 — 2025 / BYU ARCHAEOLOGY',
    title: 'Bring discoveries\nback to the world.',
    line: 'Full-Stack Engineer · Provo, Utah',
    text: 'Some of the most important work happens far from a signal. I built tools that let field crews capture findings wherever discovery takes them.',
    color: '#a7c9b2',
    experience: experiences[1],
  },
  {
    name: 'Bridge',
    year: '2025 — PRESENT / BRIDGE',
    title: 'Turn complexity\ninto possibility.',
    line: 'Full-Stack Engineer · Lehi, Utah',
    text: 'Financial documents become structured data. Data becomes a valuation. A business finds its next chapter. I build the connections in between.',
    color: '#e5bc89',
    experience: experiences[0],
  },
  {
    name: 'What’s next',
    year: 'THE NEXT CHAPTER',
    title: 'Still curious.\nStill building.',
    line: 'Jongwoo Lim',
    text: 'There’s more to make, more to learn, and more people to build with. Let’s see where the next chapter takes us.',
    color: '#d7bda5',
    experience: null,
  },
] as const;
export function cameraChapter(raw: number) {
  const i = Math.floor(raw),
    t = Math.min(1, Math.max(0, (raw - i - 0.42) / 0.58));
  return Math.min(6, i + t * t * (3 - 2 * t));
}
