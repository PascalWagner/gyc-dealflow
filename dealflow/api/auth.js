// Vercel Serverless Function: Authentication
// Handles password-based login with GHL contact lookup

const GHL_API_KEY = process.env.GHL_API_KEY;
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID;

// Simple password hash (SHA-256 via Web Crypto)
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'gyc-salt-2026');
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action, email, password, firstName, lastName } = req.body || {};

  if (action === 'login') {
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Try to look up the contact in GHL
    try {
      if (GHL_API_KEY && GHL_LOCATION_ID) {
        const searchUrl = `https://rest.gohighlevel.com/v1/contacts/lookup?email=${encodeURIComponent(email)}`;
        const ghlResp = await fetch(searchUrl, {
          headers: {
            'Authorization': `Bearer ${GHL_API_KEY}`
          }
        });

        if (ghlResp.ok) {
          const ghlData = await ghlResp.json();
          const contacts = ghlData.contacts || [];
          const contact = contacts.find(c =>
            c.email?.toLowerCase() === email.toLowerCase()
          );

          if (contact) {
            // Check stored password hash in custom field or notes
            const storedHash = contact.customFields?.find(f => f.key === 'dealflow_password_hash')?.value;
            const inputHash = await hashPassword(password);

            if (storedHash && storedHash === inputHash) {
              return res.status(200).json({
                success: true,
                email: contact.email,
                name: [contact.firstName, contact.lastName].filter(Boolean).join(' ') || email.split('@')[0],
                contactId: contact.id,
                tier: contact.tags?.includes('academy-member') ? 'academy' :
                      contact.tags?.includes('investor-member') ? 'investor' : 'explorer',
                token: Date.now().toString(36) + Math.random().toString(36).slice(2)
              });
            }

            // No stored hash yet — if password matches a simple check, accept and store hash
            // For initial migration: accept any password for existing contacts, store the hash
            if (!storedHash) {
              const newHash = await hashPassword(password);
              // Store hash in GHL (best effort)
              try {
                await fetch(`https://rest.gohighlevel.com/v1/contacts/${contact.id}`, {
                  method: 'PUT',
                  headers: {
                    'Authorization': `Bearer ${GHL_API_KEY}`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    customField: { 'dealflow_password_hash': newHash }
                  })
                });
              } catch (e) { /* best effort */ }

              return res.status(200).json({
                success: true,
                email: contact.email,
                name: [contact.firstName, contact.lastName].filter(Boolean).join(' ') || email.split('@')[0],
                contactId: contact.id,
                tier: contact.tags?.includes('academy-member') ? 'academy' :
                      contact.tags?.includes('investor-member') ? 'investor' : 'explorer',
                token: Date.now().toString(36) + Math.random().toString(36).slice(2),
                passwordSet: true
              });
            }

            return res.status(401).json({ success: false, error: 'Invalid password' });
          }

          return res.status(401).json({ success: false, error: 'No account found with this email. Request access first.' });
        }
      }
    } catch (e) {
      console.error('GHL lookup error:', e);
    }

    // Fallback: If GHL is not configured, allow login for known admin emails
    const ADMIN_EMAILS = ['pascal@growyourcashflow.com', 'pascalwagner@gmail.com', 'pascal.wagner@growyourcashflow.com', 'info@pascalwagner.com'];
    if (ADMIN_EMAILS.includes(email.toLowerCase())) {
      return res.status(200).json({
        success: true,
        email: email,
        name: 'Pascal Wagner',
        tier: 'academy',
        token: Date.now().toString(36) + Math.random().toString(36).slice(2)
      });
    }

    return res.status(401).json({ success: false, error: 'Unable to verify credentials. Try requesting a magic link.' });
  }

  if (action === 'register') {
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const passwordHash = await hashPassword(password);

    try {
      if (GHL_API_KEY && GHL_LOCATION_ID) {
        const createResp = await fetch('https://rest.gohighlevel.com/v1/contacts/', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${GHL_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            firstName,
            lastName,
            email,
            tags: ['dealflow-user'],
            customField: { 'dealflow_password_hash': passwordHash }
          })
        });

        if (createResp.ok) {
          const data = await createResp.json();
          return res.status(200).json({
            success: true,
            email,
            name: `${firstName} ${lastName}`,
            contactId: data.contact?.id,
            tier: 'explorer',
            token: Date.now().toString(36) + Math.random().toString(36).slice(2)
          });
        }

        const errData = await createResp.json().catch(() => ({}));
        if (errData.message?.includes('duplicate') || errData.message?.includes('already exists')) {
          return res.status(409).json({ success: false, error: 'An account with this email already exists. Try signing in.' });
        }
      }
    } catch (e) {
      console.error('GHL create error:', e);
    }

    return res.status(500).json({ success: false, error: 'Unable to create account. Please try again.' });
  }

  return res.status(400).json({ error: 'Invalid action' });
}
