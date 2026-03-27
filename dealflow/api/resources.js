import { ADMIN_EMAILS, getAdminClient, resolveUserFromAccessToken, setCors, rateLimit } from './_supabase.js';

const ACADEMY_TIERS = new Set(['academy', 'founding', 'inner-circle', 'alumni', 'investor', 'paid', 'member', 'family_office']);

const SECTIONS = [
  {
    id: 'strategy',
    title: 'Strategy',
    description: 'Build your investment thesis, understand asset classes, and develop a clear plan before deploying capital.'
  },
  {
    id: 'deal-flow',
    title: 'Deal Flow',
    description: 'Learn how to source, evaluate, and filter deals so you only spend time on opportunities worth pursuing.'
  },
  {
    id: 'execution',
    title: 'Execution',
    description: 'Close deals with confidence — due diligence, underwriting, legal structures, and post-close asset management.'
  }
];

const LESSONS = [
  { id: 'welcome-001', section: 'strategy', module: 'Getting Started', lesson_title: 'Welcome to Cashflow Academy', description: 'An overview of how the academy is structured, what to expect, and how to get the most out of every module.', youtubeId: 'dQw4w9WgXcQ', order_index: 1, duration: '12 min', featured: true },
  { id: 'strategy-002', section: 'strategy', module: 'Getting Started', lesson_title: 'Defining Your Investment Thesis', description: 'How to articulate what you\'re looking for, what asset classes fit your goals, and why clarity upfront saves months of wasted effort.', youtubeId: 'ScMzIvxBSi4', order_index: 2, duration: '18 min' },
  { id: 'strategy-003', section: 'strategy', module: 'Getting Started', lesson_title: 'Understanding Risk-Adjusted Returns', description: 'Break down IRR, equity multiples, cash-on-cash, and learn which metrics actually matter for passive investors.', youtubeId: 'ZbZSe6N_BXs', order_index: 3, duration: '22 min' },
  { id: 'strategy-004', section: 'strategy', module: 'Asset Classes', lesson_title: 'Multifamily Fundamentals', description: 'Why multifamily remains the backbone of most LP portfolios — occupancy drivers, rent growth, and value-add mechanics.', youtubeId: '2Vv-BfVoq4g', order_index: 4, duration: '25 min' },
  { id: 'strategy-005', section: 'strategy', module: 'Asset Classes', lesson_title: 'Self-Storage, Industrial & Niche Assets', description: 'Emerging asset classes that offer diversification — what to look for and the unique risks of each.', youtubeId: 'LXb3EKWsInQ', order_index: 5, duration: '20 min' },
  { id: 'strategy-006', section: 'strategy', module: 'Asset Classes', lesson_title: 'Debt Funds & Private Credit', description: 'How lending-side investments work, preferred return structures, and when debt beats equity.', youtubeId: 'fJ9rUzIMcZQ', order_index: 6, duration: '19 min' },
  { id: 'strategy-007', section: 'strategy', module: 'Portfolio Strategy', lesson_title: 'Building a Balanced LP Portfolio', description: 'Allocation frameworks, vintage year diversification, and how to think about portfolio construction as a passive investor.', youtubeId: 'kJQP7kiw5Fk', order_index: 7, duration: '24 min' },
  { id: 'strategy-008', section: 'strategy', module: 'Portfolio Strategy', lesson_title: 'Tax Strategy for Real Estate Investors', description: 'K-1s, depreciation, cost segregation, and 1031 exchanges explained in plain English for passive investors.', youtubeId: 'JGwWNGJdvx8', order_index: 8, duration: '28 min' },
  { id: 'dealflow-001', section: 'deal-flow', module: 'Sourcing Deals', lesson_title: 'Where to Find Quality Deal Flow', description: 'The best channels for sourcing syndications, funds, and direct deals — and how to filter signal from noise.', youtubeId: '9bZkp7q19f0', order_index: 9, duration: '21 min' },
  { id: 'dealflow-002', section: 'deal-flow', module: 'Sourcing Deals', lesson_title: 'Evaluating Sponsors & GPs', description: 'Track record analysis, reference checks, and red flags to watch for when vetting operators and general partners.', youtubeId: 'YQHsXMglC9A', order_index: 10, duration: '26 min' },
  { id: 'dealflow-003', section: 'deal-flow', module: 'Sourcing Deals', lesson_title: 'Reading an Investment Deck', description: 'How to quickly parse a pitch deck, identify the key assumptions, and spot what\'s missing before diving deeper.', youtubeId: 'CevxZvSJLk8', order_index: 11, duration: '23 min' },
  { id: 'dealflow-004', section: 'deal-flow', module: 'Deal Screening', lesson_title: 'The 5-Minute Deal Screen', description: 'A repeatable framework to quickly decide if a deal is worth your time — before spending hours on diligence.', youtubeId: 'OPf0YbXqDm0', order_index: 12, duration: '16 min' },
  { id: 'dealflow-005', section: 'deal-flow', module: 'Deal Screening', lesson_title: 'Market Analysis for LPs', description: 'How to evaluate submarket fundamentals — job growth, population trends, supply pipeline, and rent comps.', youtubeId: 'RgKAFK5djSk', order_index: 13, duration: '22 min' },
  { id: 'dealflow-006', section: 'deal-flow', module: 'Deal Screening', lesson_title: 'Understanding Deal Structures', description: 'Pref equity, common equity, waterfall splits, and co-invest terms — what each structure means for your returns.', youtubeId: '60ItHLz5WEA', order_index: 14, duration: '27 min' },
  { id: 'dealflow-007', section: 'deal-flow', module: 'Deal Reviews', lesson_title: 'Live Deal Review: Multifamily Value-Add', description: 'Walk through a real multifamily deal submission — analyzing the deck, financials, and sponsor track record in real time.', youtubeId: 'hT_nvWreIhg', order_index: 15, duration: '38 min' },
  { id: 'dealflow-008', section: 'deal-flow', module: 'Deal Reviews', lesson_title: 'Live Deal Review: Build-to-Rent Fund', description: 'Analyzing a BTR fund — the economics of new construction, lease-up risk, and what makes this structure different.', youtubeId: 'l482T0yNkeo', order_index: 16, duration: '35 min' },
  { id: 'execution-001', section: 'execution', module: 'Due Diligence', lesson_title: 'The LP Due Diligence Checklist', description: 'A step-by-step checklist for evaluating any passive real estate investment — from financials to legal docs.', youtubeId: 'pRpeEdMmmQ0', order_index: 17, duration: '30 min' },
  { id: 'execution-002', section: 'execution', module: 'Due Diligence', lesson_title: 'Reading the PPM & Operating Agreement', description: 'What to look for in the private placement memorandum and operating agreement — the clauses that actually matter.', youtubeId: 'fLexgOxsZu0', order_index: 18, duration: '25 min' },
  { id: 'execution-003', section: 'execution', module: 'Due Diligence', lesson_title: 'Underwriting Assumptions to Challenge', description: 'The 7 assumptions sponsors get wrong most often — and how to stress-test projections yourself.', youtubeId: 'IcrbM1l_BoI', order_index: 19, duration: '23 min' },
  { id: 'execution-004', section: 'execution', module: 'Closing & Funding', lesson_title: 'Wiring Funds & Subscription Docs', description: 'The logistics of investing — accreditation verification, subscription agreements, and how the capital call process works.', youtubeId: 'M7lc1UVf-VE', order_index: 20, duration: '15 min' },
  { id: 'execution-005', section: 'execution', module: 'Closing & Funding', lesson_title: 'Entity Structures for LP Investing', description: 'LLCs, trusts, SDIRAs, and solo 401(k)s — which entity to use and when it matters for asset protection and taxes.', youtubeId: 'QH2-TGUlwu4', order_index: 21, duration: '20 min' },
  { id: 'execution-006', section: 'execution', module: 'Post-Close', lesson_title: 'Monitoring Your Investments', description: 'What to look for in quarterly reports, distribution notices, and how to know when a deal is off-track.', youtubeId: '09R8_2nJtjg', order_index: 22, duration: '18 min' },
  { id: 'execution-007', section: 'execution', module: 'Post-Close', lesson_title: 'When Deals Go Sideways', description: 'Capital calls, loan maturities, and restructures — what to do when an investment doesn\'t go as planned.', youtubeId: 'V-_O7nl0Ii0', order_index: 23, duration: '22 min' },
  { id: 'execution-008', section: 'execution', module: 'Office Hours', lesson_title: 'Office Hours: LP Q&A Session', description: 'Recorded member Q&A covering sponsor vetting, portfolio allocation, and real-time deal analysis.', youtubeId: 'DLzxrzFCyOs', order_index: 24, duration: '45 min' }
];

