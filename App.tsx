
import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GoogleGenAI, Type } from '@google/genai';
import Peer from 'peerjs';
import { toDataURL } from 'qrcode';
import { 
  AppView, Overlay, CausalEvent, CausalLink, 
  LabMetric, GameMetric, 
  ProcessMetric
} from './types';

// --- Shared Components ---

const ParticleField = () => {
  const particles = useMemo(() => 
    Array.from({ length: 40 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 2 + 1,
      duration: Math.random() * 15 + 10,
      delay: Math.random() * 5
    })), []);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full bg-cyan-400/20 blur-[1px]"
          style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.size, height: p.size }}
          animate={{ y: [0, -120, 0], x: [0, Math.random() * 40 - 20, 0], opacity: [0, 0.4, 0] }}
          transition={{ duration: p.duration, repeat: Infinity, delay: p.delay, ease: "linear" }}
        />
      ))}
    </div>
  );
};

const HUDBox: React.FC<{ children: React.ReactNode; title: string; color?: string; className?: string }> = ({ children, title, color = "cyan", className = "" }) => (
  <div className={`relative bg-slate-950/60 border border-cyan-500/20 rounded-2xl flex flex-col overflow-hidden backdrop-blur-xl shadow-[0_0_40px_rgba(0,0,0,0.7)] ${className}`}>
    <div className={`p-3 border-b border-cyan-500/10 bg-slate-900/80 flex justify-between items-center`}>
      <h2 className={`text-[10px] font-black tracking-[0.2em] uppercase text-${color}-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]`}>{title}</h2>
      <div className="flex gap-1.5">
        <div className={`w-1.5 h-1.5 rounded-full bg-${color}-500 shadow-[0_0_8px_rgba(34,211,238,0.8)]`} />
        <div className={`w-1.5 h-1.5 rounded-full bg-${color}-500 animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.8)]`} />
      </div>
    </div>
    <div className="flex-1 p-4 overflow-y-auto custom-scrollbar relative z-10">
      {children}
    </div>
    <div className="absolute inset-0 bg-gradient-to-br from-transparent via-cyan-400/5 to-transparent pointer-events-none mix-blend-overlay opacity-20" />
  </div>
);

const ModeCard: React.FC<{ id: string; title: string; desc: string; icon: string; active: boolean; onClick: () => void; color: string }> = ({ title, desc, icon, active, onClick, color }) => (
  <motion.div
    whileHover={{ scale: 1.02, y: -5 }}
    whileTap={{ scale: 0.98 }}
    onClick={onClick}
    className={`cursor-pointer p-6 rounded-2xl border-2 transition-all duration-500 backdrop-blur-md relative overflow-hidden h-full flex flex-col ${
      active ? `bg-gradient-to-br from-slate-900/90 to-black/90 border-${color}-500 shadow-[0_0_60px_rgba(34,211,238,0.5)]` : 'bg-slate-950/40 border-cyan-500/10 hover:border-cyan-500/40'
    }`}
  >
    <div className={`text-4xl mb-4 text-${color}-400 drop-shadow-[0_0_15px_rgba(34,211,238,0.6)]`}>{icon}</div>
    <h3 className={`text-xl font-black mb-2 tracking-tight ${active ? `text-${color}-400` : 'text-slate-200'}`}>{title}</h3>
    <p className="text-sm text-slate-400 leading-relaxed font-medium mb-6 flex-1">{desc}</p>
    <div className={`mt-auto flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase ${active ? `text-${color}-400` : 'text-slate-600'}`}>
      {active ? 'SYSTEM ACTIVE' : 'ENTER MODE →'}
    </div>
  </motion.div>
);

