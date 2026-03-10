import { Router } from 'express';
import nodemailer from 'nodemailer';

const router = Router();

router.post('/', async (req, res) => {
  const { name, email, subject, message } = req.body;
  if (!name || !email || !message) {
    res.status(400).json({ error: 'Name, email and message are required' });
    return;
  }

  const DEST_EMAIL = process.env.CONTACT_EMAIL || 'info@criminalcrisis.com';
  const SMTP_HOST = process.env.SMTP_HOST;
  const SMTP_USER = process.env.SMTP_USER;
  const SMTP_PASS = process.env.SMTP_PASS;

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    // Log to console if no SMTP configured
    console.log(`[CONTACT] From: ${name} <${email}>, Subject: ${subject}, Message: ${message}`);
    res.json({ ok: true, note: 'Message logged (no SMTP configured)' });
    return;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: 587,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
    await transporter.sendMail({
      from: `"${name}" <${SMTP_USER}>`,
      to: DEST_EMAIL,
      replyTo: email,
      subject: subject || `Contact from ${name}`,
      text: message,
    });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to send email' });
  }
});

export default router;