function mapLessonToVideo(lesson) {
  const section = SECTIONS.find(s => s.id === lesson.section);
  return {
    id: lesson.id,
    title: lesson.lesson_title,
    description: lesson.description,
    category: section ? section.title : 'Education',
    section: lesson.section,
    module: lesson.module,
    youtubeId: lesson.youtubeId,
    thumbnail: lesson.youtubeId ? `https://img.youtube.com/vi/${lesson.youtubeId}/hqdefault.jpg` : '',
    duration: lesson.duration || '',
    order_index: lesson.order_index,
    featured: lesson.featured || false
  };
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, { maxRequests: 30, windowMs: 60_000 })) return;

  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Authorization token required' });
  }

  try {
    const { user } = await resolveUserFromAccessToken(token);
    if (!user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const admin = getAdminClient();
    const email = (user.email || '').toLowerCase();
    let profile = null;

    if (user.id) {
      const profileResponse = await admin
        .from('user_profiles')
        .select('tier, is_admin')
        .eq('id', user.id)
        .maybeSingle();
      profile = profileResponse.data || null;
    }

    const isAdmin = Boolean(profile?.is_admin) || ADMIN_EMAILS.includes(email);
    const tier = (profile?.tier || '').toLowerCase();

    if (!isAdmin && !ACADEMY_TIERS.has(tier)) {
      return res.status(403).json({ error: 'Cashflow Academy membership required' });
    }

    const videos = LESSONS
      .slice()
      .sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
      .map(mapLessonToVideo);

    return res.status(200).json({
      videos,
      sections: SECTIONS,
      source: 'cashflow-academy',
      replayLibraryUrl: '/app/resources'
    });
  } catch (err) {
    console.error('Resources API error:', err);
    return res.status(500).json({ error: 'Failed to load resources' });
  }
}
