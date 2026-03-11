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

  const inputClass = "w-full bg-transparent border-0 border-b border-[#CCCCCC] py-3 text-sm text-[#111] focus:outline-none focus:border-[#111] transition-colors placeholder:text-[#C0BABC]";
  const labelClass = "block text-[10px] font-semibold tracking-[0.2em] uppercase text-[#888] mb-1";

  return (
    <section id="contact" className="py-24 px-6 bg-[#FAFAFA] border-t-4 border-[#111]">
      <div className="max-w-xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <p className="text-xs font-semibold tracking-[0.3em] uppercase text-[#C0BABC] mb-3">Get in Touch</p>
          <h2 className="text-4xl md:text-5xl font-black text-[#111]">Contact</h2>
        </div>

        {/* Intro info block */}
        <div className="mb-10 flex flex-wrap gap-6 text-sm text-[#555]">
          <span>Madrid, Spain</span>
          <a href="mailto:info@criminalcrisis.com" className="text-[#111] hover:text-[#C8302B] transition-colors font-semibold">
            info@criminalcrisis.com
          </a>
          <div className="flex items-center gap-4">
            <a href="https://www.instagram.com/criminalcrisis/" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-[#C8302B] transition-colors">
              <Instagram size={14} /> Instagram
            </a>
            <a href="https://soundcloud.com/criminal_crisis" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-[#C8302B] transition-colors">
              <Music size={14} /> SoundCloud
            </a>
          </div>
        </div>

        {/* Form */}
        <motion.form
          onSubmit={handleSubmit}
          className="space-y-8"
        >
          <div className="grid sm:grid-cols-2 gap-6">
            <div>
              <label className={labelClass}>Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                className={inputClass}
                placeholder="Your name"
              />
            </div>
            <div>
              <label className={labelClass}>Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
                className={inputClass}
                placeholder="your@email.com"
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Subject</label>
            <input
              type="text"
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              className={inputClass}
              placeholder="Demos, bookings, collabs..."
            />
          </div>

          <div>
            <label className={labelClass}>Message</label>
            <textarea
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              required
              rows={5}
              className={`${inputClass} resize-none`}
              placeholder="What's on your mind?"
            />
          </div>

          <button
            type="submit"
            disabled={status === 'sending'}
            className="flex items-center gap-2 bg-[#111] text-[#FAFAFA] px-10 py-4 text-xs font-semibold tracking-[0.2em] uppercase hover:bg-[#C8302B] transition-colors disabled:opacity-50 cursor-pointer"
          >
            {status === 'sending' ? 'Sending...' : 'Send Message'}
            <Send size={13} />
          </button>

          {status === 'sent' && (
            <p className="text-sm text-green-600 font-medium">Message sent! We'll get back to you soon.</p>
          )}
          {status === 'error' && (
            <p className="text-sm text-red-500 font-medium">Something went wrong. Try again.</p>
          )}
        </motion.form>
      </div>
    </section>
  );
}
