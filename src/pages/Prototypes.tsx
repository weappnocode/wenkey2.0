import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Wand2, Loader2, Sparkles as SparklesIcon, Target, Info, BookOpen, Filter, ArrowUpRight } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface OKRBenchmark {
    id: string;
    strategic_category: string;
    industry: string;
    objective_text: string;
    key_results: string[];
    impact_description: string;
}

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
    const [loading, setLoading] = useState(false);
    const [prompt, setPrompt] = useState('');
    const [answers, setAnswers] = useState({ area: '', problema: '', metrica: '', baseline: '', meta: '', prazo: '' });
    const [generatedOKR, setGeneratedOKR] = useState<GeneratedOKR | null>(null);
    const [activeTab, setActiveTab] = useState<'questionnaire' | 'free'>('questionnaire');

    const [benchmarks, setBenchmarks] = useState<OKRBenchmark[]>([]);
    const [loadingBenchmarks, setLoadingBenchmarks] = useState(true);
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [industryFilter, setIndustryFilter] = useState<string>('all');

    useEffect(() => {
        fetchBenchmarks();
    }, []);

    const fetchBenchmarks = async () => {
        setLoadingBenchmarks(true);
        try {
            const { data, error } = await supabase
                .from('okr_benchmarks' as any)
                .select('*')
                .order('strategic_category');
            if (error) throw error;
            setBenchmarks((data as any[]) || []);
        } catch (error) {
            console.error('Error fetching benchmarks:', error);
        } finally {
            setLoadingBenchmarks(false);
        }
    };

    const handleUseBenchmark = (benchmark: OKRBenchmark) => {
        const text = `Gostaria de criar um OKR focado em "${benchmark.strategic_category}" para meu setor.
Como inspiração, quero atingir algo parecido com o seguinte objetivo: "${benchmark.objective_text}".

Meus KRs devem focar nas diretrizes abaixo:
${benchmark.key_results.map(kr => `- ${kr}`).join('\n')}

Adapte este benchmark para a realidade da minha empresa com metas realistas e métricas claras.`;
        
        setPrompt(text);
        setActiveTab('free');
        
        toast({
            title: "Template Copiado!",
            description: "O benchmark foi copiado para a IA. Ajuste o que precisar e gere os OKRs.",
        });
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const filteredBenchmarks = benchmarks.filter(b => {
        const matchCat = categoryFilter === 'all' || b.strategic_category === categoryFilter;
        const matchInd = industryFilter === 'all' || b.industry === industryFilter;
        return matchCat && matchInd;
    });

    const uniqueCategories = Array.from(new Set(benchmarks.map(b => b.strategic_category)));
    const uniqueIndustries = Array.from(new Set(benchmarks.map(b => b.industry)));

    const handleGenerate = async (mode: 'free' | 'questionnaire') => {
        setLoading(true);
        setGeneratedOKR(null);
        try {
            const body = mode === 'free' ? { prompt } : { answers };
            const { data, error } = await supabase.functions.invoke('generate-okr', { body });

            if (error) throw error;
            setGeneratedOKR(data);
            toast({
                title: "OKRs Gerados!",
                description: "A IA criou uma proposta de OKRs baseada no seu contexto.",
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
                            <TabsList className="grid w-full grid-cols-2 h-8 text-xs">
                                <TabsTrigger value="questionnaire" className="text-xs">Questionário Guiado</TabsTrigger>
                                <TabsTrigger value="free" className="text-xs">Texto Livre</TabsTrigger>
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
                        </Tabs>

                        {generatedOKR && (
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
                                        OKRs gerados por IA. Use como ponto de partida e ajuste conforme a realidade do seu negócio.
                                    </p>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Benchmarks Section */}
                <Card className="overflow-hidden border-2 border-slate-200 dark:border-slate-800 shadow-lg">
                    <CardHeader className="border-b bg-slate-50/50 dark:bg-slate-900/50 py-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-emerald-500 rounded-lg shrink-0">
                                    <BookOpen className="h-5 w-5 text-white" />
                                </div>
                                <div>
                                    <CardTitle className="text-base">Biblioteca Estratégica</CardTitle>
                                    <CardDescription className="text-xs">
                                        Inspire-se em OKRs de alta performance. Clique em "Usar como Base" para enviar para a IA.
                                    </CardDescription>
                                </div>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-4 space-y-4">
                        <div className="flex gap-4 mb-4">
                            <div className="flex-1 space-y-1">
                                <label className="text-xs font-medium text-muted-foreground uppercase">Categoria Estratégica</label>
                                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                                    <SelectTrigger className="h-8 text-sm">
                                        <SelectValue placeholder="Todas" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todas as Categorias</SelectItem>
                                        {uniqueCategories.map(c => (
                                            <SelectItem key={c} value={c}>{c}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex-1 space-y-1">
                                <label className="text-xs font-medium text-muted-foreground uppercase">Setor</label>
                                <Select value={industryFilter} onValueChange={setIndustryFilter}>
                                    <SelectTrigger className="h-8 text-sm">
                                        <SelectValue placeholder="Todos" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todos os Setores</SelectItem>
                                        {uniqueIndustries.map(i => (
                                            <SelectItem key={i} value={i}>{i}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {loadingBenchmarks ? (
                            <div className="flex justify-center items-center py-8">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {filteredBenchmarks.map(benchmark => (
                                    <div key={benchmark.id} className="flex flex-col p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-800 transition-all bg-white dark:bg-slate-950/50 shadow-sm">
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="flex gap-2 flex-wrap">
                                                <Badge variant="secondary" className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-none font-medium px-2 py-0.5 text-[10px] uppercase">
                                                    {benchmark.industry}
                                                </Badge>
                                                <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-none dark:bg-emerald-900/40 dark:text-emerald-300 px-2 py-0.5 text-[10px] uppercase">
                                                    {benchmark.strategic_category}
                                                </Badge>
                                            </div>
                                            <Button 
                                                variant="ghost" 
                                                size="sm" 
                                                className="h-7 text-xs text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/30"
                                                onClick={() => handleUseBenchmark(benchmark)}
                                            >
                                                Usar como Base
                                                <ArrowUpRight className="ml-1 h-3 w-3" />
                                            </Button>
                                        </div>
                                        
                                        <div className="flex-1 space-y-4">
                                            <div>
                                                <h4 className="font-bold text-sm text-foreground line-clamp-2 leading-tight">
                                                    {benchmark.objective_text}
                                                </h4>
                                                <p className="text-xs text-muted-foreground mt-1.5 italic line-clamp-2">
                                                    "{benchmark.impact_description}"
                                                </p>
                                            </div>
                                            
                                            <div className="space-y-1.5 bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800/60">
                                                <p className="text-[10px] uppercase font-semibold text-slate-500 mb-1">Key Results Típicos</p>
                                                <ul className="space-y-1.5">
                                                    {benchmark.key_results.map((kr, idx) => (
                                                        <li key={idx} className="text-xs text-slate-700 dark:text-slate-300 flex items-start gap-1.5 leading-snug">
                                                            <Target className="h-3.5 w-3.5 mt-0.5 text-slate-400 shrink-0" />
                                                            <span>{kr}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {filteredBenchmarks.length === 0 && (
                                    <div className="col-span-1 md:col-span-2 text-center py-8 text-muted-foreground text-sm border-2 border-dashed rounded-xl border-slate-200 dark:border-slate-800">
                                        Nenhum benchmark encontrado para os filtros selecionados.
                                    </div>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </Layout>
    );
}
