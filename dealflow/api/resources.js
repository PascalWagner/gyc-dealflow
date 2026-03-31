import fs from 'node:fs';

import { ADMIN_EMAILS, getAdminClient, resolveUserFromAccessToken, setCors, rateLimit } from './_supabase.js';

const LESSON_CATALOG_PATH = new URL('../src/lib/data/cashflow-academy-lessons.json', import.meta.url);
const { sections: SECTIONS = [], lessons: LESSONS = [] } = JSON.parse(fs.readFileSync(LESSON_CATALOG_PATH, 'utf8'));

function mapLessonToVideo(lesson) {
  const section = SECTIONS.find(s => s.id === lesson.section);
  return {
    id: lesson.id,
    title: lesson.lesson_title,
    description: lesson.description,
    category: section ? section.title : 'Education',
    section: lesson.section,
    module: lesson.module,
    youtubeId: lesson.youtubeId || '',
    thumbnail: lesson.youtubeId ? `https://img.youtube.com/vi/${lesson.youtubeId}/maxresdefault.jpg` : '',
    duration: lesson.duration || '',
    order_index: lesson.order_index,
    featured: lesson.featured || false,
    playable: Boolean(lesson.youtubeId)
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

    const hasResourceAccess = isAdmin || tier === 'member';

    const videos = LESSONS
      .slice()
      .sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
      .map(mapLessonToVideo);

    return res.status(200).json({
      videos,
      sections: SECTIONS,
      source: 'cashflow-academy',
      replayLibraryUrl: '/app/resources',
      accessRestricted: !hasResourceAccess,
      accessTier: isAdmin ? 'admin' : (tier || 'free')
    });
  } catch (err) {
    console.error('Resources API error:', err);
    return res.status(500).json({ error: 'Failed to load resources' });
  }
}
