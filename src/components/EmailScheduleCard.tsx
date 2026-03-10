import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
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
import { Mail, Clock, CalendarDays, Save } from 'lucide-react';

const DAYS = [
    { value: '0', label: 'Domingo' },
    { value: '1', label: 'Segunda-feira' },
    { value: '2', label: 'Terça-feira' },
    { value: '3', label: 'Quarta-feira' },
    { value: '4', label: 'Quinta-feira' },
    { value: '5', label: 'Sexta-feira' },
    { value: '6', label: 'Sábado' },
];

const HOURS = Array.from({ length: 17 }, (_, i) => i + 6).map((h) => ({
    value: String(h),
    label: `${String(h).padStart(2, '0')}:00`,
}));

interface Config {
    id?: string;
    day_of_week: number;
    send_hour: number;
    is_active: boolean;
}

interface EmailScheduleCardProps {
    companyId: string;
}

// Cast supabase to any to bypass missing types for the new table
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export function EmailScheduleCard({ companyId }: EmailScheduleCardProps) {
    const { user } = useAuth();
    const [config, setConfig] = useState<Config>({ day_of_week: 1, send_hour: 9, is_active: true });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const loadConfig = useCallback(async () => {
        if (!companyId) return;
        setLoading(true);
        try {
            const { data } = await db
                .from('email_schedule_config')
                .select('*')
                .eq('company_id', companyId)
                .maybeSingle();

            if (data) {
                setConfig({
                    id: data.id,
                    day_of_week: data.day_of_week,
                    send_hour: data.send_hour,
                    is_active: data.is_active,
                });
            }
        } catch (err) {
            console.error('[EmailScheduleCard] load error:', err);
        } finally {
            setLoading(false);
        }
    }, [companyId]);

    useEffect(() => {
        loadConfig();
    }, [loadConfig]);

    const handleSave = async () => {
        if (!companyId || !user) return;
        setSaving(true);
        try {
            const payload = {
                company_id: companyId,
                day_of_week: config.day_of_week,
                send_hour: config.send_hour,
                is_active: config.is_active,
                updated_at: new Date().toISOString(),
                updated_by: user.id,
            };

            if (config.id) {
                const { error } = await db
                    .from('email_schedule_config')
                    .update(payload)
                    .eq('id', config.id);
                if (error) throw error;
            } else {
                const { data, error } = await db
                    .from('email_schedule_config')
                    .insert(payload)
                    .select()
                    .single();
                if (error) throw error;
                setConfig((prev: Config) => ({ ...prev, id: data.id }));
            }

            toast.success('Configuração do relatório salva com sucesso!');
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Erro desconhecido';
            toast.error('Erro ao salvar configuração: ' + msg);
        } finally {
            setSaving(false);
        }
    };

    const dayLabel = DAYS.find((d) => d.value === String(config.day_of_week))?.label ?? '-';
    const hourLabel = HOURS.find((h) => h.value === String(config.send_hour))?.label ?? '-';

    return (
        <Card className="border border-border/60">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Mail className="h-5 w-5 text-primary" />
                        <CardTitle className="text-base">Relatório Semanal por Email</CardTitle>
                    </div>
                    {!loading && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            <span>
                                {config.is_active
                                    ? `Enviado toda ${dayLabel} às ${hourLabel}`
                                    : 'Envio desativado'}
                            </span>
                        </div>
                    )}
                </div>
            </CardHeader>

            <CardContent>
                {loading ? (
                    <p className="text-sm text-muted-foreground">Carregando configuração...</p>
                ) : (
                    <div className="flex flex-wrap items-end gap-6">

                        {/* Ativo / Inativo */}
                        <div className="flex items-center gap-3">
                            <Switch
                                id="schedule-active"
                                checked={config.is_active}
                                onCheckedChange={(v) => setConfig((prev) => ({ ...prev, is_active: v }))}
                            />
                            <Label htmlFor="schedule-active" className="text-sm cursor-pointer">
                                {config.is_active ? 'Envio ativado' : 'Envio desativado'}
                            </Label>
                        </div>

                        {/* Dia da semana */}
                        <div className="flex flex-col gap-1.5 min-w-[180px]">
                            <Label className="flex items-center gap-1.5 text-sm">
                                <CalendarDays className="h-4 w-4" />
                                Dia da semana
                            </Label>
                            <Select
                                value={String(config.day_of_week)}
                                onValueChange={(v) => setConfig((prev) => ({ ...prev, day_of_week: Number(v) }))}
                                disabled={!config.is_active}
                            >
                                <SelectTrigger className="h-9">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {DAYS.map((d) => (
                                        <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Hora */}
                        <div className="flex flex-col gap-1.5 min-w-[120px]">
                            <Label className="flex items-center gap-1.5 text-sm">
                                <Clock className="h-4 w-4" />
                                Horário (BRT)
                            </Label>
                            <Select
                                value={String(config.send_hour)}
                                onValueChange={(v) => setConfig((prev) => ({ ...prev, send_hour: Number(v) }))}
                                disabled={!config.is_active}
                            >
                                <SelectTrigger className="h-9">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {HOURS.map((h) => (
                                        <SelectItem key={h.value} value={h.value}>{h.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Salvar */}
                        <Button
                            onClick={handleSave}
                            disabled={saving || loading}
                            size="sm"
                            className="h-9 flex items-center gap-2"
                        >
                            <Save className="h-4 w-4" />
                            {saving ? 'Salvando...' : 'Salvar'}
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
