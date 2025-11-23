import React, { useState, useRef, useEffect } from 'react';
import { transcribeAudio, getBotResponse, generateSpeech } from '../services/geminiService';
import { blobToBase64, decodeAudioData } from '../utils/audioUtils';
import AudioVisualizer from './AudioVisualizer';
import { Message, LoadingState, AnalyticsMetrics } from '../types';

interface VoiceBotViewProps {
  updateMetrics: (metrics: Partial<AnalyticsMetrics>) => void;
}

const SUGGESTIONS = [
  "Where is order #ORD-123?",
  "Check my account balance",
  "I have a problem with my delivery",
  "What are your support hours?",
  "What is your refund policy?",
  "Can I speak to a human agent?"
];

const VoiceBotView: React.FC<VoiceBotViewProps> = ({ updateMetrics }) => {
  const [messages, setMessages] = useState<Message[]>([
    { id: 'init', role: 'model', text: "Hello! I'm Sonic. How can I help you today?", timestamp: Date.now() }
  ]);
  const [status, setStatus] = useState<LoadingState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [showFaq, setShowFaq] = useState<boolean>(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, status]);

  const stopPlayback = () => {
    if (currentSourceRef.current) {
      try { currentSourceRef.current.stop(); } catch (e) {}
    }
  };

  /**
   * Core pipeline: Takes text input, gets LLM response, generates TTS, and plays audio.
   * Can be called from Audio STT or Text Suggestions.
   */
  const processConversationTurn = async (userText: string, sttLatency: number = 0) => {
    const startTime = performance.now();
    
    // 1. Add User Message
    const userMsg: Message = { id: Date.now().toString(), role: 'user', text: userText, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);

    try {
        // 2. NLU & Response Generation
        setStatus('thinking');
        const llmStart = performance.now();
        const { text: botResponseText, toolUsed } = await getBotResponse(userText);
        const llmTime = performance.now() - llmStart;

        // 3. TTS
        setStatus('synthesizing');
        const ttsStart = performance.now();
        let audioData: Uint8Array | null = null;
        try {
            audioData = await generateSpeech(botResponseText);
        } catch (ttsErr) {
            console.warn("TTS Failed", ttsErr);
        }
        const ttsTime = performance.now() - ttsStart;

        const totalTime = sttLatency + llmTime + ttsTime;

        // 4. Update Metrics
        updateMetrics({
            totalQueries: 1, 
            avgResponseTime: totalTime,
            backendCalls: toolUsed ? 1 : 0,
            lastQueryLatency: { stt: sttLatency, llm: llmTime, tts: ttsTime, total: totalTime }
        });

        // 5. Play Audio & Add Bot Message
        if (audioData) {
            setStatus('playing');
            await playResponse(audioData);
        } else {
            setStatus('idle');
        }
        
        const botMsg: Message = { 
            id: (Date.now() + 1).toString(), 
            role: 'model', 
            text: botResponseText, 
            timestamp: Date.now(),
            isToolUse: toolUsed
        };
        setMessages(prev => [...prev, botMsg]);

    } catch (err) {
        console.error("Pipeline error:", err);
        setError("SYSTEM ERR");
        setStatus('error');
        setTimeout(() => setStatus('idle'), 4000);
    }
  };

  const startRecording = async () => {
    try {
      stopPlayback(); 
      setError(null);
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = processAudioInput;
      
      mediaRecorder.start();
      setStatus('recording');
    } catch (err: any) {
      console.error("Microphone error:", err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError("PERM DENIED");
      } else if (err.name === 'NotFoundError') {
        setError("NO MIC FOUND");
      } else {
        setError("MIC ERROR");
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && status === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  const processAudioInput = async () => {
    if (streamRef.current) {
       streamRef.current.getTracks().forEach(track => track.stop());
    }
    
    try {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      if (blob.size < 100) {
         setError("TOO SHORT");
         setStatus('idle');
         return;
      }

      const base64 = await blobToBase64(blob);

      // STT Phase
      setStatus('transcribing');
      const sttStart = performance.now();
      let transcript = "";
      try {
        transcript = await transcribeAudio(base64, blob.type || 'audio/webm');
      } catch (sttErr: any) {
        throw new Error("STT FAILED");
      }
      const sttTime = performance.now() - sttStart;

      if (!transcript.trim() || transcript === "...") {
        setStatus('idle');
        setError("NO SPEECH");
        return;
      }

      // Hand off to core pipeline
      await processConversationTurn(transcript, sttTime);

    } catch (err: any) {
      console.error("Audio processing error:", err);
      setError("SYSTEM ERR");
      setStatus('error');
      setTimeout(() => {
          if (status !== 'recording') setStatus('idle');
      }, 4000);
    }
  };

  const playResponse = async (pcmData: Uint8Array) => {
    try {
        if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        }
        const ctx = audioContextRef.current;
        if (ctx.state === 'suspended') await ctx.resume();

        const audioBuffer = await decodeAudioData(pcmData, ctx, 24000, 1);
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        source.onended = () => {
            setStatus(prev => prev === 'playing' ? 'idle' : prev);
        };
        currentSourceRef.current = source;
        source.start(0);
    } catch (e) {
        setStatus('idle');
        setError("AUDIO ERR");
    }
  };

  const handleSuggestionClick = (text: string) => {
      if (status !== 'idle') return;
      processConversationTurn(text, 0);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-180px)] max-w-4xl mx-auto relative gap-4">
      
      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto px-6 py-6 glass-panel rounded-3xl relative custom-scrollbar space-y-6">
        
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-5 rounded-2xl backdrop-blur-md border shadow-lg transition-all duration-300 ${
              msg.role === 'user' 
                ? 'bg-gradient-to-br from-indigo-600/60 to-purple-700/60 text-white border-white/20 rounded-tr-none shadow-[0_4px_15px_rgba(99,102,241,0.2)]' 
                : 'bg-white/5 text-white/90 border-white/10 rounded-tl-none shadow-[0_4px_15px_rgba(0,0,0,0.1)]'
            }`}>
              <div className="flex items-center gap-2 mb-2 opacity-60 text-[10px] font-mono tracking-widest uppercase">
                 {msg.role === 'user' ? (
                     <span className="text-purple-200">You</span>
                 ) : (
                     <>
                        <span className="material-symbols-rounded text-sm text-cyan-300">smart_toy</span>
                        <span className="text-cyan-200">Sonic</span>
                     </>
                 )}
              </div>
              <p className="leading-relaxed text-sm md:text-base font-light">{msg.text}</p>
              {msg.isToolUse && (
                <div className="mt-3 inline-flex items-center gap-2 text-xs bg-black/30 text-cyan-200 px-3 py-1.5 rounded-full border border-white/5">
                  <span className="material-symbols-rounded text-sm">database</span>
                  <span>System Action</span>
                </div>
              )}
            </div>
          </div>
        ))}

        {status !== 'idle' && status !== 'playing' && status !== 'recording' && status !== 'error' && (
            <div className="flex justify-start">
                <div className="bg-white/5 border border-white/10 rounded-2xl rounded-tl-none px-6 py-4 flex items-center gap-4 animate-pulse">
                    <div className="flex gap-1">
                        <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce"></span>
                        <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce [animation-delay:0.1s]"></span>
                        <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                    </div>
                    <span className="text-xs font-bold uppercase tracking-widest text-cyan-200">
                        {status === 'transcribing' && "Listening..."}
                        {status === 'thinking' && "Thinking..."}
                        {status === 'synthesizing' && "Speaking..."}
                    </span>
                </div>
            </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Suggested Queries / FAQs Collapsible Section */}
      <div className="px-2">
         <div className="flex flex-col gap-2">
            <button 
                onClick={() => setShowFaq(!showFaq)}
                className="flex items-center gap-2 w-full group focus:outline-none"
            >
                <span className={`material-symbols-rounded text-white/40 transition-transform duration-300 ${showFaq ? 'rotate-180' : ''}`}>expand_more</span>
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-white/30 group-hover:text-white/60 transition-colors">General FAQs & Suggested Queries</span>
                <div className="h-px bg-white/10 flex-1 group-hover:bg-white/20 transition-colors"></div>
            </button>
            
            <div className={`transition-all duration-300 ease-in-out overflow-hidden ${showFaq ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'}`}>
                <div className="flex flex-wrap gap-2 pt-2 pb-1">
                    {SUGGESTIONS.map((suggestion, index) => (
                        <button 
                            key={index}
                            onClick={() => handleSuggestionClick(suggestion)}
                            disabled={status !== 'idle'}
                            className={`
                                px-4 py-2 rounded-full border text-xs font-medium transition-all backdrop-blur-md flex items-center gap-2
                                ${status === 'idle' 
                                    ? 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white hover:border-white/20 hover:scale-105 cursor-pointer shadow-sm' 
                                    : 'bg-white/5 border-white/5 text-white/20 cursor-not-allowed'}
                            `}
                        >
                            {suggestion}
                        </button>
                    ))}
                </div>
            </div>
         </div>
      </div>

      {/* Controls Area */}
      <div className="glass-panel rounded-full p-3 pl-8 relative flex items-center justify-between gap-6 overflow-hidden">
        
        {/* Background Visualizer Layer */}
        <div className="absolute inset-0 z-0 opacity-30 pointer-events-none mix-blend-overlay">
             <AudioVisualizer stream={streamRef.current} isRecording={status === 'recording'} />
        </div>

        <div className="relative z-10 flex-1">
             <div className="font-mono font-bold text-[10px] text-white/40 mb-1 tracking-widest uppercase">System Status</div>
             <div className="text-xl font-light tracking-tight flex items-center gap-2 h-8">
                {status === 'recording' && <span className="text-red-300 animate-pulse flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_10px_red]"></span>Recording Audio...</span>}
                {status === 'playing' && <span className="text-cyan-300 flex items-center gap-2"><span className="material-symbols-rounded animate-spin text-lg">graphic_eq</span>Speaking...</span>}
                {status === 'error' && <span className="text-orange-300 flex items-center gap-2"><span className="material-symbols-rounded text-lg">warning</span>{error}</span>}
                {status === 'idle' && <span className="text-white/60">Ready to listen</span>}
                {(status === 'thinking' || status === 'transcribing') && <span className="text-purple-300 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></span>Processing...</span>}
             </div>
        </div>

        <button
        onClick={status === 'recording' ? stopRecording : startRecording}
        disabled={status !== 'idle' && status !== 'recording' && status !== 'playing' && status !== 'error'}
        className={`
            relative z-10 h-16 w-16 rounded-full flex items-center justify-center transition-all duration-300 shadow-xl border
            ${status === 'recording' 
                ? 'bg-red-500 text-white border-red-400 shadow-[0_0_30px_rgba(239,68,68,0.5)] scale-110' 
                : status === 'error'
                    ? 'bg-orange-500/80 text-white border-orange-400'
                    : 'bg-gradient-to-br from-cyan-500 to-blue-600 text-white border-white/20 hover:shadow-[0_0_25px_rgba(6,182,212,0.4)] hover:scale-105'}
        `}
        >
            <span className="material-symbols-rounded text-3xl">
            {status === 'recording' ? 'stop' : status === 'error' ? 'refresh' : 'mic'}
            </span>
        </button>
      </div>
    </div>
  );
};

export default VoiceBotView;