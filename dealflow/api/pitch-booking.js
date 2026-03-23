// Vercel Serverless Function: Pitch Booking
// When a GP selects their Thursday presentation date after paying:
// 1. Emails Pascal with booking details + Google Calendar link
// 2. Emails the GP with confirmation + prep checklist
// 3. Adds a GHL note on the contact

import { getAdminClient, setCors, rateLimit, ghlFetch } from './_supabase.js';

const PASCAL_EMAIL = 'pascal@growyourcashflow.com';

// Build a Google Calendar "Add Event" URL
function buildGCalLink({ title, startISO, durationMinutes, description, location }) {
  const start = startISO.replace(/[-:]/g, '').split('.')[0] + 'Z';
  const endDate = new Date(new Date(startISO).getTime() + durationMinutes * 60000);
  const end = endDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${start}/${end}`,
    details: description || '',
    location: location || '',
    ctz: 'America/New_York'
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

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
    const resendKey = process.env.RESEND_API_KEY;
    const dateObj = new Date(selectedDate);
    const dateStr = dateObj.toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
    const firstName = name.split(' ')[0];

    // Set presentation to 1:00 PM ET on the selected Thursday
    const presDate = new Date(dateObj);
    presDate.setUTCHours(17, 0, 0, 0); // 1 PM ET = 17:00 UTC

    const gcalLink = buildGCalLink({
      title: `GP Pitch: ${name}`,
      startISO: presDate.toISOString(),
      durationMinutes: 90,
      description: `Operator: ${name}\nEmail: ${email}\n\n90-minute session:\n- 45 min presentation\n- 45 min Q&A\n\nPrep call to be scheduled separately.`,
      location: 'Zoom (link TBD)'
    });

    if (resendKey) {
      // 1. Email Pascal — booking notification + calendar link
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
            <table style="border-collapse:collapse;margin:16px 0;">
              <tr><td style="padding:6px 12px 6px 0;font-weight:bold;color:#1F5159;">Operator</td><td style="padding:6px 0;">${name}</td></tr>
              <tr><td style="padding:6px 12px 6px 0;font-weight:bold;color:#1F5159;">Email</td><td style="padding:6px 0;"><a href="mailto:${email}">${email}</a></td></tr>
              <tr><td style="padding:6px 12px 6px 0;font-weight:bold;color:#1F5159;">Date</td><td style="padding:6px 0;">${dateStr} at 1:00 PM ET</td></tr>
              <tr><td style="padding:6px 12px 6px 0;font-weight:bold;color:#1F5159;">Payment</td><td style="padding:6px 0;">$1,000 received</td></tr>
            </table>
            <p><a href="${gcalLink}" style="display:inline-block;background:#51BE7B;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;">Add to Google Calendar</a></p>
            <hr style="border:none;border-top:1px solid #EDF1F2;margin:24px 0;">
            <h3 style="color:#1F5159;">Your To-Do</h3>
            <ol style="color:#607179;line-height:1.8;">
              <li><strong>Reply to ${firstName}</strong> — confirm the date and introduce yourself</li>
              <li><strong>Schedule prep call</strong> — 15 min to review their deck (1–2 weeks before the presentation)</li>
              <li><strong>Send Zoom link</strong> — create the meeting and add it to the calendar invite</li>
              <li><strong>Send investor invitations</strong> — market the event to matched LPs 1 week before</li>
            </ol>
          `
        })
      });

      // 2. Email the GP — confirmation + what to expect
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'Pascal Wagner <deals@growyourcashflow.io>',
          to: [email],
          cc: [PASCAL_EMAIL],
          subject: `You're booked! Pitch slot confirmed for ${dateStr}`,
          html: `
            <div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;color:#141413;">
              <div style="background:linear-gradient(135deg,#0A1E21,#1F5159);padding:32px;border-radius:12px 12px 0 0;text-align:center;">
                <h1 style="color:#fff;font-size:24px;margin:0 0 8px;">Your Pitch Slot is Confirmed!</h1>
                <p style="color:rgba(255,255,255,0.6);margin:0;font-size:15px;">${dateStr} at 1:00 PM ET</p>
              </div>
              <div style="background:#fff;padding:32px;border:1px solid #EDF1F2;border-top:none;border-radius:0 0 12px 12px;">
                <p>Hey ${firstName},</p>
                <p>Thanks for booking your pitch slot — I'm looking forward to helping you get in front of our investor network.</p>

                <div style="background:#E7F5F0;border:1px solid #51BE7B;border-radius:8px;padding:20px;margin:24px 0;">
                  <h3 style="color:#1F5159;margin:0 0 12px;font-size:16px;">What Happens Next</h3>
                  <ol style="margin:0;padding-left:20px;color:#607179;line-height:2;">
                    <li><strong>I'll reach out within 24 hours</strong> to confirm your date and schedule our 15-minute prep call</li>
                    <li><strong>Prep call (15 min)</strong> — we'll review your deck together and I'll share what resonates most with our investors</li>
                    <li><strong>Investor invitations go out</strong> 1 week before your presentation to every LP whose buy box matches your deal</li>
                    <li><strong>You go live</strong> — 45-minute presentation + 45-minute Q&A. I handle hosting, intros, and moderation</li>
                    <li><strong>Post-event report within 48 hours</strong> — who attended, engagement data, and warm intros to interested LPs</li>
                  </ol>
                </div>

                <h3 style="color:#1F5159;font-size:16px;">Start Preparing</h3>
                <ul style="color:#607179;line-height:2;padding-left:20px;">
                  <li><strong>Finalize your deck</strong> — 30-40 slides covering your deal thesis, financials, team, and track record</li>
                  <li><strong>Update your deal page</strong> on the platform — investors will check it before and after</li>
                  <li><strong>Block 90 minutes</strong> — 1:00–2:30 PM ET on ${dateStr}</li>
                  <li><strong>Know your numbers</strong> — returns, fees, minimums, and track record. This is where trust gets built</li>
                </ul>

                <p style="margin-top:24px;">If you have any questions before then, just reply to this email.</p>
                <p>— Pascal</p>
              </div>
            </div>
          `
        })
      });
    }

    // 3. Add a note in GHL
    try {
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
              body: `Pitch slot booked for ${dateStr} at 1:00 PM ET. Payment received ($1,000). Next: schedule prep call.`
            })
          });
        }
      }
    } catch (e) {
      // Non-blocking
    }

    return res.status(200).json({ success: true, gcalLink });
  } catch (err) {
    console.error('pitch-booking error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
