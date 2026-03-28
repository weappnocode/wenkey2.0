import { useState, useRef } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Wand2, Loader2, Sparkles as SparklesIcon, Target, Info, BookOpen, CheckCircle2, AlertTriangle, BarChart2, BrainCircuit, Search, UploadCloud, FileText, FileSpreadsheet, File, X } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import * as xlsx from 'xlsx';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
interface GeneratedOKR {
    objective: string;
    description: string;
    key_results: {
        title: string;
        target: number;
        unit: string;
        type: string;
        direction: string;
    }[];
}

export default function Prototypes() {
    const { toast } = useToast();
    const { selectedCompany } = useCompany();
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [prompt, setPrompt] = useState('');
    const [answers, setAnswers] = useState({ area: '', problema: '', metrica: '', baseline: '', meta: '', prazo: '' });
    const [generatedOKR, setGeneratedOKR] = useState<GeneratedOKR | null>(null);
    const [analysisLoading, setAnalysisLoading] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<any>(null);
    const [uploading, setUploading] = useState(false);
    const [activeTab, setActiveTab] = useState<'questionnaire' | 'free' | 'rag-upload'>('questionnaire');
    const [dragOver, setDragOver] = useState(false);
    const [uploadResult, setUploadResult] = useState<{ inserted: number; errors: number; filename: string } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const ACCEPTED_TYPES = '.pdf,.xlsx,.xls,.txt,.csv,.md,.doc,.docx';
    const ACCEPTED_LABELS = ['PDF', 'XLSX', 'XLS', 'TXT', 'CSV', 'MD', 'DOC', 'DOCX'];

    const getFileIcon = (name: string) => {
        if (name.endsWith('.pdf')) return <FileText className="h-5 w-5 text-red-500" />;
        if (name.endsWith('.xlsx') || name.endsWith('.xls')) return <FileSpreadsheet className="h-5 w-5 text-emerald-500" />;
        return <File className="h-5 w-5 text-indigo-400" />;
    };

    const processFileUpload = async (file: File) => {
        if (!file) return;
        setUploading(true);
        setUploadResult(null);

        toast({ title: '📤 Enviando arquivo...', description: `${file.name} (${(file.size / 1024).toFixed(0)} KB)` });

        try {
            const formData = new FormData();
            formData.append('file', file);

            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData.session?.access_token;

            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
            const res = await fetch(`${supabaseUrl}/functions/v1/ingest-document`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: formData
            });

            const json = await res.json();
            if (!res.ok) throw new Error(json.error || `Erro ${res.status}`);

            setUploadResult({ inserted: json.inserted, errors: json.errors, filename: file.name });
            toast({
                title: '✅ Documento ingerido!',
                description: `${json.inserted} chunks adicionados ao RAG${json.errors > 0 ? ` (${json.errors} com erro)` : ''}.`
            });
        } catch (error: any) {
            console.error('Erro no upload', error);
            toast({ title: 'Erro no Upload', description: error.message || 'Falha ao processar arquivo.', variant: 'destructive' });
        } finally {
            setUploading(false);
        }
    };

    const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) processFileUpload(file);
        if (e.target) e.target.value = '';
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) processFileUpload(file);
    };


    const handleGenerate = async (mode: 'free' | 'questionnaire') => {
        setLoading(true);
        setGeneratedOKR(null);
        setAnalysisResult(null);
        try {
            const body = mode === 'free' 
                ? { prompt, company_segment: selectedCompany?.business_segment } 
                : { answers, company_segment: selectedCompany?.business_segment };
            
            const { data: okrData, error: okrError } = await supabase.functions.invoke('generate-okr', { body });

            if (okrError) throw okrError;
            setGeneratedOKR(okrData);
            
            setAnalysisLoading(true);
            const { data: analysisData, error: analysisError } = await supabase.functions.invoke('analyze-okr-intelligence', {
                body: { 
                    generatedOKR: okrData, 
                    answers: mode === 'free' ? { problema: prompt } : answers,
                    company_segment: selectedCompany?.business_segment 
                }
            });

            if (analysisError) {
                console.error("Erro na análise:", analysisError);
            } else {
                setAnalysisResult(analysisData);
            }

            toast({
                title: "OKRs Gerados!",
                description: "A IA criou uma proposta e efetuou a análise crítica estratégica.",
            });
        } catch (error: any) {
            console.error('Error generating OKR:', error);
            toast({
                title: "Erro ao gerar OKRs",
                description: error.message || "Ocorreu um erro inesperado.",
                variant: "destructive"
            });
        } finally {
            setLoading(false);
            setAnalysisLoading(false);
        }
    };

    if (user?.email !== 'wendelmorais@grupordz.com') {
        return <Navigate to="/" replace />;
    }

    return (
        <Layout>
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight">
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500">
                            Laboratório
                        </span>
                    </h1>
                    <p className="text-muted-foreground mt-1 text-sm">
                        Experimentos e ferramentas em desenvolvimento.
                    </p>
                </div>

                <Card className="overflow-hidden border-2 border-indigo-500/20 shadow-xl bg-gradient-to-br from-white to-indigo-50/30 dark:from-slate-900 dark:to-indigo-950/20">
                    <CardHeader className="border-b bg-white/50 dark:bg-slate-900/50 py-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-500 rounded-lg shrink-0">
                                <Wand2 className="h-5 w-5 text-white" />
                            </div>
                            <div>
                                <CardTitle className="text-base">Gerador de OKRs com IA</CardTitle>
                                <CardDescription className="text-xs">
                                    Transforme suas ideias em objetivos e resultados mensuráveis.
                                </CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-4">
                        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-4">
                            <TabsList className="grid w-full grid-cols-3 h-8 text-xs">
                                <TabsTrigger value="questionnaire" className="text-xs">Questionário Guiado</TabsTrigger>
                                <TabsTrigger value="free" className="text-xs">Texto Livre</TabsTrigger>
                                <TabsTrigger value="rag-upload" className="text-xs flex items-center gap-1"><UploadCloud className="h-3 w-3" />Base de Conhecimento</TabsTrigger>
                            </TabsList>

                            <TabsContent value="questionnaire" className="space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Área / Setor</label>
                                        <Input
                                            className="h-8 text-sm"
                                            placeholder="Ex: Vendas, Produto, RH..."
                                            value={answers.area}
                                            onChange={(e) => setAnswers({ ...answers, area: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Prazo</label>
                                        <Input
                                            className="h-8 text-sm"
                                            placeholder="Ex: Q2 2025, 3 meses..."
                                            value={answers.prazo}
                                            onChange={(e) => setAnswers({ ...answers, prazo: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Problema ou oportunidade</label>
                                    <Textarea
                                        className="text-sm resize-none min-h-[60px]"
                                        placeholder="Ex: Alta taxa de cancelamento de clientes..."
                                        value={answers.problema}
                                        onChange={(e) => setAnswers({ ...answers, problema: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Métrica principal</label>
                                    <Input
                                        className="h-8 text-sm"
                                        placeholder="Ex: Taxa de churn, Receita mensal, NPS..."
                                        value={answers.metrica}
                                        onChange={(e) => setAnswers({ ...answers, metrica: e.target.value })}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Valor atual (baseline)</label>
                                        <Input
                                            className="h-8 text-sm"
                                            placeholder="Ex: 15%, R$ 50.000..."
                                            value={answers.baseline}
                                            onChange={(e) => setAnswers({ ...answers, baseline: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Meta desejada</label>
                                        <Input
                                            className="h-8 text-sm"
                                            placeholder="Ex: 5%, R$ 120.000..."
                                            value={answers.meta}
                                            onChange={(e) => setAnswers({ ...answers, meta: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <Button
                                    onClick={() => handleGenerate('questionnaire')}
                                    disabled={loading || !answers.area.trim() || !answers.problema.trim()}
                                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white gap-2 h-9"
                                >
                                    {loading ? <Loader2 className="animate-spin h-4 w-4" /> : <SparklesIcon className="h-4 w-4" />}
                                    Gerar OKRs Estratégicos
                                </Button>
                            </TabsContent>

                            <TabsContent value="free" className="space-y-3">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Descreva o que você quer alcançar:</label>
                                    <Textarea
                                        placeholder="Ex: Quero aumentar as vendas em 20% no próximo quarter focando em novos clientes do setor de tecnologia."
                                        className="min-h-[100px] resize-none text-sm"
                                        value={prompt}
                                        onChange={(e) => setPrompt(e.target.value)}
                                    />
                                </div>
                                <Button
                                    onClick={() => handleGenerate('free')}
                                    disabled={loading || !prompt.trim()}
                                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white gap-2 h-9"
                                >
                                    {loading ? <Loader2 className="animate-spin h-4 w-4" /> : <SparklesIcon className="h-4 w-4" />}
                                    Gerar OKRs com IA
                                </Button>
                            </TabsContent>

                            <TabsContent value="rag-upload" className="space-y-4">
                                {/* Drag & Drop Zone */}
                                <div
                                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                                    onDragLeave={() => setDragOver(false)}
                                    onDrop={handleDrop}
                                    onClick={() => !uploading && fileInputRef.current?.click()}
                                    className={`relative flex flex-col items-center justify-center gap-3 p-8 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200
                                        ${ dragOver
                                            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30 scale-[1.01]'
                                            : 'border-slate-200 dark:border-slate-700 hover:border-indigo-400 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 bg-slate-50/50 dark:bg-slate-900/30'
                                        } ${uploading ? 'pointer-events-none opacity-60' : ''}`}
                                >
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept={ACCEPTED_TYPES}
                                        className="hidden"
                                        onChange={handleFileInputChange}
                                        disabled={uploading}
                                    />

                                    {uploading ? (
                                        <>
                                            <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
                                            <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400">Processando e gerando embeddings...</p>
                                            <p className="text-xs text-slate-400">Isso pode levar alguns segundos</p>
                                        </>
                                    ) : (
                                        <>
                                            <div className="p-3 bg-indigo-100 dark:bg-indigo-900/40 rounded-full">
                                                <UploadCloud className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
                                            </div>
                                            <div className="text-center">
                                                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                                    Arraste um arquivo ou <span className="text-indigo-600 dark:text-indigo-400 underline">clique para selecionar</span>
                                                </p>
                                                <p className="text-xs text-slate-400 mt-1">
                                                    Suportado: {ACCEPTED_LABELS.join(', ')}
                                                </p>
                                            </div>
                                        </>
                                    )}
                                </div>

                                {/* Success Result */}
                                {uploadResult && !uploading && (
                                    <div className="flex items-start gap-3 p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 animate-in fade-in slide-in-from-bottom-2 duration-400">
                                        <div className="shrink-0">{getFileIcon(uploadResult.filename)}</div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200 truncate">{uploadResult.filename}</p>
                                            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
                                                ✅ {uploadResult.inserted} chunks adicionados ao RAG
                                                {uploadResult.errors > 0 && ` · ⚠️ ${uploadResult.errors} com erro`}
                                            </p>
                                        </div>
                                        <button onClick={() => setUploadResult(null)} className="shrink-0 text-slate-400 hover:text-slate-600">
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                )}

                                {/* Info note */}
                                <div className="flex gap-2 items-start p-3 rounded-lg bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                                    <Info className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                        O conteúdo do arquivo será dividido em trechos, vetorizado e armazenado na base RAG. A IA usará esses dados automaticamente ao gerar OKRs.
                                    </p>
                                </div>
                            </TabsContent>
                        </Tabs>

                        {generatedOKR && activeTab !== 'rag-upload' && (
                            <div className="mt-6 space-y-4 pt-6 border-t animate-in fade-in zoom-in duration-500">
                                <div className="space-y-1">
                                    <h3 className="text-base font-bold text-indigo-600 flex items-center gap-2">
                                        <Target className="h-4 w-4 shrink-0" />
                                        {generatedOKR.objective}
                                    </h3>
                                    <p className="text-muted-foreground italic text-xs pl-6">
                                        "{generatedOKR.description}"
                                    </p>
                                </div>

                                <div className="grid gap-2">
                                    {generatedOKR.key_results.map((kr, idx) => (
                                        <div key={idx} className="p-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 hover:border-indigo-200 dark:hover:border-indigo-900 transition-colors">
                                            <p className="font-medium text-sm text-slate-900 dark:text-slate-100">{kr.title}</p>
                                            <div className="flex gap-2 items-center mt-1">
                                                <Badge variant="outline" className="text-[10px] uppercase tracking-wider px-1.5 py-0">
                                                    {kr.type}
                                                </Badge>
                                                <span className="text-xs text-muted-foreground">
                                                    {kr.direction === 'increase' ? 'Aumentar para' : 'Reduzir para'} {kr.target} {kr.unit}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="bg-amber-50 dark:bg-amber-950/20 p-3 rounded-lg border border-amber-200 dark:border-amber-900/50 flex gap-2">
                                    <Info className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                                    <p className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
                                        Esses OKRs são baseados em benchmarks de mercado (RAG). Analise-os conforme seu modelo de negócios.
                                    </p>
                                </div>
                                
                                {/* Seção de Análise Crítica */}
                                <div className="mt-8 pt-6 border-t border-indigo-100 dark:border-indigo-900/40">
                                    <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-4">
                                        <Search className="h-5 w-5 text-indigo-500" />
                                        Análise crítica gerada:
                                    </h3>
                                    
                                    {analysisLoading ? (
                                        <div className="flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
                                            <Loader2 className="h-6 w-6 animate-spin text-indigo-500 mb-2" />
                                            <p className="text-sm text-slate-500">Executando Cognitive Engine...</p>
                                        </div>
                                    ) : analysisResult ? (
                                        <div className="space-y-6">
                                            <div className="flex items-center gap-3 bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm">
                                                <BarChart2 className="h-6 w-6 text-indigo-500" />
                                                <div>
                                                    <p className="font-semibold text-slate-900 dark:text-slate-100 text-lg">Score geral: <span className={analysisResult.general_score >= 8 ? 'text-emerald-600' : analysisResult.general_score >= 6 ? 'text-amber-500' : 'text-rose-500'}>{analysisResult.general_score.toFixed(1)} / 10</span></p>
                                                    <p className="text-xs text-slate-500 uppercase tracking-widest font-medium mt-0.5">Força Estratégica: {analysisResult.strength}</p>
                                                </div>
                                            </div>

                                            <div className="space-y-4 px-2">
                                                <h4 className="font-bold flex items-center gap-2 text-slate-800 dark:text-slate-100 text-sm">
                                                    <BrainCircuit className="h-5 w-5 text-pink-500" />
                                                    Diagnóstico:
                                                </h4>
                                                
                                                <div className="space-y-5">
                                                    {[
                                                        { key: 'clarity', label: 'Clareza' },
                                                        { key: 'measurability', label: 'Mensurabilidade' },
                                                        { key: 'outcome_vs_output', label: 'Outcome vs Output' },
                                                        { key: 'ambition', label: 'Ambição' },
                                                        { key: 'alignment', label: 'Alinhamento estratégico' }
                                                    ].map(dim => {
                                                        const detail = analysisResult.diagnostics[dim.key] || { score: 0, feedback: 'Sem dados.' };
                                                        const isGood = detail.score >= 8;
                                                        return (
                                                            <div key={dim.key} className="space-y-1">
                                                                <div className="flex items-center gap-2">
                                                                    {isGood ? (
                                                                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                                                    ) : (
                                                                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                                                                    )}
                                                                    <p className="font-bold text-sm text-slate-800 dark:text-slate-200">{dim.label} ({detail.score}/10)</p>
                                                                </div>
                                                                <p className="text-sm text-slate-600 dark:text-slate-400 pl-6">{detail.feedback}</p>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            {analysisResult.improvement_suggestions?.length > 0 && (
                                              <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4 border border-slate-200 dark:border-slate-800">
                                                  <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200 mb-3">Sugestões de Ajuste:</h4>
                                                  <ul className="space-y-2">
                                                      {analysisResult.improvement_suggestions.map((sug: string, i: number) => (
                                                          <li key={i} className="text-sm text-slate-600 dark:text-slate-400 flex gap-2 items-start">
                                                              <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
                                                              <span>{sug}</span>
                                                          </li>
                                                      ))}
                                                  </ul>
                                              </div>
                                            )}
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>


            </div>
        </Layout>
    );
}
