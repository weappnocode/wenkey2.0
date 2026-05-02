import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { TrendingUp, History } from 'lucide-react';
import { useDashboardChartData } from '@/hooks/useDashboardChartData';
import { ObjectiveLineChart } from '@/components/ObjectiveLineChart';
import { toTitleCase } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { RankingHistoryChart } from './RankingHistoryChart';

export function DashboardProgressChart({ filterOwnerId }: { filterOwnerId?: string | null }) {
    const { data, isLoading } = useDashboardChartData(filterOwnerId);

    return (
        <Card className="md:col-span-2 xl:col-span-2 flex flex-col group overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="flex flex-col gap-1">
                    <p className="text-base font-semibold text-black leading-none">{toTitleCase('Progresso no Quarter')}</p>
                    <p className="text-xs text-muted-foreground">Evolução dos check-ins</p>
                </div>
                <div className="flex items-center gap-2">
                    <Dialog>
                        <DialogTrigger asChild>
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-8 text-xs gap-2 border-primary/20 hover:border-primary/50 hover:bg-primary/5 text-primary"
                            >
                                <History className="w-3.5 h-3.5" />
                                Histórico de Ranking
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-7xl h-[90vh] flex flex-col p-6 overflow-hidden">
                            <DialogHeader className="pb-4 border-b">
                                <DialogTitle className="text-xl font-bold flex items-center gap-2">
                                    <TrendingUp className="w-5 h-5 text-primary" />
                                    Evolução de Ranking e Performance
                                </DialogTitle>
                                <p className="text-sm text-muted-foreground">
                                    Visualize a trajetória de todos os colaboradores ao longo deste quarter.
                                </p>
                            </DialogHeader>
                            <div className="flex-1 overflow-y-auto py-4">
                                <RankingHistoryChart />
                            </div>
                        </DialogContent>
                    </Dialog>
                    <div className="rounded-full bg-muted p-2.5 text-primary group-hover:bg-primary/10 transition-colors">
                        <TrendingUp className="h-4 w-4" />
                    </div>
                </div>
            </CardHeader>
            <CardContent className="pt-2 pb-2 flex-1 flex flex-col justify-end min-h-[220px]">
                {isLoading ? (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground animate-pulse">
                        Carregando gráfico...
                    </div>
                ) : !data || data.checkins.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground bg-muted/10 rounded-lg border border-dashed m-2">
                        Nenhum check-in no quarter.
                    </div>
                ) : (
                    <div className="h-full w-full animate-in zoom-in-95 fade-in duration-700 fill-mode-both" style={{ animationDelay: '300ms' }}>
                        <ObjectiveLineChart
                            checkins={data.checkins}
                            averages={data.averages}
                            showDates={true}
                        />
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
