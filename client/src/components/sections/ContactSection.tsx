import { useState } from 'react';
import { motion } from 'framer-motion';
import { Send, Instagram, Music } from 'lucide-react';
import { api } from '../../api';

export default function ContactSection() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('sending');
    try {
      await api.sendContact(form);
      setStatus('sent');
      setForm({ name: '', email: '', subject: '', message: '' });
    } catch {
      setStatus('error');
    }
  };

  return (
    <section id="contact" className="py-24 px-6 bg-[#F5F5F5]">
      <div className="max-w-screen-xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-12"
        >
          <p className="text-xs font-semibold tracking-[0.3em] uppercase text-[#C0BABC] mb-3">Get in Touch</p>
          <h2 className="text-4xl md:text-5xl font-black text-[#111]">Contact</h2>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-16">
          {/* Form */}
          <motion.form
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            onSubmit={handleSubmit}
            className="space-y-5"
          >
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold tracking-wide uppercase text-[#888] mb-2">
                  Name
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  className="w-full bg-white border border-[#E0E0E0] px-4 py-3 text-sm text-[#111] focus:outline-none focus:border-[#111] transition-colors"
                  placeholder="Your name"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold tracking-wide uppercase text-[#888] mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                  className="w-full bg-white border border-[#E0E0E0] px-4 py-3 text-sm text-[#111] focus:outline-none focus:border-[#111] transition-colors"
                  placeholder="your@email.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold tracking-wide uppercase text-[#888] mb-2">
                Subject
              </label>
              <input
                type="text"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                className="w-full bg-white border border-[#E0E0E0] px-4 py-3 text-sm text-[#111] focus:outline-none focus:border-[#111] transition-colors"
                placeholder="Demos, bookings, collabs..."
              />
            </div>

            <div>
              <label className="block text-xs font-semibold tracking-wide uppercase text-[#888] mb-2">
                Message
              </label>
              <textarea
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                required
                rows={5}
                className="w-full bg-white border border-[#E0E0E0] px-4 py-3 text-sm text-[#111] focus:outline-none focus:border-[#111] transition-colors resize-none"
                placeholder="What's on your mind?"
              />
            </div>

            <button
              type="submit"
              disabled={status === 'sending'}
              className="flex items-center gap-2 bg-[#111] text-[#FAFAFA] px-8 py-3 text-sm font-semibold tracking-wide hover:bg-[#333] transition-colors disabled:opacity-50 cursor-pointer"
            >
              {status === 'sending' ? 'Sending...' : 'Send Message'}
              <Send size={14} />
            </button>

            {status === 'sent' && (
              <p className="text-sm text-green-600 font-medium">Message sent! We'll get back to you soon.</p>
            )}
            {status === 'error' && (
              <p className="text-sm text-red-500 font-medium">Something went wrong. Try again.</p>
            )}
          </motion.form>

          {/* Info */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="space-y-8"
          >
            <div>
              <p className="text-xs font-semibold tracking-widest uppercase text-[#888] mb-3">Location</p>
              <p className="text-lg font-semibold text-[#111]">Madrid, Spain</p>
            </div>

            <div>
              <p className="text-xs font-semibold tracking-widest uppercase text-[#888] mb-4">Follow Us</p>
              <div className="space-y-3">
                <a
                  href="https://www.instagram.com/criminalcrisis/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 text-sm text-[#555] hover:text-[#111] transition-colors group"
                >
                  <Instagram size={18} className="text-[#C0BABC] group-hover:text-[#111] transition-colors" />
                  @criminalcrisis
                </a>
                <a
                  href="https://soundcloud.com/criminal_crisis"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 text-sm text-[#555] hover:text-[#111] transition-colors group"
                >
                  <Music size={18} className="text-[#C0BABC] group-hover:text-[#111] transition-colors" />
                  SoundCloud
                </a>
                <a
                  href="https://www.beatport.com/es/label/criminal-crisis/115183"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 text-sm text-[#555] hover:text-[#111] transition-colors group"
                >
                  <span className="text-[#C0BABC] group-hover:text-[#111] transition-colors font-bold text-xs">BP</span>
                  Beatport
                </a>
                <a
                  href="https://criminalcrisis.bandcamp.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 text-sm text-[#555] hover:text-[#111] transition-colors group"
                >
                  <span className="text-[#C0BABC] group-hover:text-[#111] transition-colors font-bold text-xs">BC</span>
                  Bandcamp
                </a>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold tracking-widest uppercase text-[#888] mb-3">Bookings & Demos</p>
              <p className="text-sm text-[#555] leading-relaxed">
                For bookings, demo submissions, or general enquiries, use the form, reach us directly at <a href="mailto:info@criminalcrisis.com" className="text-[#111] hover:underline font-medium">info@criminalcrisis.com</a>, or via our social channels.
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
