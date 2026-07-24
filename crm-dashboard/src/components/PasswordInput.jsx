import { useState } from 'react';

const PasswordInput = ({ className = '', ...props }) => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="relative">
      <input {...props} type={isVisible ? 'text' : 'password'} className={`${className} pr-11`} />
      <button
        type="button"
        onClick={() => setIsVisible((visible) => !visible)}
        className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
        aria-label={isVisible ? 'Hide password' : 'Show password'}
        title={isVisible ? 'Hide password' : 'Show password'}
      >
        {isVisible ? (
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4 fill-none stroke-current"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 3l18 18" />
            <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
            <path d="M9.9 4.2A10.4 10.4 0 0 1 12 4c5 0 9.3 3.1 11 8a12 12 0 0 1-3 4.7" />
            <path d="M6.6 6.6A12 12 0 0 0 1 12c1.7 4.9 6 8 11 8 1.6 0 3.1-.3 4.5-.9" />
          </svg>
        ) : (
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4 fill-none stroke-current"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12Z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  );
};

export default PasswordInput;
