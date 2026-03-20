import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';
import { useDashboardChartData } from '@/hooks/useDashboardChartData';
import { ObjectiveLineChart } from '@/components/ObjectiveLineChart';
import { toTitleCase } from '@/lib/utils';

export function DashboardProgressChart({ filterOwnerId }: { filterOwnerId?: string | null }) {
    const { data, isLoading } = useDashboardChartData(filterOwnerId);

    return (
        <Card className="md:col-span-2 xl:col-span-2 flex flex-col h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                    <p className="text-base text-black">{toTitleCase('Progresso no Quarter')}</p>
                    <p className="text-sm text-muted-foreground mt-1">Evolução dos check-ins</p>
                </div>
                <div className="rounded-full bg-muted p-3 text-primary">
                    <TrendingUp className="h-5 w-5" />
                </div>
            </CardHeader>
            <CardContent className="pt-4 pb-4 flex-1 flex flex-col justify-end min-h-[140px]">
                {isLoading ? (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                        Carregando gráfico...
                    </div>
                ) : !data || data.checkins.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
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
