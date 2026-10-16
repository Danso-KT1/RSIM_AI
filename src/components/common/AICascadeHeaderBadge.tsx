import React, { useState, useEffect } from 'react';
import { Zap, Sparkles, Clock, Shield } from 'lucide-react';
import { aiService } from '../../services/aiService';

interface AICascadeHeaderBadgeProps {
  onOpenMatrix: () => void;
}

export const AICascadeHeaderBadge: React.FC<AICascadeHeaderBadgeProps> = ({ onOpenMatrix }) => {
  const [activeEngineName, setActiveEngineName] = useState('Gemini 3.8');
  const [isCoolingDown, setIsCoolingDown] = useState(false);
  const [cooldownSec, setCooldownSec] = useState(0);

  useEffect(() => {
    let mounted = true;

    const check = async () => {
      const data = await aiService.getCascadeStatus();
      if (!mounted || !data) return;

      const cooling = data.providers?.find((p: any) => p.state === 'rate_limited');
      if (cooling) {
        setIsCoolingDown(true);
        setCooldownSec(cooling.rateLimitSecondsRemaining || 30);
        const nextActive = data.providers?.find((p: any) => p.state === 'operational' && p.isConfigured);
        setActiveEngineName(nextActive ? nextActive.displayName.split(' ')[0] : 'Groq');
      } else {
        setIsCoolingDown(false);
        const primary = data.providers?.[0];
        setActiveEngineName(primary ? (primary.displayName.includes('GPT') ? 'GPT-OSS 120B' : primary.displayName.split(' ')[0]) : 'GPT-OSS');
      }
    };

    check();
    const interval = setInterval(check, 5000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <button
      type="button"
      onClick={onOpenMatrix}
      className={`hidden sm:flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-bold transition-all shadow-2xs border ${
        isCoolingDown
          ? 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100'
          : 'bg-indigo-50/80 border-indigo-200 text-indigo-950 hover:bg-indigo-100/80 hover:border-indigo-300'
      }`}
      title="Click to view Four-Engine AI Cascade, Latency Telemetry, and Circuit Breakers"
    >
      <div className="flex items-center gap-1.5">
        {isCoolingDown ? (
          <Clock className="h-3.5 w-3.5 text-amber-600 animate-spin" />
        ) : (
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
        )}
        <Zap className="h-3.5 w-3.5 text-indigo-600" />
      </div>

      <div className="flex items-center gap-1">
        <span className="font-extrabold">4 AI Engines</span>
        <span className="text-[10px] opacity-60">•</span>
        <span className="text-[11px] font-medium text-slate-600">
          {isCoolingDown ? `${activeEngineName} Active (${cooldownSec}s)` : 'GPT #1 Active'}
        </span>
      </div>
    </button>
  );
};