const InteractiveCausalGraph: React.FC<{ links: CausalLink[]; events: CausalEvent[] }> = ({ links, events }) => {
  const nodes = useMemo(() => events.slice(0, 6), [events]);
  
  return (
    <div className="relative w-full h-full min-h-[300px] overflow-hidden">
      <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
        <defs>
          <marker id="arrowhead" markerWidth="6" markerHeight="6" refX="5" refY="3" orientation="auto">
            <polygon points="0 0, 6 3, 0 6" fill="#22d3ee" opacity="0.8" />
          </marker>
          <filter id="glow">
            <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        
        <AnimatePresence>
          {links.map((link, i) => {
            const causeIndex = nodes.findIndex(n => n.id === link.cause_event_id);
            const effectIndex = nodes.findIndex(n => n.id === link.effect_event_id);
            if (causeIndex === -1 || effectIndex === -1) return null;
            const x1 = 20 + (causeIndex * 15) % 60;
            const y1 = 20 + (causeIndex * 20) % 60;
            const x2 = 20 + (effectIndex * 15) % 60;
            const y2 = 20 + (effectIndex * 20) % 60;
            return (
              <motion.line
                key={link.id || i}
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 0.6 }}
                x1={`${x1}%`} y1={`${y1}%`}
                x2={`${x2}%`} y2={`${y2}%`}
                stroke="#22d3ee"
                strokeWidth="1"
                markerEnd="url(#arrowhead)"
                className="hud-glow"
              />
            );
          })}
        </AnimatePresence>

        {nodes.map((ev, i) => {
          const x = 20 + (i * 15) % 60;
          const y = 20 + (i * 20) % 60;
          return (
            <motion.g 
              key={ev.id || i}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: i * 0.1 }}
            >
              <circle cx={`${x}%`} cy={`${y}%`} r="6" fill="#0f172a" stroke="#22d3ee" strokeWidth="1.5" filter="url(#glow)" />
              <text x={`${x}%`} y={`${y}%`} dy=".3em" textAnchor="middle" fontSize="3.5" fill="#fff" fontWeight="bold">
                {ev.type.substring(0, 3).toUpperCase()}
              </text>
            </motion.g>
          );
        })}
        {nodes.length === 0 && (
          <text x="50" y="50" textAnchor="middle" fill="#22d3ee" opacity="0.3" fontSize="4" fontWeight="black" className="uppercase tracking-[0.5em]">Awaiting Logic Chain</text>
        )}
      </svg>
    </div>
  );
};

const MetricBar: React.FC<{ label: string; val: number; color: string; max?: number }> = ({ label, val, color, max = 10 }) => (
  <div className="space-y-1.5">
    <div className="flex justify-between items-end">
      <span className="text-[9px] font-black uppercase opacity-60 text-white">{label}</span>
      <span className={`text-sm font-black text-${color}-400`}>{val}</span>
    </div>
    <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden border border-white/5 shadow-inner">
      <motion.div initial={{ width: 0 }} animate={{ width: `${(val / max) * 100}%` }} className={`h-full bg-${color}-500 shadow-[0_0_8px_${color}]`} />
    </div>
  </div>
);

