import React, { useState, useRef } from 'react';
import { transcribeAudio } from '../services/geminiService';
import { blobToBase64 } from '../utils/audioUtils';
import AudioVisualizer from './AudioVisualizer';

const TranscribeView: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcription, setTranscription] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const startRecording = async () => {
    try {
      setError(null);
      setTranscription(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = handleStop;
      
      mediaRecorder.start();
      setIsRecording(true);
    } catch (err: any) {
      console.error("Error accessing microphone:", err);
      setError("MIC ERROR");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleStop = async () => {
    setIsProcessing(true);
    if (streamRef.current) {
       streamRef.current.getTracks().forEach(track => track.stop());
    }

    try {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      if (blob.size < 100) {
        throw new Error("Audio too short.");
      }
      
      const base64 = await blobToBase64(blob);
      const result = await transcribeAudio(base64, blob.type || 'audio/webm');
      
      if (!result) {
          setError("No speech detected.");
      } else {
          setTranscription(result);
      }
    } catch (err: any) {
      setError("Transcription failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Visualizer Section - Expands to fill space */}
      <div className="flex-1 glass-input rounded-2xl p-4 relative min-h-[150px] flex items-center justify-center overflow-hidden group border-white/5">
         <div className="absolute inset-0 z-0 opacity-60">
             <AudioVisualizer stream={streamRef.current} isRecording={isRecording} />
         </div>
         
         <div className="relative z-10 text-center pointer-events-none">
            {isRecording ? (
                <div className="flex flex-col items-center gap-2">
                     <span className="flex h-4 w-4 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500"></span>
                     </span>
                     <div className="text-red-300 font-bold tracking-[0.2em] text-sm animate-pulse shadow-black drop-shadow-md">RECORDING AUDIO</div>
                </div>
            ) : isProcessing ? (
                <div className="flex flex-col items-center gap-2">
                    <span className="material-symbols-rounded animate-spin text-purple-400 text-3xl">hourglass_top</span>
                    <div className="text-purple-300 font-bold tracking-[0.2em] text-sm animate-pulse">PROCESSING...</div>
                </div>
            ) : (
                <div className="text-white/30 font-bold tracking-[0.2em] text-sm transition-colors">
                    READY TO RECORD
                </div>
            )}
         </div>
      </div>

      {/* Transcription Result Output */}
      {transcription && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 max-h-48 flex flex-col animate-in fade-in slide-in-from-bottom-2">
            <div className="flex justify-between items-center mb-2">
                <span className="font-mono font-bold text-[10px] text-white/40 uppercase tracking-widest">Result</span>
                <button 
                    onClick={() => navigator.clipboard.writeText(transcription)}
                    className="text-[10px] font-bold text-cyan-300 hover:text-cyan-200 bg-cyan-900/30 px-3 py-1 rounded-full border border-cyan-500/30 transition-colors"
                >
                    COPY
                </button>
            </div>
            <div className="font-mono text-sm text-white/90 overflow-y-auto custom-scrollbar leading-relaxed">
                {transcription}
            </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-200 p-3 rounded-xl font-bold text-center text-sm backdrop-blur-sm flex items-center justify-center gap-2">
            <span className="material-symbols-rounded text-lg">error</span>
            {error}
        </div>
      )}

      {/* Primary Action Button - Fixed at bottom */}
      <div className="mt-auto pt-2">
            {!isRecording ? (
                <button 
                    onClick={startRecording}
                    disabled={isProcessing}
                    className="w-full py-4 rounded-xl bg-gradient-to-r from-cyan-600/80 to-blue-600/80 backdrop-blur-md text-white font-bold uppercase tracking-widest shadow-lg hover:shadow-cyan-500/30 hover:-translate-y-0.5 transition-all border border-white/20 flex items-center justify-center gap-3 group"
                >
                    <span className="material-symbols-rounded group-hover:scale-110 transition-transform">mic</span>
                    Start Recording
                </button>
            ) : (
                <button 
                    onClick={stopRecording}
                    className="w-full py-4 rounded-xl bg-gradient-to-r from-red-600/80 to-pink-600/80 backdrop-blur-md text-white font-bold uppercase tracking-widest shadow-lg hover:shadow-red-500/30 hover:-translate-y-0.5 transition-all border border-white/20 flex items-center justify-center gap-3 animate-pulse"
                >
                    <span className="material-symbols-rounded">stop_circle</span>
                    Stop Recording
                </button>
            )}
      </div>
    </div>
  );
};

export default TranscribeView;