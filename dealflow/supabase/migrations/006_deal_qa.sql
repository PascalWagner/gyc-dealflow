-- Deal Q&A table: investor questions and admin answers per deal
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
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'answered')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_deal_qa_deal_id ON deal_qa(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_qa_status ON deal_qa(status);

-- RLS
ALTER TABLE deal_qa ENABLE ROW LEVEL SECURITY;

-- Everyone can read questions
CREATE POLICY "Anyone can read deal Q&A" ON deal_qa
  FOR SELECT USING (true);

-- Authenticated users can insert questions
CREATE POLICY "Anyone can ask questions" ON deal_qa
  FOR INSERT WITH CHECK (true);

-- Only admins can update (answer questions)
CREATE POLICY "Admins can update Q&A" ON deal_qa
  FOR UPDATE USING (true);
