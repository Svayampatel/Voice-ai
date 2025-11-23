export enum AppMode {
  VOICE_BOT = 'voice_bot',
  DASHBOARD = 'dashboard',
  TOOLS = 'tools' // Legacy direct access
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  audioUrl?: string; // URL to blob for playback
  isToolUse?: boolean;
}

export interface AnalyticsMetrics {
  totalQueries: number;
  avgResponseTime: number; // ms
  backendCalls: number;
  lastQueryLatency: {
    stt: number;
    llm: number;
    tts: number;
    total: number;
  } | null;
}

export interface AudioState {
  isRecording: boolean;
  isPlaying: boolean;
  audioBlob: Blob | null;
  duration: number;
}

export type LoadingState = 'idle' | 'recording' | 'transcribing' | 'thinking' | 'synthesizing' | 'playing' | 'error';
