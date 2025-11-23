import React from 'react';
import { AnalyticsMetrics } from '../types';

interface DashboardViewProps {
  metrics: AnalyticsMetrics;
}

const MetricCard: React.FC<{ title: string; value: string | number; icon: string; subtext?: string; gradient: string }> = ({ title, value, icon, subtext, gradient }) => (
  <div className="glass-interactive rounded-2xl p-6 relative overflow-hidden group">
    {/* Decorative Glow */}
    <div className={`absolute -top-10 -right-10 w-32 h-32 rounded-full blur-[40px] opacity-30 group-hover:opacity-50 transition-opacity duration-500 ${gradient}`}></div>
    
    <div className="flex items-start justify-between mb-4 relative z-10">
      <div>
        <p className="font-mono text-[10px] font-bold uppercase mb-2 text-white/50 tracking-widest">{title}</p>
        <h3 className="text-4xl font-light text-white tracking-tighter">{value}</h3>
      </div>
      <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center backdrop-blur-md shadow-inner">
        <span className="material-symbols-rounded text-2xl text-white/80">{icon}</span>
      </div>
    </div>
    {subtext && <p className="text-xs font-medium text-white/40 border-t border-white/5 pt-3 mt-2">{subtext}</p>}
  </div>
);

const DashboardView: React.FC<DashboardViewProps> = ({ metrics }) => {
  const lat = metrics.lastQueryLatency;
  const totalLat = lat ? lat.total : 1;
  const sttPct = lat ? (lat.stt / totalLat) * 100 : 0;
  const llmPct = lat ? (lat.llm / totalLat) * 100 : 0;
  const ttsPct = lat ? (lat.tts / totalLat) * 100 : 0;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between pb-6 border-b border-white/10">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white mb-1">Mission Control</h2>
          <p className="text-sm font-light text-white/50">Real-time System Performance</p>
        </div>
        <div className="hidden md:flex gap-2">
            <div className="px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-bold text-[10px] tracking-wider flex items-center gap-2 backdrop-blur-md">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_8px_#34d399]"></span>
                SYSTEM ONLINE
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard 
          title="Total Interactions" 
          value={metrics.totalQueries} 
          icon="forum" 
          gradient="bg-blue-500"
        />
        <MetricCard 
          title="Avg Response Time" 
          value={`${Math.round(metrics.avgResponseTime)}ms`} 
          icon="timer" 
          subtext="TARGET: < 800ms"
          gradient="bg-purple-500"
        />
        <MetricCard 
          title="Backend Operations" 
          value={metrics.backendCalls} 
          icon="database" 
          subtext="FUNCTION CALLS EXECUTED"
          gradient="bg-pink-500"
        />
      </div>

      <div className="glass-panel rounded-3xl p-8 relative overflow-hidden">
        {/* Decorative background */}
        <div className="absolute -bottom-40 -right-20 w-80 h-80 bg-blue-600/10 rounded-full blur-[80px]"></div>

        <h3 className="text-lg font-medium mb-8 flex items-center gap-3 relative z-10">
            <span className="bg-white/5 p-2 rounded-lg border border-white/10"><span className="material-symbols-rounded">speed</span></span>
            <span>Latency Breakdown</span>
            <span className="text-[10px] font-mono text-white/30 ml-auto border border-white/5 px-2 py-1 rounded bg-black/10">LAST REQUEST</span>
        </h3>
        
        {metrics.lastQueryLatency ? (
            <div className="space-y-8 relative z-10">
                {/* Visual Bar */}
                <div className="h-14 w-full rounded-2xl flex overflow-hidden shadow-2xl border border-white/5 bg-black/40">
                    <div style={{ width: `${sttPct}%` }} className="h-full bg-blue-500/80 backdrop-blur-sm border-r border-white/10 relative group flex items-center justify-center transition-all duration-700 hover:bg-blue-500/90">
                        <span className="font-mono font-bold text-white text-[10px] drop-shadow-md">STT</span>
                    </div>
                    <div style={{ width: `${llmPct}%` }} className="h-full bg-purple-500/80 backdrop-blur-sm border-r border-white/10 relative group flex items-center justify-center transition-all duration-700 hover:bg-purple-500/90">
                        <span className="font-mono font-bold text-white text-[10px] drop-shadow-md">LLM</span>
                    </div>
                    <div style={{ width: `${ttsPct}%` }} className="h-full bg-pink-500/80 backdrop-blur-sm relative group flex items-center justify-center transition-all duration-700 hover:bg-pink-500/90">
                        <span className="font-mono font-bold text-white text-[10px] drop-shadow-md">TTS</span>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="glass-interactive rounded-xl p-4">
                        <div className="text-[10px] font-mono font-bold uppercase mb-1 text-blue-300">Transcription</div>
                        <div className="text-2xl font-light text-white">{Math.round(lat!.stt)}<span className="text-sm font-normal text-white/30 ml-1">ms</span></div>
                    </div>
                    <div className="glass-interactive rounded-xl p-4">
                        <div className="text-[10px] font-mono font-bold uppercase mb-1 text-purple-300">Processing</div>
                        <div className="text-2xl font-light text-white">{Math.round(lat!.llm)}<span className="text-sm font-normal text-white/30 ml-1">ms</span></div>
                    </div>
                    <div className="glass-interactive rounded-xl p-4">
                        <div className="text-[10px] font-mono font-bold uppercase mb-1 text-pink-300">Synthesis</div>
                        <div className="text-2xl font-light text-white">{Math.round(lat!.tts)}<span className="text-sm font-normal text-white/30 ml-1">ms</span></div>
                    </div>
                </div>
            </div>
        ) : (
            <div className="text-center py-16 border border-dashed border-white/10 rounded-2xl bg-white/5">
                <span className="material-symbols-rounded text-4xl text-white/20 mb-3">bar_chart_off</span>
                <p className="font-bold text-white/40">NO DATA AVAILABLE</p>
                <p className="text-sm text-white/20 mt-1">Start a conversation to view metrics</p>
            </div>
        )}
      </div>
    </div>
  );
};

export default DashboardView;