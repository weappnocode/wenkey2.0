import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Wand2, Loader2, Sparkles as SparklesIcon, Target, Info, BookOpen, Filter, ArrowUpRight, CheckCircle2, AlertTriangle, BarChart2, BrainCircuit, Search } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import * as xlsx from 'xlsx';
import { useCompany } from '@/contexts/CompanyContext';

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
    const [loading, setLoading] = useState(false);
    const [prompt, setPrompt] = useState('');
    const [answers, setAnswers] = useState({ area: '', problema: '', metrica: '', baseline: '', meta: '', prazo: '' });
    const [generatedOKR, setGeneratedOKR] = useState<GeneratedOKR | null>(null);
    const [analysisLoading, setAnalysisLoading] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<any>(null);
    const [uploading, setUploading] = useState(false);
    const [activeTab, setActiveTab] = useState<'questionnaire' | 'free' | 'rag-upload'>('questionnaire');

    const downloadTemplate = () => {
        const ws = xlsx.utils.json_to_sheet([{
            strategic_category: 'Engenharia',
            industry: 'Tecnologia',
            objective_text: 'Criar uma cultura de engenharia de alta performance',
            key_results: JSON.stringify([
                { "title": "Aumentar deploy frequency", "target": 5, "unit": "deploys/dia" }
            ]),
            impact_description: 'Times entregando valor mais rápido e com menos bugs.',
            metric_type: 'processo',
            goal_direction: 'increase',
            complexity: 'high'
        }]);
        const wb = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(wb, ws, "Template_OKR_RAG");
        xlsx.writeFile(wb, "Template_OKR_RAG.xlsx");
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        try {
            const data = await file.arrayBuffer();
            const workbook = xlsx.read(data);
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            
            // Tentar ler com cabeçalho primeiro, se não encontrar colunas esperadas, tenta modo array (header: 1)
            let jsonData: any[] = xlsx.utils.sheet_to_json(sheet);
            const firstRow: any = jsonData[0] || {};
            const hasExpectedHeader = firstRow.strategic_category || firstRow.objective_text || firstRow.objective;

            if (!hasExpectedHeader) {
                console.log("Detectada planilha sem cabeçalho ou formato customizado. Usando mapeamento por índice.");
                jsonData = xlsx.utils.sheet_to_json(sheet, { header: 1 });
                // Remover linhas vazias no início se houver
                jsonData = jsonData.filter(row => Array.isArray(row) && row.length > 0);
            }

            if (jsonData.length === 0) throw new Error("A planilha está vazia.");

            toast({ title: "Processando Planilha", description: `Enviando ${jsonData.length} linhas para a IA (Gerando Embeddings)...` });

            const { data: resData, error: apiError } = await supabase.functions.invoke('seed-okr-benchmarks', {
                body: { benchmarks: jsonData }
            });

            if (apiError) throw apiError;
            
            if (resData.errors && resData.errors.length > 0) {
                console.warn("Erros parciais:", resData.errors);
                toast({ title: "Processado com Alertas", description: `Inseridas: ${resData.inserted}. Erros em ${resData.errors.length} linhas.`, variant: "default" });
            } else {
                toast({ title: "Sucesso!", description: `${resData.inserted} benchmarks inseridos na Base RAG.` });
            }
        } catch (error: any) {
            console.error("Erro no upload", error);
            toast({ title: "Erro no Upload", description: error.message || "Falha ao processar arquivo.", variant: "destructive" });
        } finally {
            setUploading(false);
            if (e.target) e.target.value = ''; // reset input
        }
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
                                <TabsTrigger value="rag-upload" className="text-xs">Alimentar Base (Excel)</TabsTrigger>
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
                                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-5 border border-slate-200 dark:border-slate-800 space-y-4">
                                    <div>
                                        <h3 className="font-semibold text-slate-800 dark:text-slate-200">1. Baixe o Template</h3>
                                        <p className="text-xs text-slate-500 mt-1">Preencha os exemplos reais de OKR na planilha e salve no formato XLSX.</p>
                                        <Button onClick={downloadTemplate} variant="outline" className="mt-3 gap-2 h-9 text-indigo-600 dark:text-indigo-400">
                                            <BookOpen className="h-4 w-4" />
                                            Baixar Template .xlsx
                                        </Button>
                                    </div>
                                    <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                                        <h3 className="font-semibold text-slate-800 dark:text-slate-200">2. Faça o Upload</h3>
                                        <p className="text-xs text-slate-500 mt-1">Nós geraremos inteligência artificial (Embeddings) para cada linha.</p>
                                        <div className="mt-3 relative">
                                            <Input 
                                                type="file" 
                                                accept=".xlsx, .xls"
                                                onChange={handleFileUpload}
                                                disabled={uploading}
                                                className="cursor-pointer file:bg-indigo-50 file:text-indigo-700 file:border-0 file:rounded-md file:px-3 file:py-1 file:mr-3 file:font-semibold hover:file:bg-indigo-100 dark:file:bg-indigo-900/40 dark:file:text-indigo-300 transition-colors h-11 pt-2"
                                            />
                                            {uploading && (
                                                <div className="absolute top-1/2 right-3 -translate-y-1/2">
                                                    <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
                                                </div>
                                            )}
                                        </div>
                                    </div>
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
