import fs from 'node:fs';

import { ADMIN_EMAILS, getAdminClient, resolveUserFromAccessToken, setCors, rateLimit } from './_supabase.js';

const ACADEMY_TIERS = new Set(['academy', 'founding', 'inner-circle', 'alumni', 'investor', 'paid', 'member', 'family_office']);
const LESSON_CATALOG_PATH = new URL('../src/lib/data/cashflow-academy-lessons.json', import.meta.url);
const { sections: SECTIONS = [], lessons: LESSONS = [] } = JSON.parse(fs.readFileSync(LESSON_CATALOG_PATH, 'utf8'));
const PLACEHOLDER_VIDEO_IDS = new Set([
  'dQw4w9WgXcQ', '_ivzzmkVtQ4', '31MeoDcwJXQ', 'Z6o05fE7jnE', 'ScMzIvxBSi4',
  'SU-3z6HSF5I', 'n26rrKOgc9s', 'ZbZSe6N_BXs', 'fWvuCWJtGG4', '2Vv-BfVoq4g',
  'ainJXyIk9PQ', 'W24lfMeJj8A', 'TGMyCVD-mGU', 'LXb3EKWsInQ', 'fJ9rUzIMcZQ',
  'kJQP7kiw5Fk', 'lxg95vEVO9U', 'vc1tABmjbf4', 'JGwWNGJdvx8', 'qthre9LQBks',
  'YVK3cZRtowY', 'dpU7VxTOVtk', '9bZkp7q19f0', 'wZWhUTA357w', 'ee5vzoeNV9I',
  'IwP6nLFClCo', '-HKW5B3Af84', 'w1VXLmZEuXQ', 'YQHsXMglC9A', '4punR111vHw',
  'CevxZvSJLk8', 'OPf0YbXqDm0', 'C0WChru4DRc', 'sxOIzbJkk9U', '1ZMj-vRHCfw',
  'Mhm7u1OFz1U', 'RgKAFK5djSk', 'ZU8hcallDX8', '3rJKwu_SF2I', '223iJ3UobpQ',
  '60ItHLz5WEA', 'hT_nvWreIhg', 'l482T0yNkeo', 'pRpeEdMmmQ0', 'fLexgOxsZu0',
  'IcrbM1l_BoI', 'vlqAJBEsfQs', 'oI-rYMhAEvM', 'YxAm0pvwRXw', 'dgFqqhezprY',
  'M7lc1UVf-VE', 'zelS0E186CE', 'KJbjaJR9iOg', 'QH2-TGUlwu4', '09R8_2nJtjg',
  'V-_O7nl0Ii0', 'DLzxrzFCyOs'
]);

function isPlaceholderVideoId(youtubeId) {
  return PLACEHOLDER_VIDEO_IDS.has(String(youtubeId || '').trim());
}

function mapLessonToVideo(lesson) {
  const section = SECTIONS.find(s => s.id === lesson.section);
  const placeholderVideo = isPlaceholderVideoId(lesson.youtubeId);
  return {
    id: lesson.id,
    title: lesson.lesson_title,
    description: lesson.description,
    category: section ? section.title : 'Education',
    section: lesson.section,
    module: lesson.module,
    youtubeId: placeholderVideo ? '' : lesson.youtubeId,
    thumbnail: !placeholderVideo && lesson.youtubeId ? `https://img.youtube.com/vi/${lesson.youtubeId}/hqdefault.jpg` : '',
    duration: lesson.duration || '',
    order_index: lesson.order_index,
    featured: lesson.featured || false,
    isPlaceholderVideo: placeholderVideo,
    playable: !placeholderVideo && Boolean(lesson.youtubeId)
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
