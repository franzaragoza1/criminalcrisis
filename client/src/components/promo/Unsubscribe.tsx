import { useSearchParams } from 'react-router-dom';

/**
 * Confirmation page. The unsubscribe itself already happened server-side — the
 * API endpoint records it and then redirects here — so this page never needs to
 * make a request. That matters: Gmail's one-click unsubscribe POSTs directly to
 * the API and never loads this page at all.
 */
export default function Unsubscribe() {
  const [params] = useSearchParams();
  const email = params.get('e');

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-[#FAFAFA]">
      <div className="max-w-md text-center">
        <p className="text-[10px] font-semibold tracking-[0.3em] uppercase text-[#C0BABC] mb-4">
          Criminal Crisis
        </p>
        <h1 className="text-3xl md:text-4xl text-[#111] mb-5">You're unsubscribed</h1>
        <p className="text-sm text-[#666] leading-relaxed">
          {email ? (
            <>
              <span className="text-[#111]">{email}</span> won't receive any more promos from us.
            </>
          ) : (
            <>You won't receive any more promos from us.</>
          )}{' '}
          No hard feelings — thanks for listening while you did.
        </p>

        <div className="mt-10 pt-6 border-t border-[#E0E0E0]">
          <p className="text-[11px] text-[#999] mb-4">Removed by mistake?</p>
          <a
            href="mailto:info@criminalcrisis.com"
            className="inline-block border-b border-[#111] pb-0.5 text-xs font-semibold tracking-[0.2em] uppercase text-[#111] hover:text-[#C8302B] hover:border-[#C8302B] transition-colors"
          >
            info@criminalcrisis.com
          </a>
        </div>

        <a
          href="/"
          className="inline-block mt-12 text-[10px] font-semibold tracking-[0.25em] uppercase text-[#999] hover:text-[#111] transition-colors"
        >
          ← criminalcrisis.com
        </a>
      </div>
    </div>
  );
}