const ConnectHub: React.FC<{ 
  onStartCamera: () => void; 
  isLive: boolean;
  peerId: string;
  peerConnected: boolean;
}> = ({ onStartCamera, isLive, peerId, peerConnected }) => {
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [copying, setCopying] = useState(false);

  const bridgeUrl = useMemo(() => {
    if (!peerId) return '';
    const url = new URL(window.location.origin + window.location.pathname);
    url.searchParams.set('targetPeerId', peerId);
    return url.toString();
  }, [peerId]);

  useEffect(() => {
    if (bridgeUrl) {
      toDataURL(bridgeUrl, {
        margin: 1,
        width: 300,
        color: {
          dark: '#22d3ee',
          light: '#000000'
        }
      })
      .then(url => setQrDataUrl(url))
      .catch(err => console.error('QR Gen failed', err));
    }
  }, [bridgeUrl]);

  const handleCopy = () => {
    if (bridgeUrl) {
      navigator.clipboard.writeText(bridgeUrl);
      setCopying(true);
      setTimeout(() => setCopying(false), 2000);
    }
  };

  return (
    <div className="flex flex-col items-center gap-10 py-10 w-full max-w-6xl mx-auto">
      <h2 className="text-4xl font-black text-cyan-300 hud-glow uppercase tracking-tighter text-center">CONNECT YOUR CAMERA 🎥</h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 w-full relative items-stretch">
        <HUDBox title="Mobile Node" color="blue" className="relative">
          <div className="flex flex-col items-center justify-center p-8 text-center space-y-6">
             <div className="text-[12px] font-black uppercase text-blue-400 tracking-[0.4em] mb-2">📱 YOUR PHONE</div>
             <div className="relative p-4 bg-slate-900/50 rounded-3xl border-4 border-blue-500/20 group">
                <div className="w-40 h-40 bg-black flex items-center justify-center p-2 rounded-xl overflow-hidden relative">
                   {qrDataUrl ? (
                     <motion.img 
                       initial={{ opacity: 0, scale: 0.9 }}
                       animate={{ opacity: 1, scale: 1 }}
                       src={qrDataUrl} 
                       alt="Connect Mobile" 
                       className="w-full h-full" 
                     />
                   ) : (
                     <div className="animate-pulse text-cyan-500 text-[10px] font-black">GENERATING SYNC ID...</div>
                   )}
                   <motion.div 
                     className="absolute left-0 w-full h-0.5 bg-cyan-400/50 shadow-[0_0_10px_cyan]"
                     animate={{ top: ['0%', '100%', '0%'] }}
                     transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                   />
                </div>
             </div>
             <div className="space-y-4">
                <p className="text-sm font-black text-blue-100 uppercase tracking-widest italic">Scan to link mobile camera</p>
                <div className="text-[10px] text-slate-500 font-mono mt-2 break-all px-4">{peerId || 'Awaiting ID...'}</div>
                <button 
                  onClick={handleCopy}
                  className={`px-4 py-2 border rounded-full text-[10px] font-black uppercase transition-all ${copying ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/10'}`}
                >
                  {copying ? 'LINK COPIED' : '[ COPY INVITE LINK ]'}
                </button>
             </div>
             <div className="space-y-3 pt-6 w-full">
                <div className={`flex items-center gap-3 p-3 border rounded-2xl text-[11px] font-black uppercase tracking-widest transition-colors ${peerConnected ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400' : 'bg-slate-500/5 border-slate-500/20 text-slate-600'}`}>
                   <span className="text-lg">{peerConnected ? '✅' : '📡'}</span> <span>{peerConnected ? 'Mobile Linked' : 'Awaiting Connection'}</span>
                </div>
             </div>
          </div>
        </HUDBox>

        <HUDBox title="Station Node" color="cyan" className="relative">
          <div className="flex flex-col items-center justify-center p-8 text-center h-full space-y-10">
             <div className="text-[12px] font-black uppercase text-cyan-400 tracking-[0.4em]">💻 YOUR LAPTOP</div>
             
             <div className="flex flex-col gap-6 w-full">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <motion.button 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={onStartCamera}
                    className={`px-6 py-5 rounded-3xl text-[11px] font-black uppercase tracking-widest transition-all shadow-2xl ${isLive ? 'bg-red-500 text-white shadow-red-500/40' : 'bg-cyan-500 text-black shadow-cyan-500/40'}`}
                  >
                    {isLive ? '[Stop Webcam]' : '[Start Webcam]'}
                  </motion.button>
                  <motion.button 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="px-6 py-5 border-2 border-cyan-500/50 text-cyan-400 text-[11px] font-black uppercase tracking-widest rounded-3xl hover:bg-cyan-500/10"
                  >
                    [Share Screen]
                  </motion.button>
                </div>

                <div className="p-6 bg-cyan-500/5 border border-cyan-500/20 rounded-3xl w-full">
                  <div className={`text-xs font-black tracking-[0.2em] uppercase ${isLive ? 'text-emerald-500' : 'text-cyan-500 animate-pulse'}`}>
                     {isLive ? '🔴 LIVE STREAM ACTIVE' : 'Ready for capture'}
                  </div>
                  <p className="text-[9px] text-slate-500 mt-2 uppercase font-bold">Automatic sync protocol enabled</p>
                </div>
             </div>
          </div>
        </HUDBox>
      </div>
    </div>
  );
};

// --- Main App ---

