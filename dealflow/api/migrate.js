// Temporary migration runner — delete after use
// GET /api/migrate?key=migrate006
//
// Uses Supabase's admin client to create tables via a two-step workaround:
// 1. Try direct pg connection if DATABASE_URL exists
// 2. Otherwise, use Supabase's internal SQL execution

import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.query.key !== 'migrate006') {
    return res.status(403).json({ error: 'bad key' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' });
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  // Check if table already exists
  const { data: existing, error: checkErr } = await supabase.from('deal_qa').select('id').limit(1);
  if (!checkErr) {
    return res.status(200).json({ status: 'deal_qa table already exists', rows: (existing || []).length });
  }

  // Table doesn't exist — try DATABASE_URL first
  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING;

  if (dbUrl) {
    try {
      const pg = await import('pg');
      const pool = new pg.default.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

      await pool.query(`
        CREATE TABLE IF NOT EXISTS deal_qa (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          deal_id TEXT NOT NULL,
          deal_name TEXT DEFAULT '',
          question TEXT NOT NULL,
          asked_by_email TEXT DEFAULT '',
          asked_by_name TEXT DEFAULT 'Anonymous',
          answer TEXT,
          answered_by TEXT,
          answered_at TIMESTAMPTZ,
          upvotes INTEGER DEFAULT 0,
          status TEXT DEFAULT 'pending',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_deal_qa_deal_id ON deal_qa(deal_id);
        CREATE INDEX IF NOT EXISTS idx_deal_qa_status ON deal_qa(status);
        ALTER TABLE deal_qa ENABLE ROW LEVEL SECURITY;
      `);

      const policies = [
        `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='deal_qa' AND policyname='Anyone can read deal Q&A') THEN CREATE POLICY "Anyone can read deal Q&A" ON deal_qa FOR SELECT USING (true); END IF; END $$;`,
        `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='deal_qa' AND policyname='Anyone can ask questions') THEN CREATE POLICY "Anyone can ask questions" ON deal_qa FOR INSERT WITH CHECK (true); END IF; END $$;`,
        `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='deal_qa' AND policyname='Admins can update Q&A') THEN CREATE POLICY "Admins can update Q&A" ON deal_qa FOR UPDATE USING (true); END IF; END $$;`
      ];

      for (const p of policies) {
        try { await pool.query(p); } catch(e) { /* ignore if exists */ }
      }

      // Notify PostgREST to reload schema cache
      await pool.query("NOTIFY pgrst, 'reload schema'");
      await pool.end();

      return res.status(200).json({ status: 'migration complete via DATABASE_URL' });
    } catch (err) {
      return res.status(500).json({ status: 'pg connection failed', error: err.message, dbUrlPrefix: dbUrl.substring(0, 30) + '...' });
    }
  }

  // No DATABASE_URL — list what env vars we DO have (names only, not values)
  const envKeys = Object.keys(process.env).filter(k =>
    k.includes('SUPA') || k.includes('POSTGRES') || k.includes('DATABASE') || k.includes('PG') || k.includes('DB_')
  );

  return res.status(200).json({
    status: 'no DATABASE_URL found',
    availableEnvKeys: envKeys,
    hint: 'Add DATABASE_URL to Vercel env vars. Find it in Supabase Dashboard > Project Settings > Database > Connection string (URI)',
    checkError: checkErr?.message
  });
}
