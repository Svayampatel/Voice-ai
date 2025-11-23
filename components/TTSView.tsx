import React, { useState, useRef, useEffect } from 'react';
import { generateSpeech } from '../services/geminiService';
import { decodeAudioData } from '../utils/audioUtils';

const TTSView: React.FC = () => {
  const [text, setText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedVoice, setSelectedVoice] = useState('Kore');

  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);

  const voices = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'];

  useEffect(() => {
    return () => {
      stopAudio();
      if (audioContextRef.current?.state !== 'closed') {
        audioContextRef.current?.close();
      }
    };
  }, []);

  const stopAudio = () => {
    if (sourceRef.current) {
      try { sourceRef.current.stop(); } catch (e) {}
      sourceRef.current = null;
    }
    setIsPlaying(false);
  };

  const handleGenerate = async () => {
    if (!text.trim()) {
        setError("Please enter some text.");
        return;
    }
    stopAudio();
    setIsLoading(true);
    setError(null);

    try {
      const pcmData = await generateSpeech(text, selectedVoice);
      if (!pcmData) throw new Error("No audio data received.");

      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') await ctx.resume();

      const audioBuffer = await decodeAudioData(pcmData, ctx, 24000, 1);
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.onended = () => setIsPlaying(false);
      sourceRef.current = source;
      source.start(0);
      setIsPlaying(true);
    } catch (err: any) {
      setError("Speech generation failed.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full gap-4">
        {/* Top: Voice Selection */}
        <div>
            <label className="block font-mono font-bold text-[10px] text-white/40 uppercase tracking-widest mb-3 px-1">Select Voice Model</label>
            <div className="flex flex-wrap gap-2">
                {voices.map(voice => (
                    <button
                        key={voice}
                        onClick={() => setSelectedVoice(voice)}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all border flex items-center gap-2 backdrop-blur-sm ${
                            selectedVoice === voice 
                            ? 'bg-purple-500/30 text-white border-purple-400/50 shadow-[0_0_10px_rgba(168,85,247,0.3)]' 
                            : 'bg-white/5 text-white/50 border-white/5 hover:bg-white/10 hover:text-white hover:border-white/20'
                        }`}
                    >
                         {selectedVoice === voice && <span className="material-symbols-rounded text-sm">check</span>}
                        {voice}
                    </button>
                ))}
            </div>
        </div>

        {/* Middle: Text Input (Expands) */}
        <div className="flex-1 min-h-[120px] relative group">
            <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Type something here to hear it spoken..."
                className="glass-input w-full h-full rounded-2xl p-5 font-mono text-sm placeholder-white/20 text-white resize-none transition-colors custom-scrollbar"
            />
        </div>

        {/* Error Message */}
        {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-200 p-3 rounded-xl font-bold text-center text-sm backdrop-blur-sm flex items-center justify-center gap-2">
                <span className="material-symbols-rounded text-lg">warning</span>
                {error}
            </div>
        )}

        {/* Bottom: Action Buttons */}
        <div className="mt-auto pt-2 flex gap-4">
             {isPlaying && (
                <button 
                    onClick={stopAudio}
                    className="flex-1 py-4 rounded-xl glass-btn text-white font-bold uppercase tracking-wider flex items-center justify-center gap-2"
                >
                     <span className="material-symbols-rounded">stop</span> Stop
                </button>
             )}
             
            <button 
                onClick={handleGenerate}
                disabled={isLoading || !text.trim()}
                className={`flex-1 py-4 rounded-xl font-bold uppercase tracking-widest shadow-lg transition-all hover:-translate-y-0.5 border border-white/20 flex items-center justify-center gap-2 backdrop-blur-md
                    ${isLoading 
                        ? 'bg-white/10 text-white/40 cursor-wait' 
                        : 'bg-gradient-to-r from-purple-600/80 to-pink-600/80 text-white shadow-purple-900/20 hover:shadow-purple-500/30'}
                `}
            >
                {isLoading ? (
                    <>
                        <span className="material-symbols-rounded animate-spin">sync</span>
                        Generating...
                    </>
                ) : (
                    <>
                        <span className="material-symbols-rounded">campaign</span>
                        Generate Speech
                    </>
                )}
            </button>
        </div>
    </div>
  );
};

export default TTSView;