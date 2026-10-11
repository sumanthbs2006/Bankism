import { RefreshCw } from 'lucide-react';

interface SimulationBannerProps {
  onResetData?: () => void;
  resetting?: boolean;
}

export const SimulationBanner: React.FC<SimulationBannerProps> = ({ onResetData, resetting }) => {
  return (
    <div className="bg-[#241505]/60 backdrop-blur-md border-b border-amber-500/20 py-2 text-xs transition-colors">
      <div className="w-full app-screen-container flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 text-amber-300">
          <div className="w-4 h-4 rounded-full bg-amber-400/20 flex items-center justify-center flex-shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          </div>
          <span className="font-semibold tracking-wider text-[11px] uppercase">
            Simulation Environment Active
          </span>
          <span className="text-amber-200/40 hidden md:inline">•</span>
          <span className="text-slate-300/90 hidden md:inline text-[11px]">
            Operating exclusively on isolated mock accounts, counterparties, and ledger. Zero connection to real banking APIs.
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Firewall Guardrail Active
          </span>

          {onResetData && (
            <button
              onClick={onResetData}
              disabled={resetting}
              className="apple-pressable inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.08] hover:bg-white/[0.12] text-slate-200 hover:text-white border border-white/10 text-[11px] font-medium transition-all"
              title="Reset accounts and reload demo dataset"
            >
              <RefreshCw className={`w-3 h-3 ${resetting ? 'animate-spin' : ''}`} />
              {resetting ? 'Resetting...' : 'Reset Data'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
