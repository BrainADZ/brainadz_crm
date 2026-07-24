import { ArrowLeft, ShieldX } from 'lucide-react';
import { Link } from 'react-router-dom';

const Forbidden = () => (
  <div className="flex min-h-[60vh] items-center justify-center">
    <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600">
        <ShieldX size={27} />
      </span>
      <h1 className="mt-5 text-xl font-semibold text-slate-950">403 · Access denied</h1>
      <p className="mt-2 text-sm leading-6 text-slate-500">
        Your current role or assignment does not include permission to view this module.
      </p>
      <Link
        to="/dashboard"
        className="mt-6 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white"
      >
        <ArrowLeft size={16} />
        Back to dashboard
      </Link>
    </div>
  </div>
);

export default Forbidden;
