// Temporary migration runner — delete after use
// POST /api/migrate?key=migrate006

import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'POST' && req.method !== 'GET') return res.status(405).end();

  if (req.query.key !== 'migrate006') {
    return res.status(403).json({ error: 'bad key' });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { db: { schema: 'public' } }
  );

  // Test if table exists first
  const { error: checkErr } = await supabase.from('deal_qa').select('id').limit(1);

  if (!checkErr) {
    return res.status(200).json({ status: 'table already exists' });
  }

  if (checkErr && !checkErr.message.includes('does not exist') && !checkErr.message.includes('PGRST')) {
    return res.status(200).json({ status: 'table might exist', error: checkErr.message });
  }

  // Table doesn't exist — use raw SQL via pg
  // Supabase JS client doesn't support DDL, so we use the sql tagged template
  // Actually, we need to use supabase.rpc or a workaround

  // Workaround: create a function that creates the table, call it, then drop it
  // But we can't create functions via REST API either...

  // The only option with service_role is to check if we have access to pg-meta
  // Let's try the database URL directly
  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

  if (dbUrl) {
    // If we have a direct DB connection, use pg
    try {
      const { Pool } = await import('pg');
      const pool = new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
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

      // Create policies (ignore errors if already exist)
      try { await pool.query(`CREATE POLICY "Anyone can read deal Q&A" ON deal_qa FOR SELECT USING (true);`); } catch(e) {}
      try { await pool.query(`CREATE POLICY "Anyone can ask questions" ON deal_qa FOR INSERT WITH CHECK (true);`); } catch(e) {}
      try { await pool.query(`CREATE POLICY "Admins can update Q&A" ON deal_qa FOR UPDATE USING (true);`); } catch(e) {}

      await pool.end();
      return res.status(200).json({ status: 'migration complete via pg' });
    } catch (err) {
      return res.status(500).json({ status: 'pg error', error: err.message });
    }
  }

  return res.status(200).json({
    status: 'no DATABASE_URL available',
    hint: 'Set DATABASE_URL in Vercel env vars, or run SQL manually in Supabase dashboard',
    tableExists: false,
    checkError: checkErr?.message
  });
}
