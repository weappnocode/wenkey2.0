import { useEffect, useState, useCallback, type ReactNode } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Pencil } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

interface EditKRDialogProps {
  krId: string;
  companyId: string;
  onSuccess: () => void;
  trigger?: ReactNode;
}

interface Team {
  id: string;
  name: string;
}

interface Profile {
  id: string;
  full_name: string;
}

interface QuarterCheckin {
  id: string;
  name: string;
}

interface KRForm {
  title: string;
  type: string;
  direction: string;
  unit: string;
  owner_type: 'user' | 'team';
  user_id: string;
  team_id: string;
  code: string;
}

export function EditKRDialog({ krId, companyId, onSuccess, trigger }: EditKRDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState<Profile[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [form, setForm] = useState<KRForm>({
    title: '',
    type: 'number',
    direction: 'increase',
    unit: '',
    owner_type: 'user',
    user_id: '',
    team_id: '',
    code: '',
  });

  // Auto-redistribute states
  const [quarterCheckins, setQuarterCheckins] = useState<QuarterCheckin[]>([]);
  const [isAutoRedistributed, setIsAutoRedistributed] = useState(false);
  const [weights, setWeights] = useState<Record<string, number>>({});

  const loadUsers = useCallback(async () => {
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('full_name');

    if (profilesError) {
      toast.error('Erro ao carregar responsáveis');
      return;
    }

    if (profiles) {
      setUsers(profiles);
    }
  }, [companyId]);

  const loadTeams = useCallback(async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('company_id', companyId)
      .eq('is_team', true)
      .eq('is_active', true)
      .order('full_name');

    if (error) {
      toast.error('Erro ao carregar times');
      return;
    }

    if (data) {
      setTeams(data.map(t => ({ id: t.id, name: t.full_name })));
    }
  }, [companyId]);

  const loadKeyResult = useCallback(async () => {
    setLoading(true);
    // Buscamos o KR e o perfil do dono para saber se é um time
    const { data, error } = await supabase
      .from('key_results')
      .select(`
        title, 
        type, 
        direction, 
        unit, 
        user_id, 
        code,
        is_auto_redistributed,
        auto_redistribute_weights,
        profiles!key_results_user_id_fkey (
          is_team
        ),
        objectives!inner (
          quarter_id
        )
      `)
      .eq('id', krId)
      .single();

    if (error || !data) {
      toast.error('Não foi possível carregar o Key Result');
      setLoading(false);
      return;
    }

    const isTeam = (data.profiles as any)?.is_team || false;

    setForm({
      title: data.title ?? '',
      type: data.type ?? 'number',
      direction: data.direction ?? 'increase',
      unit: data.unit ?? '',
      owner_type: isTeam ? 'team' : 'user',
      user_id: !isTeam ? (data.user_id ?? '') : '',
      team_id: isTeam ? (data.user_id ?? '') : '',
      code: data.code ?? '',
    });
    
    setIsAutoRedistributed(data.is_auto_redistributed || false);
    
    const quarterId = (data.objectives as any)?.quarter_id;
    if (quarterId) {
      const { data: qcs } = await supabase
        .from('quarter_checkins')
        .select('id, name')
        .eq('quarter_id', quarterId)
        .order('checkin_date');
        
      if (qcs) {
        setQuarterCheckins(qcs);
        if (data.auto_redistribute_weights) {
          setWeights(data.auto_redistribute_weights as Record<string, number>);
        } else if (qcs.length > 0) {
          const equalWeight = Math.floor(100 / qcs.length);
          const initialWeights: Record<string, number> = {};
          qcs.forEach((qc, idx) => {
            initialWeights[qc.id] = (idx === qcs.length - 1) 
              ? 100 - (equalWeight * (qcs.length - 1)) 
              : equalWeight;
          });
          setWeights(initialWeights);
        }
      }
    }
    
    setLoading(false);
  }, [krId]);

  useEffect(() => {
    if (open) {
      loadUsers();
      loadTeams();
      loadKeyResult();
    }
  }, [open, loadUsers, loadTeams, loadKeyResult]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.title.trim()) {
      toast.error('Preencha o título do Key Result');
      return;
    }

    const isOwnerSelected = (form.owner_type === 'user' && form.user_id) || (form.owner_type === 'team' && form.team_id);

    if (!isOwnerSelected) {
      toast.error('Selecione o responsável');
      return;
    }

    const totalWeight = Object.values(weights).reduce((sum, val) => sum + (Number(val) || 0), 0);
    if ((form.type === 'percentage' || form.type === 'percentual') && isAutoRedistributed && quarterCheckins.length > 0 && totalWeight !== 100) {
      toast.error(`A soma dos pesos deve ser exatamente 100%. Atual: ${totalWeight}%`);
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('key_results')
        .update({
          title: form.title.trim(),
          type: form.type,
          direction: form.direction,
          unit: form.unit || null,
          user_id: form.owner_type === 'user' ? form.user_id : form.team_id,
          code: form.code || null,
          is_auto_redistributed: (form.type === 'percentage' || form.type === 'percentual') ? isAutoRedistributed : false,
          auto_redistribute_weights: ((form.type === 'percentage' || form.type === 'percentual') && isAutoRedistributed) ? weights : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', krId);

      if (error) throw error;

      toast.success('Key Result atualizado com sucesso');
      onSuccess();
      setOpen(false);
    } catch (err) {
      console.error('Erro ao atualizar Key Result:', err);
      const errorMessage = err instanceof Error ? err.message : 'Erro ao atualizar Key Result';
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm">
            <Pencil className="h-4 w-4 mr-2" />
            Editar
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar Key Result</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="kr-title">Título *</Label>
            <Input
              id="kr-title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Título do KR"
              required
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="kr-code">Código (opcional)</Label>
            <Input
              id="kr-code"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              placeholder="Ex: KR-01"
              disabled={loading}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                value={form.type}
                onValueChange={(value) => setForm({ ...form, type: value })}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  <SelectItem value="number">Número</SelectItem>
                  <SelectItem value="percentage">Porcentagem</SelectItem>
                  <SelectItem value="currency">Moeda</SelectItem>
                  <SelectItem value="date">Data</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Direção</Label>
              <Select
                value={form.direction}
                onValueChange={(value) => setForm({ ...form, direction: value })}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  <SelectItem value="increase">Maior ou Igual</SelectItem>
                  <SelectItem value="decrease">Menor ou Igual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {(form.type === 'percentage' || form.type === 'percentual') && (
            <div className="space-y-4 border rounded-md p-4 bg-muted/10">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <Label>Redistribuição Automática de Atrasos</Label>
                  <p className="text-xs text-muted-foreground flex-1">
                    Ative para que o peso não atingido de um check-in seja dividido entre os próximos automaticamente.
                  </p>
                </div>
                <Switch
                  checked={isAutoRedistributed}
                  onCheckedChange={setIsAutoRedistributed}
                />
              </div>

              {isAutoRedistributed && quarterCheckins.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="flex justify-between items-center mb-2">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase">Distribuição Inicial</Label>
                    <span className={`text-xs font-bold ${Object.values(weights).reduce((a, b) => a + (Number(b) || 0), 0) === 100 ? 'text-green-500' : 'text-destructive'}`}>
                      Soma atual: {Object.values(weights).reduce((a, b) => a + (Number(b) || 0), 0)}% / 100%
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    {quarterCheckins.map((qc) => (
                      <div key={qc.id} className="flex items-center gap-2">
                        <Label className="w-24 text-xs truncate" title={qc.name}>{qc.name}</Label>
                        <div className="relative flex-1">
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            className="h-8 pr-6 text-right"
                            value={weights[qc.id] === 0 ? '' : weights[qc.id]}
                            onChange={(e) => setWeights({ ...weights, [qc.id]: Number(e.target.value) })}
                          />
                          <span className="absolute right-2 top-1.5 text-xs text-muted-foreground">%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo de Dono</Label>
              <Select
                value={form.owner_type}
                onValueChange={(value: 'user' | 'team') => setForm({ ...form, owner_type: value })}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  <SelectItem value="user">Individual</SelectItem>
                  <SelectItem value="team">Time</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Responsável *</Label>
              {form.owner_type === 'user' ? (
                <Select
                  value={form.user_id}
                  onValueChange={(value) => setForm({ ...form, user_id: value })}
                  disabled={loading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o responsável" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Select
                  value={form.team_id}
                  onValueChange={(value) => setForm({ ...form, team_id: value })}
                  disabled={loading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o time" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    {teams.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving || loading}>
              {saving ? 'Salvando...' : 'Salvar alterações'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
