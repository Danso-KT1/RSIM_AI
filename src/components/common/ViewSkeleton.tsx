import React from 'react';
import { Sparkles } from 'lucide-react';

/**
 * Generic skeleton shimmer used as a Suspense fallback while lazy chunks load.
 */
export const ViewSkeleton: React.FC<{ label?: string }> = ({ label }) => (
  <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-4 select-none">
    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/20 animate-pulse">
      <Sparkles className="h-7 w-7 text-white" />
    </div>
    {label && (
      <p className="text-sm font-medium text-slate-400 animate-pulse">{label}</p>
    )}
    <div className="flex flex-col gap-3 w-full max-w-lg px-4">
      {[0.9, 0.7, 0.85, 0.5].map((w, i) => (
        <div
          key={i}
          className="h-3.5 rounded-full bg-slate-200 animate-pulse"
          style={{ width: `${w * 100}%`, animationDelay: `${i * 60}ms` }}
        />
      ))}
    </div>
  </div>
);
