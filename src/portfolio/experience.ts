/** Experience copy adapted from docs/Resume.pdf; no inferred dates or metrics. */
export const experiences = [
  {
    company: 'Bridge',
    role: 'Full-Stack Engineer',
    period: 'May 2025 – Present',
    location: 'Lehi, Utah',
    theme: 'From financial documents to business decisions.',
    highlights: [
      '~70% faster extraction',
      '9,500+ active listings',
      '1,400+ industry categories',
    ],
    contributions: [
      'Built the AI document extraction pipeline behind Bridge’s business valuation product, turning tax returns and P&L statements into structured financials, aggregation, valuation models, and automated PDF reports. Replacing a third-party workflow vendor with an in-house system cut extraction time by approximately 70%.',
      'Designed and built the full marketplace experience: natural-language search, an interactive map, filtering, and saved listings. Grew the platform to 9,500+ active business listings across 1,400+ industry categories.',
      'Led GCP infrastructure and security work that passed a credit union’s vendor risk review, including US-only data residency, isolated extraction workers, and an audited client data deletion process, managed with Terraform.',
    ],
  },
  {
    company: 'BYU Archaeology',
    role: 'Full-Stack Engineer',
    period: 'Nov 2024 – Apr 2025',
    location: 'Provo, Utah',
    theme: 'Field research, connected even without a signal.',
    highlights: ['Built from scratch', 'Offline-first fieldwork'],
    contributions: [
      'Built Surveyor from scratch, replacing handwritten field records with a structured web platform for logging, searching, and managing archaeological site findings.',
      'Developed an offline-first companion mobile app so field crews could photograph and record findings at remote sites without a signal, then sync to the web platform when reconnected.',
    ],
  },
  {
    company: 'Fitzza',
    role: 'Mobile Application Developer',
    period: null,
    location: 'Remote',
    // PDF says Apr 2024 – Nov 2022. Awaiting the owner’s correction.
    theme: 'A shared-workspace marketplace, built end to end.',
    highlights: ['20+ modular screens', 'Flutter · Firebase'],
    contributions: [
      'Built Fitzza from the ground up in Flutter: phone sign-in, map and radius-based discovery, curated feeds and events, wishlists, a multi-step host listing flow, and real-time chat between guests and hosts.',
      'Designed a feature-based MVVM architecture with Riverpod and GoRouter on a Firebase backend, keeping 20+ screens modular so new features could ship without touching existing ones.',
    ],
  },
  {
    company: 'Neighbor',
    role: 'Full-Stack Engineer',
    period: 'May 2022 – Jan 2024',
    location: 'Lehi, Utah',
    theme: 'Helping renters find spaces that work for them.',
    highlights: [
      '10% higher reservation rate',
      '3% higher search-to-request rate',
      '150% lift for boosted listings',
    ],
    contributions: [
      'Built an automated system to find and remove long-inactive listings with no host engagement. Reducing unresponsive and outdated listings raised the reservation rate by 10%.',
      'Improved search and map integration so renters could browse and compare nearby listings more easily, lifting the search-to-request rate by 3%.',
      'Implemented search placement boosts for enterprise hosts. Boosted listings saw a 150% increase in listing volume and reservations.',
    ],
  },
  {
    company: 'BYU Broadcasting Digital Media',
    role: 'Software Engineer',
    period: 'Sep 2021 – Feb 2022',
    location: 'Provo, Utah',
    theme: 'Taking live audio from broadcast to the web.',
    highlights: ['Serverless AWS pipeline', 'Automated publishing'],
    contributions: [
      'Built Stream Saver, a serverless AWS pipeline that automatically records live audio broadcasts, converts them into files, and publishes them to the website after each session, replacing manual uploads.',
      'Built and maintained scalable API endpoints for BYU’s digital media platforms, improving content delivery to listeners across the web.',
    ],
  },
] as const;

/** Education from docs/Resume.pdf. */
export const education = [
  {
    school: 'Brigham Young University',
    degree: 'B.S. in Computer Science',
    detail: 'Software Engineering emphasis',
    period: 'May 2019 – Dec 2022',
    location: 'Provo, Utah',
    honors: ['Full Academic Scholarship: 2020 – 2022'],
  },
  {
    school: 'Brigham Young University',
    degree: 'Master of Information Systems Management',
    detail: null,
    period: 'Sep 2024 – Sep 2025',
    location: 'Provo, Utah',
    honors: [],
  },
] as const;

/** Skills as listed in docs/Resume.pdf. */
export const skills = [
  'React',
  'TypeScript',
  'HTML',
  'CSS',
  'Python',
  'Java',
  'Dart',
  'Django',
  'Flutter',
  'Node',
  'Postgres',
  'Firebase',
  'GCP',
] as const;