const App: React.FC = () => {
  const [view, setView] = useState<AppView>('dashboard');
  const [isLive, setIsLive] = useState(false);
  const [overlays, setOverlays] = useState<Overlay[]>([]);
  const [events, setEvents] = useState<CausalEvent[]>([]);
  const [causalLinks, setCausalLinks] = useState<CausalLink[]>([]);
  const [insights, setInsights] = useState('Initialize operational engine to begin real-time analysis.');
  
  const [labData, setLabData] = useState<LabMetric | null>(null);
  const [gameData, setGameData] = useState<GameMetric | null>(null);
  const [processData, setProcessData] = useState<ProcessMetric | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const heatmapCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analysisTimerRef = useRef<number | null>(null);
  const deepAnalysisTimerRef = useRef<number | null>(null);

  // Peer Connectivity
  const [peerId, setPeerId] = useState('');
  const [peerConnected, setPeerConnected] = useState(false);
  const [targetPeerId, setTargetPeerId] = useState<string | null>(null);
  const peerInstance = useRef<Peer | null>(null);

  // --- Start Analysis Loops ---
  const startLoops = useCallback(() => {
    runFastAnalysis();
    runDeepAnalysis();
  }, []);

  // --- Initialize PeerJS ---
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const targetId = urlParams.get('targetPeerId');
    if (targetId) setTargetPeerId(targetId);

    const peer = new Peer();
    peerInstance.current = peer;

    peer.on('open', (id) => {
      console.log('Peer connected with ID:', id);
      setPeerId(id);
    });

    peer.on('call', (call) => {
      console.log('Incoming call from mobile node...');
      call.answer();
      call.on('stream', (remoteStream) => {
        console.log('Receiving remote stream...');
        setPeerConnected(true);
        if (videoRef.current) {
          videoRef.current.srcObject = remoteStream;
        }
        setIsLive(true);
        startLoops();
      });
      call.on('close', () => {
        setPeerConnected(false);
        setIsLive(false);
        if(videoRef.current) videoRef.current.srcObject = null;
        console.log('Remote connection closed.');
      });
      call.on('error', (err) => {
        console.error('Incoming call error:', err);
        setPeerConnected(false);
      });
    });

    peer.on('error', (err) => {
      console.error('Peer signal error:', err);
    });

    return () => {
      peer.destroy();
    };
  }, [startLoops]);

  // Handle mobile node initialization once peerId and targetPeerId are available
  useEffect(() => {
    if (peerId && targetPeerId) {
      initMobileNode(targetPeerId);
    }
  }, [peerId, targetPeerId]);

  const initMobileNode = async (targetId: string) => {
    try {
      console.log('Initializing mobile node for target:', targetId);
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "environment" }, 
        audio: true 
      });
      if (videoRef.current) videoRef.current.srcObject = stream;
      
      const call = peerInstance.current?.call(targetId, stream);
      if (call) {
        call.on('stream', () => {
          setPeerConnected(true);
          console.log('Mobile stream confirmed by Station.');
        });
        call.on('close', () => {
            setPeerConnected(false);
            console.log('Connection to station closed.');
        });
        call.on('error', (err) => {
            console.error('Peer call error:', err);
            setPeerConnected(false);
        });
        console.log('Calling station node...');
      }
    } catch (err) {
      console.error("Mobile node capture failed:", err);
      alert("Mobile access failed. Camera permissions required.");
    }
  };

  // --- Heatmap Logic ---
  const drawHeatmap = useCallback(() => {
    const canvas = heatmapCanvasRef.current;
    if (!canvas || !isLive) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const video = videoRef.current;
    if (video) {
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
    }

    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'lighter';
    
    const activePoints = [
      ...overlays.map(o => ({ x: o.x + o.width/2, y: o.y + o.height/2, intensity: o.severity === 'critical' ? 1.0 : 0.4, color: o.severity === 'critical' ? '255, 60, 60' : '34, 211, 238' })),
      ...events.slice(0, 3).filter(e => e.x != null).map(e => ({ x: e.x!, y: e.y!, intensity: e.importance, color: '139, 92, 246' }))
    ];

    activePoints.forEach(p => {
      const x = p.x * canvas.width;
      const y = p.y * canvas.height;
      const radius = 70 * p.intensity;

      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, `rgba(${p.color}, ${0.4 * p.intensity})`);
      gradient.addColorStop(1, `rgba(${p.color}, 0)`);

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    });
  }, [overlays, events, isLive]);

  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(drawHeatmap, 60);
    return () => clearInterval(interval);
  }, [isLive, drawHeatmap]);

  const runFastAnalysis = useCallback(async () => {
    if (!isLive || !videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    ctx.drawImage(video, 0, 0);
    const base64Data = canvas.toDataURL('image/jpeg', 0.5).split(',')[1];

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      // Guideline check: `contents` must be an object { parts: [...] }
      const response = await ai.models.generateContent({
        model: 'gemini-flash-lite-latest',
        contents: { parts: [
          { inlineData: { data: base64Data, mimeType: 'image/jpeg' } },
          { text: `FAST LOOP: Mode ${view}. Identify actors with bounding boxes. Return JSON schema: { overlays: [{id, x, y, width, height, label, severity: 'critical'|'warning'|'info'}], summary: string }` }
        ]},
        config: {
          responseMimeType: 'application/json'
        }
      });
      const result = JSON.parse(response.text || '{}');
      setOverlays(result.overlays || []);
      setInsights(result.summary || 'Analyzing stream...');
    } catch (err) {
      console.warn("Fast Loop Latency Spike:", err);
    } finally {
      if (isLive) analysisTimerRef.current = window.setTimeout(runFastAnalysis, 1500);
    }
  }, [isLive, view]);

  const runDeepAnalysis = useCallback(async () => {
    if (!isLive || !videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const base64Data = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      // Guideline check: `contents` must be an object { parts: [...] }
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: { parts: [
          { inlineData: { data: base64Data, mimeType: 'image/jpeg' } },
          { text: `DEEP COGNITION: Mode ${view}. Construct causal graph linking recent visual events. Return causal links and events with coordinates.` }
        ]},
        config: {
          thinkingConfig: { thinkingBudget: 32768 },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              events: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { id: {type: Type.STRING}, type: {type: Type.STRING}, description: {type: Type.STRING}, importance: {type: Type.NUMBER}, x: {type: Type.NUMBER}, y: {type: Type.NUMBER} } } },
              causal_links: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { cause_event_id: {type: Type.STRING}, effect_event_id: {type: Type.STRING}, explanation: {type: Type.STRING}, confidence: {type: Type.NUMBER} } } },
              lab_data: { type: Type.OBJECT, properties: { variable: {type: Type.STRING}, value: {type: Type.STRING}, outcome: {type: Type.STRING}, confidence: {type: Type.NUMBER} } },
              game_data: { type: Type.OBJECT, properties: { score: {type: Type.NUMBER}, length: {type: Type.NUMBER}, creativity: {type: Type.NUMBER}, efficiency: {type: Type.NUMBER} } },
              process_data: { type: Type.OBJECT, properties: { cycleTime: {type: Type.STRING}, efficiency: {type: Type.STRING}, safetyAlert: {type: Type.STRING} } }
            }
          }
        }
      });
      const result = JSON.parse(response.text || '{}');
      if (result.events) setEvents(prev => [...result.events, ...prev].slice(0, 15));
      if (result.causal_links) setCausalLinks(result.causal_links);
      if (result.lab_data) setLabData(result.lab_data);
      if (result.game_data) setGameData(result.game_data);
      if (result.process_data) setProcessData(result.process_data);
    } catch (err) {
      console.error("Deep Cognition Error:", err);
    } finally {
      if (isLive) deepAnalysisTimerRef.current = window.setTimeout(runDeepAnalysis, 10000);
    }
  }, [isLive, view]);

  const toggleLive = useCallback(async () => {
    if (isLive) {
      if (analysisTimerRef.current) clearTimeout(analysisTimerRef.current);
      if (deepAnalysisTimerRef.current) clearTimeout(deepAnalysisTimerRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      setIsLive(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (videoRef.current) videoRef.current.srcObject = stream;
      streamRef.current = stream;
      setIsLive(true);
      startLoops();
    } catch (err) {
      console.error("Local capture failed:", err);
      alert("Local camera access failed.");
    }
  }, [isLive, startLoops]);

  if (targetPeerId) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-8 text-cyan-400 font-mono">
        <div className="w-full max-w-sm space-y-8 text-center">
           <div className="text-4xl font-black hud-glow animate-pulse">⌬ REMOTE NODE</div>
           <div className={`p-6 border-2 rounded-3xl ${peerConnected ? 'border-emerald-500 bg-emerald-500/10' : 'border-blue-500 bg-blue-500/10'}`}>
              <p className="text-sm font-black uppercase tracking-widest">
                {peerConnected ? 'SYNC ESTABLISHED' : 'INITIATING HANDSHAKE...'}
              </p>
              {peerConnected && <div className="mt-4 text-[10px] opacity-60">Mobile sensor active. Transmitting causal data to Station Node.</div>}
           </div>
           <div className="aspect-video bg-black rounded-2xl overflow-hidden border border-cyan-500/20 shadow-2xl relative">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              <div className="absolute inset-0 border-4 border-cyan-500/10 pointer-events-none" />
           </div>
           <button 
             onClick={() => window.location.href = window.location.origin + window.location.pathname}
             className="px-6 py-3 border border-red-500/40 text-red-400 text-[10px] font-black uppercase rounded-xl hover:bg-red-500/20 transition-colors"
           >
             Terminate Link
           </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen w-full bg-[#010409] text-cyan-400 overflow-hidden font-mono">
      <div 
        className="fixed inset-0 pointer-events-none transition-all duration-1000 z-0 opacity-50"
        style={{
          backgroundImage: 'url(https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/images/137188095/435c3c72-f62b-410c-87e8-12c4706d3371/hero-hud.jpg)',
          backgroundSize: 'cover', backgroundPosition: 'center',
          filter: 'hue-rotate(185deg) brightness(0.4) contrast(1.4) saturate(1.1)'
        }}
      />
      <ParticleField />
      <div className="scanline" />

      <div className="relative z-30 flex flex-col h-screen p-8 gap-6">
        <header className="flex justify-between items-center bg-slate-950/70 backdrop-blur-3xl p-5 rounded-3xl border border-cyan-500/20 shadow-2xl">
          <div className="flex items-center gap-6" onClick={() => setView('dashboard')}>
            <div className="w-12 h-12 flex items-center justify-center bg-cyan-500/10 border border-cyan-500/40 rounded-2xl group cursor-pointer transition-all hover:bg-cyan-500/20">
              <span className="text-3xl font-black group-hover:scale-110 transition-transform">⌬</span>
            </div>
            <div>
              <h1 className="text-2xl font-black text-cyan-300 uppercase tracking-tighter">Causal Lens</h1>
              <p className="text-[9px] font-black tracking-widest text-cyan-500 uppercase">Operational Modeling Engine</p>
            </div>
          </div>
          <nav className="flex gap-4 bg-black/60 p-1.5 rounded-2xl border border-cyan-500/10">
            {(['dashboard', 'lab', 'playground', 'process', 'connect'] as AppView[]).map(v => (
              <button 
                key={v} onClick={() => setView(v)}
                className={`px-5 py-2 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all ${view === v ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/40' : 'text-slate-400 hover:text-cyan-200'}`}
              >
                {v}
              </button>
            ))}
          </nav>
          <div className={`w-3 h-3 rounded-full ${isLive ? 'bg-emerald-500 animate-pulse shadow-[0_0_10px_#10b981]' : 'bg-red-500 opacity-30 shadow-[0_0_5px_red]'}`} />
        </header>

        <div className="flex-1 flex gap-8 overflow-hidden">
          {view !== 'dashboard' && view !== 'connect' && (
            <div className="w-80 flex flex-col gap-4 overflow-hidden">
               <HUDBox title="Sensor Stream" className="shrink-0">
                  <div className="relative aspect-video bg-black rounded-lg overflow-hidden border border-cyan-500/20">
                     <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                     <canvas ref={heatmapCanvasRef} className="absolute inset-0 w-full h-full opacity-60 pointer-events-none mix-blend-screen" />
                     <div className="absolute inset-0 pointer-events-none">
                        {overlays.map(ov => (
                           <motion.div 
                              key={ov.id} 
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className={`absolute border-2 ${ov.severity === 'critical' ? 'border-red-500 shadow-[0_0_10px_red]' : 'border-cyan-500 shadow-[0_0_10px_cyan]'}`} 
                              style={{ left: `${ov.x*100}%`, top: `${ov.y*100}%`, width: `${ov.width*100}%`, height: `${ov.height*100}%` }}
                            >
                              <span className="absolute -top-4 left-0 text-[8px] bg-cyan-500 text-black px-1 uppercase font-black">{ov.label}</span>
                           </motion.div>
                        ))}
                        {!isLive && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-md">
                             <span className="text-[10px] font-black uppercase text-cyan-500 opacity-40 animate-pulse tracking-widest">Awaiting Active Capture</span>
                          </div>
                        )}
                     </div>
                  </div>
                  <button onClick={toggleLive} className={`mt-4 w-full py-4 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-2xl transition-all ${isLive ? 'bg-red-500/20 text-red-400 border border-red-500/30 shadow-red-500/10' : 'bg-cyan-500 text-black shadow-cyan-500/40 hover:scale-[1.02]'}`}>
                     {isLive ? 'TERMINATE ENGINE' : 'ACTIVATE ENGINE'}
                  </button>
               </HUDBox>
               <HUDBox title="Causal Logic Graph" className="flex-1">
                  <InteractiveCausalGraph links={causalLinks} events={events} />
               </HUDBox>
            </div>
          )}

          <main className="flex-1 overflow-y-auto custom-scrollbar pr-2">
            <AnimatePresence mode="wait">
              <motion.div key={view} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
                {view === 'dashboard' && (
                  <div className="flex flex-col gap-10 py-10 max-w-6xl mx-auto">
                    <div className="flex flex-col md:flex-row justify-between items-end gap-6 border-b border-cyan-500/10 pb-10">
                      <div>
                        <h2 className="text-4xl font-black text-white uppercase tracking-tighter mb-2">Operational Dashboard</h2>
                        <p className="text-cyan-500/60 font-black text-xs uppercase tracking-widest">Select an era to begin causal reasoning on the physical world.</p>
                      </div>
                      <div className="flex items-center gap-6 bg-slate-950/50 p-4 rounded-2xl border border-white/5">
                        <div className="flex flex-col items-end">
                           <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">System Entropy</span>
                           <span className={`text-xs font-black ${isLive ? 'text-emerald-400' : 'text-cyan-400'}`}>{isLive ? 'STABLE' : 'IDLE'}</span>
                        </div>
                        <div className={`w-3 h-3 rounded-full ${isLive ? 'bg-emerald-500 shadow-[0_0_15px_#10b981]' : 'bg-cyan-500 shadow-[0_0_10px_cyan]'} animate-pulse`} />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                      <ModeCard id="lab" title="Research Lab" icon="🔬" color="cyan" desc="Scientific causality modeling for repetitive physical experiments." active={false} onClick={() => setView('lab')} />
                      <ModeCard id="playground" title="Causal Playground" icon="🧩" color="emerald" desc="Creative physical interactions and Rube Goldberg chain reactions." active={false} onClick={() => setView('playground')} />
                      <ModeCard id="process" title="Workflow Process" icon="⚙️" color="orange" desc="Operational analysis for manual assembly and workflow efficiency." active={false} onClick={() => setView('process')} />
                    </div>
                  </div>
                )}
                {view === 'connect' && (
                  <ConnectHub onStartCamera={toggleLive} isLive={isLive} peerId={peerId} peerConnected={peerConnected} />
                )}
                {view === 'lab' && (
                  <div className="flex flex-col gap-6">
                    <HUDBox title="Lab Cognition Matrix">
                       <p className="text-xl text-cyan-50 font-black mb-6 italic border-l-4 border-cyan-500 pl-4">"{insights}"</p>
                       <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                          {[
                            { label: 'Primary Variable', val: labData?.variable || 'BUFFERING...' },
                            { label: 'Observed Value', val: labData?.value || '---' },
                            { label: 'Predicted Outcome', val: labData?.outcome || '---' },
                            { label: 'Logic Accuracy', val: labData ? `${Math.round(labData.confidence * 100)}%` : '---' }
                          ].map((d, i) => (
                             <div key={i} className="p-4 bg-cyan-500/5 border border-cyan-500/20 rounded-2xl shadow-inner group hover:border-cyan-500/50 transition-colors">
                                <div className="text-[9px] font-black opacity-40 uppercase tracking-widest mb-1 group-hover:opacity-100">{d.label}</div>
                                <div className="text-xl font-black text-cyan-400 truncate">{d.val}</div>
                             </div>
                          ))}
                       </div>
                    </HUDBox>
                  </div>
                )}
                {view === 'playground' && (
                  <div className="flex flex-col gap-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <HUDBox title="Synergy Index" color="emerald">
                        <div className="text-center py-6">
                          <p className="text-7xl font-black text-emerald-400 drop-shadow-[0_0_15px_rgba(52,211,153,0.5)]">{gameData?.score || 0.0}</p>
                          <p className="text-[10px] font-black uppercase opacity-40 mt-2">Real-time Synergy</p>
                        </div>
                      </HUDBox>
                      <HUDBox title="Dynamics Telemetry" className="col-span-2">
                         <div className="grid grid-cols-3 gap-6 pt-4">
                           <MetricBar label="Innovation" val={gameData?.creativity || 0} color="emerald" />
                           <MetricBar label="Entropy Control" val={gameData?.efficiency || 0} color="orange" />
                           <MetricBar label="Causal Depth" val={gameData?.length || 0} color="cyan" max={20} />
                         </div>
                      </HUDBox>
                    </div>
                  </div>
                )}
                {view === 'process' && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <HUDBox title="Cycle Tempo" color="orange">
                      <div className="text-center py-2"><p className="text-3xl font-black text-orange-400">{processData?.cycleTime || '0.0s'}</p></div>
                    </HUDBox>
                    <HUDBox title="Load Ratio">
                      <div className="text-center py-2"><p className="text-3xl font-black text-white">{processData?.efficiency || '0%'}</p></div>
                    </HUDBox>
                    <HUDBox title="Safety Logic" color="red">
                      <div className="text-center py-2">
                        <p className={`text-[11px] font-black uppercase ${processData?.safetyAlert ? 'text-red-500 animate-pulse' : 'text-slate-500'}`}>
                          {processData?.safetyAlert || 'NOMINAL'}
                        </p>
                      </div>
                    </HUDBox>
                    <HUDBox title="Defect Log">
                       <div className="text-center py-2"><p className="text-3xl font-black text-cyan-400">{processData?.defectRate || '0.0'}</p></div>
                    </HUDBox>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>

        <footer className="h-8 flex items-center justify-between text-[10px] font-black tracking-[0.5em] uppercase opacity-60 text-cyan-300 bg-black/40 backdrop-blur-2xl px-10 -mx-10 mt-4 border-t border-cyan-500/10">
          <div className="flex gap-12">
            <span className="flex items-center gap-3"><span className={`w-2.5 h-2.5 rounded-full ${isLive ? 'bg-emerald-500 shadow-[0_0_12px_#10b981]' : 'bg-red-500 opacity-20'}`} /> ENGINE_STATE: {isLive ? 'ACTIVE' : 'IDLE'}</span>
            {peerConnected && <span className="flex items-center gap-3"><span className="w-2.5 h-2.5 bg-blue-500 rounded-full shadow-[0_0_8px_#3b82f6]" /> REMOTE_SYNC: ENCRYPTED</span>}
          </div>
          <div className="font-mono text-[9px] text-cyan-700 font-black">PRO_CORE_LENS_V6.0.1_STABLE_BUILD</div>
        </footer>
      </div>

      <canvas ref={canvasRef} className="hidden" />

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0, 0, 0, 0.1); }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #22d3ee; border-radius: 10px; }
        .hud-glow { text-shadow: 0 0 10px rgba(34, 211, 238, 0.6); }
        .scanline {
          width: 100%; height: 100px; z-index: 40;
          background: linear-gradient(0deg, rgba(0, 0, 0, 0) 0%, rgba(34, 211, 238, 0.05) 50%, rgba(0, 0, 0, 0) 100%);
          position: absolute; bottom: 100%; animation: scanline 8s linear infinite; pointer-events: none;
        }
        @keyframes scanline { 0% { bottom: 100%; } 100% { bottom: -100px; } }
      `}</style>
    </div>
  );
};

export default App;
