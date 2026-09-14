import { Cable, Clock3 } from 'lucide-react';
import { useParams } from 'react-router-dom';

const sourceLabels = {
  live: 'Live Enquiry',
  exhibits: 'Exhibits Enquiry',
};

const WebsiteEnquiryComingSoon = () => {
  const { source } = useParams();
  const sourceLabel = sourceLabels[source] || 'Website Enquiry';

  return (
    <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center">
      <section className="w-full max-w-2xl rounded-3xl border border-blue-100 bg-white px-6 py-14 text-center shadow-sm sm:px-12">
        <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-blue-50 text-blue-600">
          <Cable size={38} strokeWidth={1.7} />
        </span>
        <p className="mt-7 text-xs font-bold uppercase tracking-[0.18em] text-blue-600">
          {sourceLabel}
        </p>
        <h1 className="mt-3 text-3xl font-bold text-slate-950">Connectivity Coming Soon</h1>
        <p className="mx-auto mt-4 max-w-lg text-sm leading-6 text-slate-500">
          Website enquiries for this business unit will appear here once the website connection is
          enabled.
        </p>
        <div className="mx-auto mt-7 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700">
          <Clock3 size={16} />
          Integration pending
        </div>
      </section>
    </div>
  );
};

export default WebsiteEnquiryComingSoon;
