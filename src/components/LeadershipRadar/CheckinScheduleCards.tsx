import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Mail, Clock, CalendarDays, Save, Lock, Info } from 'lucide-react';

const HOURS_BEFORE_OPTIONS = [
    { value: '3',  label: '3 horas antes' },
    { value: '6',  label: '6 horas antes' },
    { value: '12', label: '12 horas antes' },
    { value: '24', label: '24 horas antes (1 dia)' },
    { value: '48', label: '48 horas antes (2 dias)' },
    { value: '72', label: '72 horas antes (3 dias)' },
];

interface CheckinSettings {
    // radar email
    radar_email_enabled: boolean;
    radar_email_hours_before: number;
    // platform lock
    platform_lock_enabled: boolean;
    platform_lock_hours_before: number;
}

interface CheckinScheduleCardsProps {
    companyId: string;
    nextCheckinDate?: string | null; // ISO date string from quarter/checkin
}

const db = supabase as any;

export function CheckinScheduleCards({ companyId, nextCheckinDate }: CheckinScheduleCardsProps) {
    const { user } = useAuth();
    const [settings, setSettings] = useState<CheckinSettings>({
        radar_email_enabled: false,
        radar_email_hours_before: 24,
        platform_lock_enabled: false,
        platform_lock_hours_before: 24,
    });
    const [loading, setLoading] = useState(true);
    const [savingRadar, setSavingRadar] = useState(false);
    const [savingLock, setSavingLock] = useState(false);

    const loadSettings = useCallback(async () => {
        if (!companyId) return;
        setLoading(true);
        try {
            const { data } = await db
                .from('companies')
                .select('radar_email_enabled, radar_email_hours_before, platform_lock_enabled, platform_lock_hours_before')
                .eq('id', companyId)
                .single();

            if (data) {
                setSettings({
                    radar_email_enabled: data.radar_email_enabled ?? false,
                    radar_email_hours_before: data.radar_email_hours_before ?? 24,
                    platform_lock_enabled: data.platform_lock_enabled ?? false,
                    platform_lock_hours_before: data.platform_lock_hours_before ?? 24,
                });
            }
        } catch (err) {
            console.error('[CheckinScheduleCards] load error:', err);
        } finally {
            setLoading(false);
        }
    }, [companyId]);

    useEffect(() => {
        loadSettings();
    }, [loadSettings]);

    // Calculate and display the computed send time in BRT
    const computeSendTime = (hoursBeforeCheckin: number): string => {
        if (!nextCheckinDate) return '—';
        // Checkin date is stored as a date string (YYYY-MM-DD) — treat as midnight BRT (UTC-3 = UTC+3h)
        const checkinUTC = new Date(`${nextCheckinDate}T00:00:00-03:00`);
        const sendUTC = new Date(checkinUTC.getTime() - hoursBeforeCheckin * 60 * 60 * 1000);
        return sendUTC.toLocaleString('pt-BR', {
            timeZone: 'America/Sao_Paulo',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const handleSaveRadar = async () => {
        if (!companyId || !user) return;
        setSavingRadar(true);
        try {
            const { error } = await db
                .from('companies')
                .update({
                    radar_email_enabled: settings.radar_email_enabled,
                    radar_email_hours_before: settings.radar_email_hours_before,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', companyId);
            if (error) throw error;
            toast.success('Configuração do Radar salva com sucesso!');
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Erro desconhecido';
            toast.error('Erro ao salvar: ' + msg);
        } finally {
            setSavingRadar(false);
        }
    };

    const handleSaveLock = async () => {
        if (!companyId || !user) return;
        setSavingLock(true);
        try {
            const { error } = await db
                .from('companies')
                .update({
                    platform_lock_enabled: settings.platform_lock_enabled,
                    platform_lock_hours_before: settings.platform_lock_hours_before,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', companyId);
            if (error) throw error;
            toast.success('Configuração de Bloqueio salva com sucesso!');
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Erro desconhecido';
            toast.error('Erro ao salvar: ' + msg);
        } finally {
            setSavingLock(false);
        }
    };

    const nextCheckinFormatted = nextCheckinDate
        ? new Date(`${nextCheckinDate}T00:00:00-03:00`).toLocaleDateString('pt-BR', {
              timeZone: 'America/Sao_Paulo',
              weekday: 'long',
              day: '2-digit',
              month: 'long',
              year: 'numeric',
          })
        : null;

    if (loading) return null;

    return (
        <div className="space-y-4 mt-2">

            {/* ─── Card 1: Envio Automático do Radar ─── */}
            <Card className="border border-border/60">
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                            <Mail className="h-5 w-5 text-primary" />
                            <CardTitle className="text-base">Envio Automático do Radar</CardTitle>
                            <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">PRO</Badge>
                        </div>
                        {settings.radar_email_enabled && nextCheckinDate && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Clock className="h-3.5 w-3.5" />
                                <span>Próximo envio: <strong>{computeSendTime(settings.radar_email_hours_before)}</strong> (BRT)</span>
                            </div>
                        )}
                    </div>
                    <CardDescription className="text-xs mt-1">
                        O sistema enviará automaticamente o Radar da Liderança por e-mail para os responsáveis configurados antes de cada check-in.
                    </CardDescription>
                </CardHeader>

                <CardContent>
                    <div className="flex flex-wrap items-end gap-6">

                        {/* Toggle */}
                        <div className="flex items-center gap-3">
                            <Switch
                                id="radar-email-active"
                                checked={settings.radar_email_enabled}
                                onCheckedChange={(v) => setSettings((prev) => ({ ...prev, radar_email_enabled: v }))}
                            />
                            <Label htmlFor="radar-email-active" className="text-sm cursor-pointer">
                                {settings.radar_email_enabled ? 'Envio ativado' : 'Envio desativado'}
                            </Label>
                        </div>

                        {/* Próximo check-in */}
                        <div className="flex flex-col gap-1">
                            <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <CalendarDays className="h-3.5 w-3.5" />
                                Próximo Check-in
                            </Label>
                            <span className="text-sm font-medium text-foreground">
                                {nextCheckinFormatted ?? <span className="text-muted-foreground italic">Não definido</span>}
                            </span>
                        </div>

                        {/* Anteção em horas */}
                        <div className="flex flex-col gap-1.5 min-w-[200px]">
                            <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Clock className="h-3.5 w-3.5" />
                                Enviar com antecedência de
                            </Label>
                            <Select
                                value={String(settings.radar_email_hours_before)}
                                onValueChange={(v) => setSettings((prev) => ({ ...prev, radar_email_hours_before: Number(v) }))}
                                disabled={!settings.radar_email_enabled}
                            >
                                <SelectTrigger className="h-9">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {HOURS_BEFORE_OPTIONS.map((o) => (
                                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Salvar */}
                        <Button
                            onClick={handleSaveRadar}
                            disabled={savingRadar}
                            size="sm"
                            className="h-9 flex items-center gap-2"
                        >
                            <Save className="h-4 w-4" />
                            {savingRadar ? 'Salvando...' : 'Salvar'}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* ─── Card 2: Bloqueio da Plataforma ─── */}
            <Card className="border border-border/60">
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                            <Lock className="h-5 w-5 text-amber-500" />
                            <CardTitle className="text-base">Bloqueio da Plataforma</CardTitle>
                            <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">PRO</Badge>
                        </div>
                        {settings.platform_lock_enabled && nextCheckinDate && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Clock className="h-3.5 w-3.5" />
                                <span>Bloqueia em: <strong>{computeSendTime(settings.platform_lock_hours_before)}</strong> (BRT)</span>
                            </div>
                        )}
                    </div>
                    <CardDescription className="text-xs mt-1">
                        A plataforma ficará em modo somente-leitura para os colaboradores antes do check-in, garantindo que os dados do período sejam preservados para análise.
                    </CardDescription>
                </CardHeader>

                <CardContent>
                    <div className="flex flex-wrap items-end gap-6">

                        {/* Toggle */}
                        <div className="flex items-center gap-3">
                            <Switch
                                id="platform-lock-active"
                                checked={settings.platform_lock_enabled}
                                onCheckedChange={(v) => setSettings((prev) => ({ ...prev, platform_lock_enabled: v }))}
                            />
                            <Label htmlFor="platform-lock-active" className="text-sm cursor-pointer">
                                {settings.platform_lock_enabled ? 'Bloqueio ativado' : 'Bloqueio desativado'}
                            </Label>
                        </div>

                        {/* Próximo check-in */}
                        <div className="flex flex-col gap-1">
                            <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <CalendarDays className="h-3.5 w-3.5" />
                                Próximo Check-in
                            </Label>
                            <span className="text-sm font-medium text-foreground">
                                {nextCheckinFormatted ?? <span className="text-muted-foreground italic">Não definido</span>}
                            </span>
                        </div>

                        {/* Antecedência em horas */}
                        <div className="flex flex-col gap-1.5 min-w-[200px]">
                            <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Clock className="h-3.5 w-3.5" />
                                Bloquear com antecedência de
                            </Label>
                            <Select
                                value={String(settings.platform_lock_hours_before)}
                                onValueChange={(v) => setSettings((prev) => ({ ...prev, platform_lock_hours_before: Number(v) }))}
                                disabled={!settings.platform_lock_enabled}
                            >
                                <SelectTrigger className="h-9">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {HOURS_BEFORE_OPTIONS.map((o) => (
                                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Salvar */}
                        <Button
                            onClick={handleSaveLock}
                            disabled={savingLock}
                            size="sm"
                            className="h-9 flex items-center gap-2 border-amber-200 text-amber-700 hover:bg-amber-50"
                            variant="outline"
                        >
                            <Save className="h-4 w-4" />
                            {savingLock ? 'Salvando...' : 'Salvar'}
                        </Button>
                    </div>

                    {settings.platform_lock_enabled && (
                        <div className="mt-4 flex items-start gap-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 rounded-lg p-3">
                            <Info className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                            <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                                Os colaboradores não poderão editar OKRs, check-ins ou resultados durante o período de bloqueio.
                                Apenas Administradores terão acesso completo. O horário é calculado em <strong>Horário de Brasília (BRT, UTC-3)</strong>.
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>

        </div>
    );
}
