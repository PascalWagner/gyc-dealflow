// Vercel Serverless Function: Pitch Booking
// When a GP selects their Thursday presentation date after paying,
// emails Pascal with the details and adds a GHL note.

import { getAdminClient, setCors, rateLimit, ghlFetch } from './_supabase.js';

const PASCAL_EMAIL = 'pascal@growyourcashflow.com';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!rateLimit(req, res, { maxRequests: 5, windowMs: 60_000 })) return;

  const { name, email, selectedDate } = req.body || {};
  if (!name || !email || !selectedDate) {
    return res.status(400).json({ error: 'name, email, and selectedDate are required' });
  }

  try {
    // 1. Email Pascal via Resend
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      const dateObj = new Date(selectedDate);
      const dateStr = dateObj.toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      });

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'Grow Your Cashflow <deals@growyourcashflow.io>',
          to: [PASCAL_EMAIL],
          subject: `Pitch Slot Booked: ${name} — ${dateStr}`,
          html: `
            <h2>New Pitch Booking</h2>
            <p><strong>Operator:</strong> ${name}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Selected Date:</strong> ${dateStr} at 1:00 PM ET</p>
            <hr>
            <p>Next steps:</p>
            <ul>
              <li>Confirm the date with ${name.split(' ')[0]}</li>
              <li>Schedule their 15-minute prep call</li>
              <li>Send calendar invite for the Thursday session</li>
            </ul>
          `
        })
      });
    }

    // 2. Try to add a note in GHL
    try {
      // Search for the contact by email
      const searchResp = await ghlFetch(
        `https://rest.gohighlevel.com/v1/contacts/lookup?email=${encodeURIComponent(email)}`
      );
      if (searchResp && searchResp.ok) {
        const searchData = await searchResp.json();
        const contactId = searchData.contacts?.[0]?.id;
        if (contactId) {
          await ghlFetch(`https://rest.gohighlevel.com/v1/contacts/${contactId}/notes/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              body: `Pitch slot booked for ${new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} at 1:00 PM ET. Payment received ($1,000). Next: schedule prep call.`
            })
          });
        }
      }
    } catch (e) {
      // Non-blocking
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('pitch-booking error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
