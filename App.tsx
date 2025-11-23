import React, { useState } from 'react';
import { AppMode, AnalyticsMetrics } from './types';
import VoiceBotView from './components/VoiceBotView';
import DashboardView from './components/DashboardView';
import TranscribeView from './components/TranscribeView';
import TTSView from './components/TTSView';

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>(AppMode.VOICE_BOT);
  const [metrics, setMetrics] = useState<AnalyticsMetrics>({
    totalQueries: 0,
    avgResponseTime: 0,
    backendCalls: 0,
    lastQueryLatency: null
  });

  const updateMetrics = (newMetrics: Partial<AnalyticsMetrics>) => {
    setMetrics(prev => {
      const totalQueries = (prev.totalQueries || 0) + (newMetrics.totalQueries || 0);
      
      // Recalculate running average if response time is provided
      let avgResponseTime = prev.avgResponseTime;
      if (newMetrics.avgResponseTime && newMetrics.totalQueries) {
          avgResponseTime = ((prev.avgResponseTime * prev.totalQueries) + newMetrics.avgResponseTime) / totalQueries;
      }

      return {
        totalQueries,
        avgResponseTime,
        backendCalls: prev.backendCalls + (newMetrics.backendCalls || 0),
        lastQueryLatency: newMetrics.lastQueryLatency || prev.lastQueryLatency
      };
    });
  };

  const navButtonClass = (isActive: boolean) => `
    px-5 py-2 text-sm font-bold rounded-full transition-all duration-300 flex items-center gap-2 border
    ${isActive 
      ? 'bg-white/10 text-white border-white/20 shadow-[0_0_15px_rgba(255,255,255,0.1)] backdrop-blur-md' 
      : 'border-transparent text-white/50 hover:text-white hover:bg-white/5'}
  `;

  return (
    <div className="min-h-screen font-sans flex flex-col text-white">
      {/* Navbar - Floating Glass */}
      <nav className="fixed top-0 w-full z-50 px-4 py-6">
        <div className="max-w-5xl mx-auto glass rounded-full px-8 py-3 flex items-center justify-between">
          
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-900/20">
              <span className="material-symbols-rounded text-2xl text-white">smart_toy</span>
            </div>
            <div className="flex flex-col leading-none justify-center">
              <span className="text-lg font-bold tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-cyan-100 to-white">Voice AI</span>
            </div>
          </div>
          
          <div className="hidden md:flex items-center gap-1 bg-black/20 rounded-full p-1 border border-white/5">
              <button onClick={() => setMode(AppMode.VOICE_BOT)} className={navButtonClass(mode === AppMode.VOICE_BOT)}>
                 <span className="material-symbols-rounded text-lg">graphic_eq</span>
                 Voice Agent
              </button>
              <button onClick={() => setMode(AppMode.DASHBOARD)} className={navButtonClass(mode === AppMode.DASHBOARD)}>
                 <span className="material-symbols-rounded text-lg">analytics</span>
                 Analytics
              </button>
          </div>

          <div className="flex items-center">
               <button
                onClick={() => setMode(AppMode.TOOLS)}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 border
                  ${mode === AppMode.TOOLS
                  ? 'bg-pink-500/20 text-pink-200 border-pink-500/30 shadow-[0_0_15px_rgba(236,72,153,0.3)]' 
                  : 'bg-white/5 text-white/40 border-white/5 hover:bg-white/10 hover:text-white'}
                `}
                title="Developer Tools"
              >
                 <span className="material-symbols-rounded text-lg">build</span>
              </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-12">
        <div className="transition-all duration-500 ease-in-out h-full">
          {mode === AppMode.VOICE_BOT && <VoiceBotView updateMetrics={updateMetrics} />}
          {mode === AppMode.DASHBOARD && <DashboardView metrics={metrics} />}
          {mode === AppMode.TOOLS && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="glass-panel rounded-3xl p-1 relative overflow-hidden group">
                       <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-400 to-blue-500 opacity-50"></div>
                       <div className="p-6 h-full flex flex-col">
                          <h3 className="flex items-center gap-2 text-white/80 mb-6 text-sm uppercase font-mono font-bold tracking-widest">
                             <span className="p-1 rounded bg-cyan-500/20 text-cyan-300"><span className="material-symbols-rounded text-sm">mic</span></span>
                             Transcribe Tool
                          </h3>
                          <TranscribeView />
                       </div>
                  </div>
                  <div className="glass-panel rounded-3xl p-1 relative overflow-hidden group">
                       <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-400 to-pink-500 opacity-50"></div>
                       <div className="p-6 h-full flex flex-col">
                           <h3 className="flex items-center gap-2 text-white/80 mb-6 text-sm uppercase font-mono font-bold tracking-widest">
                              <span className="p-1 rounded bg-pink-500/20 text-pink-300"><span className="material-symbols-rounded text-sm">record_voice_over</span></span>
                              TTS Tool
                           </h3>
                          <TTSView />
                       </div>
                  </div>
              </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;