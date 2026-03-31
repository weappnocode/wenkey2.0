import { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, TrendingUp, Sparkles, Play, Pause, Volume2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';

export interface ObjectiveData {
    nome_objetivo: string;
    descricao_objetivo?: string;
    key_results: {
        titulo: string;
        meta: number | string;
        resultado_atual: number | string;
        percentual_atingimento: number | string;
        historico_checkins: { data: string; valor: number | string }[];
    }[];
}

export interface AIAnalysisContextData {
    quarter: string;
    quarter_status: 'ongoing' | 'closed';
    data_checkin_atual?: string;
    data_ultimo_checkin_quarter?: string;
    objetivos: ObjectiveData[];
    company_segment?: string;
    user_area?: string;
}

interface OKRAnalysisDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    contextData: AIAnalysisContextData | null;
    autoAnalyze?: boolean;
    userName?: string;
}

// Strip markdown syntax for TTS
function stripMarkdown(text: string): string {
    return text
        .replace(/#{1,6}\s+/g, '')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\*([^*]+)\*/g, '$1')
        .replace(/`[^`]+`/g, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/^[-*+]\s+/gm, '')
        .replace(/^\d+\.\s+/gm, '')
        .replace(/^>\s+/gm, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function getFirstName(fullName?: string): string {
    if (!fullName) return '';
    return fullName.trim().split(/\s+/)[0];
}

function formatTime(seconds: number): string {
    if (!isFinite(seconds) || isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

export function OKRAnalysisDialog({
    open,
    onOpenChange,
    contextData,
    autoAnalyze = false,
    userName,
}: OKRAnalysisDialogProps) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [analysisText, setAnalysisText] = useState<string | null>(null);

    // TTS states
    const [ttsLoading, setTtsLoading] = useState(false);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isDragging, setIsDragging] = useState(false);

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const progressBarRef = useRef<HTMLDivElement>(null);
    const prevAudioUrl = useRef<string | null>(null);

    useEffect(() => {
        if (open && autoAnalyze && !analysisText && !loading && contextData) {
            handleAnalyze();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, autoAnalyze, contextData]);

    // Cleanup audio URL on unmount / close
    useEffect(() => {
        if (!open) {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
            if (prevAudioUrl.current) {
                URL.revokeObjectURL(prevAudioUrl.current);
                prevAudioUrl.current = null;
            }
            setAudioUrl(null);
            setIsPlaying(false);
            setCurrentTime(0);
            setDuration(0);
        }
    }, [open]);

    const handleAnalyze = async () => {
        if (!contextData) return;

        setLoading(true);
        setAnalysisText(null);
        // Reset audio when re-analyzing
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
        }
        if (prevAudioUrl.current) {
            URL.revokeObjectURL(prevAudioUrl.current);
            prevAudioUrl.current = null;
        }
        setAudioUrl(null);
        setIsPlaying(false);
        setCurrentTime(0);
        setDuration(0);

        try {
            const { data, error } = await supabase.functions.invoke('analyze-okr', {
                body: { contextData }
            });

            if (error) throw error;

            if (data?.analysis) {
                setAnalysisText(data.analysis);
            } else if (data?.error) {
                throw new Error(data.error);
            } else {
                throw new Error('Retorno inválido da IA');
            }
        } catch (error: any) {
            let errorMessage = error.message || 'Não foi possível gerar a análise no momento.';
            if (error instanceof Error && error.message.includes('non-2xx')) {
                try {
                    const errorBody = await (error as any).context?.json();
                    if (errorBody?.error) {
                        errorMessage = errorBody.error;
                    }
                } catch (_) { /* ignore */ }
            }

            console.error('Erro na análise da IA:', error);
            toast({
                title: 'Erro na Análise',
                description: errorMessage,
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    // Auto-trigger TTS when analysis text arrives
    useEffect(() => {
        if (analysisText && !audioUrl && !ttsLoading) {
            generateSpeech(analysisText);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [analysisText]);

    const generateSpeech = async (text: string) => {
        setTtsLoading(true);
        try {
            const firstName = getFirstName(userName);
            const greeting = firstName
                ? `Olá, ${firstName}. Vou fazer uma breve análise dos seus OKRs. `
                : `Vou fazer uma breve análise dos seus OKRs. `;

            const plainText = greeting + stripMarkdown(text);

            // Call the edge function and get binary audio
            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData?.session?.access_token;

            const supabaseUrl = (supabase as any).supabaseUrl as string;
            const supabaseKey = (supabase as any).supabaseKey as string;

            const response = await fetch(`${supabaseUrl}/functions/v1/generate-speech`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token || supabaseKey}`,
                    'apikey': supabaseKey,
                },
                body: JSON.stringify({ text: plainText, voice: 'nova' }),
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || `TTS error: ${response.status}`);
            }

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);

            // Cleanup previous URL
            if (prevAudioUrl.current) {
                URL.revokeObjectURL(prevAudioUrl.current);
            }
            prevAudioUrl.current = url;
            setAudioUrl(url);
        } catch (err: any) {
            console.error('TTS error:', err);
            toast({
                title: 'Erro no áudio',
                description: err.message || 'Não foi possível gerar o áudio.',
                variant: 'destructive',
            });
        } finally {
            setTtsLoading(false);
        }
    };

    // Setup audio element when audioUrl changes
    useEffect(() => {
        if (!audioUrl) return;

        const audio = new Audio(audioUrl);
        audioRef.current = audio;

        audio.addEventListener('timeupdate', () => {
            if (!isDragging) setCurrentTime(audio.currentTime);
        });
        audio.addEventListener('loadedmetadata', () => {
            setDuration(audio.duration);
        });
        audio.addEventListener('ended', () => {
            setIsPlaying(false);
            setCurrentTime(0);
        });
        audio.addEventListener('play', () => setIsPlaying(true));
        audio.addEventListener('pause', () => setIsPlaying(false));

        // Auto-play when loaded
        audio.play().catch(() => { /* autoplay may be blocked */ });

        return () => {
            audio.pause();
            audio.src = '';
        };
    }, [audioUrl]); // eslint-disable-line react-hooks/exhaustive-deps

    const togglePlay = useCallback(() => {
        const audio = audioRef.current;
        if (!audio) return;
        if (audio.paused) {
            audio.play();
        } else {
            audio.pause();
        }
    }, []);

    const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        const audio = audioRef.current;
        const bar = progressBarRef.current;
        if (!audio || !bar || !duration) return;

        const rect = bar.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        audio.currentTime = ratio * duration;
        setCurrentTime(audio.currentTime);
    }, [duration]);

    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] max-h-[85vh] flex flex-col p-6">
                <DialogHeader className="pb-4 border-b shrink-0">
                    <div className="flex items-center justify-between gap-3">
                        {/* Left: icon + title */}
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                <TrendingUp className="w-5 h-5 text-primary" />
                            </div>
                            <div className="min-w-0">
                                <DialogTitle className="text-xl font-bold flex items-center gap-2">
                                    Visão do Analista <Sparkles className="w-4 h-4 text-amber-500" />
                                </DialogTitle>
                                <p className="text-sm text-muted-foreground mt-0.5">Análise estratégica baseada na IA</p>
                            </div>
                        </div>

                        {/* Right: Audio Player OR loading indicator */}
                        {analysisText && (
                            <div className="shrink-0 mr-7">
                                {ttsLoading ? (
                                    /* TTS generating */
                                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/5 border border-primary/20">
                                        <Loader2 className="w-4 h-4 text-primary animate-spin" />
                                        <span className="text-xs text-primary font-medium whitespace-nowrap">Gerando áudio...</span>
                                    </div>
                                ) : audioUrl ? (
                                    /* Premium Audio Player */
                                    <div
                                        className="flex items-center gap-2 px-3 py-2 rounded-xl border"
                                        style={{
                                            background: 'linear-gradient(135deg, hsl(221 83% 10% / 0.08) 0%, hsl(221 83% 53% / 0.12) 100%)',
                                            borderColor: 'hsl(221 83% 53% / 0.25)',
                                            minWidth: '220px',
                                        }}
                                    >
                                        {/* Play/Pause */}
                                        <button
                                            onClick={togglePlay}
                                            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all duration-200 hover:scale-110 active:scale-95"
                                            style={{ background: 'hsl(221 83% 53%)' }}
                                            title={isPlaying ? 'Pausar' : 'Reproduzir'}
                                        >
                                            {isPlaying
                                                ? <Pause className="w-3.5 h-3.5 text-white fill-white" />
                                                : <Play className="w-3.5 h-3.5 text-white fill-white ml-0.5" />
                                            }
                                        </button>

                                        {/* Progress bar area */}
                                        <div className="flex-1 flex flex-col gap-1 min-w-0">
                                            {/* Waveform-style progress bar */}
                                            <div
                                                ref={progressBarRef}
                                                className="relative h-2 rounded-full cursor-pointer overflow-hidden"
                                                style={{ background: 'hsl(221 83% 53% / 0.15)' }}
                                                onClick={handleProgressClick}
                                            >
                                                <div
                                                    className="absolute inset-y-0 left-0 rounded-full transition-none"
                                                    style={{
                                                        width: `${progress}%`,
                                                        background: 'linear-gradient(90deg, hsl(221 83% 53%), hsl(200 100% 60%))',
                                                    }}
                                                />
                                                {/* Thumb */}
                                                <div
                                                    className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full shadow-md transition-none"
                                                    style={{
                                                        left: `calc(${progress}% - 6px)`,
                                                        background: 'white',
                                                        border: '2px solid hsl(221 83% 53%)',
                                                    }}
                                                />
                                            </div>

                                            {/* Time */}
                                            <div className="flex justify-between">
                                                <span className="text-[10px] text-primary/70 font-mono">{formatTime(currentTime)}</span>
                                                <span className="text-[10px] text-primary/50 font-mono">{formatTime(duration)}</span>
                                            </div>
                                        </div>

                                        {/* Volume icon - decorative */}
                                        <Volume2 className="w-3.5 h-3.5 shrink-0" style={{ color: 'hsl(221 83% 53%)' }} />
                                    </div>
                                ) : null}
                            </div>
                        )}
                    </div>
                </DialogHeader>

                <div className="flex-1 pr-2 mt-4 overflow-y-auto custom-scrollbar min-h-0">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center space-y-4">
                            <div className="relative">
                                <Loader2 className="w-10 h-10 text-primary animate-spin" />
                                <Sparkles className="w-4 h-4 text-amber-500 absolute -top-1 -right-1 animate-pulse" />
                            </div>
                            <p className="text-sm text-muted-foreground max-w-[250px]">
                                O Analista Virtual está analisando o desempenho, tendências e riscos... isso leva poucos segundos.
                            </p>
                        </div>
                    ) : analysisText ? (
                        <div className="max-w-none pb-6">
                            <ReactMarkdown
                                remarkPlugins={[remarkGfm, remarkBreaks]}
                                components={{
                                    h2: ({ children }) => (
                                        <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'inherit', marginTop: '24px', marginBottom: '8px' }}>
                                            {children}
                                        </h2>
                                    ),
                                    h3: ({ children }) => (
                                        <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'inherit', marginTop: '24px', marginBottom: '8px' }}>
                                            {children}
                                        </h3>
                                    ),
                                    h4: ({ children }) => (
                                        <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#3b82f6', marginTop: '16px', marginBottom: '4px' }}>
                                            {children}
                                        </h4>
                                    ),
                                    p: ({ children }) => (
                                        <p style={{ fontSize: '14px', fontWeight: 400, color: '#111827', marginBottom: '12px', lineHeight: '1.7' }}>
                                            {children}
                                        </p>
                                    ),
                                    strong: ({ children }) => (
                                        <strong style={{ fontWeight: 700 }}>{children}</strong>
                                    ),
                                }}
                            >
                                {analysisText}
                            </ReactMarkdown>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center space-y-4">
                            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                                <Sparkles className="w-8 h-8 text-muted-foreground" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold">Pronto para Analisar</h3>
                                <p className="text-sm text-muted-foreground max-w-[300px] mt-2 mb-6">
                                    Inicie a análise para obter insights estratégicos sobre o desempenho esperado para este período.
                                </p>
                                <Button onClick={handleAnalyze} className="gap-2">
                                    <Sparkles className="w-4 h-4" />
                                    Gerar Análise Estratégica
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
