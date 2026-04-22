import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { Plus, Target } from 'lucide-react';

interface User {
  id: string;
  full_name: string;
}

interface Team {
  id: string;
  name: string;
}

interface QuarterCheckin {
  id: string;
  name: string;
  checkin_date: string;
}

interface AddKRDialogProps {
  objectiveId: string;
  quarterId: string;
  companyId: string;
  defaultUserId?: string;
  onSuccess: () => void;
}

export function AddKRDialog({ objectiveId, quarterId, companyId, defaultUserId, onSuccess }: AddKRDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);

  // Form fields
  const [title, setTitle] = useState('');
  const [type, setType] = useState('number');
  const [direction, setDirection] = useState('increase');
  const [ownerType, setOwnerType] = useState<'user' | 'team'>('user');
  const [selectedUserId, setSelectedUserId] = useState(defaultUserId || '');
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [code, setCode] = useState('');

  // Auto-redistribute states
  const [quarterCheckins, setQuarterCheckins] = useState<QuarterCheckin[]>([]);
  const [isAutoRedistributed, setIsAutoRedistributed] = useState(false);
  const [weights, setWeights] = useState<Record<string, number>>({});

  const loadUsers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('full_name');

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
    }
  }, [companyId]);

  const loadTeams = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('company_id', companyId)
        .eq('is_team', true)
        .eq('is_active', true)
        .order('full_name');

      if (error) throw error;
      setTeams((data || []).map(t => ({ id: t.id, name: t.full_name })));
    } catch (error) {
      console.error('Erro ao carregar times:', error);
    }
  }, [companyId]);

  const loadQuarterCheckins = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('quarter_checkins')
        .select('id, name, checkin_date')
        .eq('quarter_id', quarterId)
        .order('checkin_date');
      
      if (error) throw error;
      setQuarterCheckins(data || []);
      
      if (data && data.length > 0) {
         const equalWeight = Math.floor(100 / data.length);
         const initialWeights: Record<string, number> = {};
         data.forEach((qc, idx) => {
           initialWeights[qc.id] = (idx === data.length - 1) 
             ? 100 - (equalWeight * (data.length - 1)) 
             : equalWeight;
         });
         setWeights(initialWeights);
      }
    } catch (error) {
      console.error('Erro ao carregar check-ins do quarter:', error);
    }
  }, [quarterId]);

  useEffect(() => {
    if (open) {
      loadUsers();
      loadTeams();
      loadQuarterCheckins();
      if (defaultUserId) setSelectedUserId(defaultUserId);
    }
  }, [open, loadUsers, loadTeams, loadQuarterCheckins, defaultUserId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const isOwnerSelected = (ownerType === 'user' && selectedUserId) || (ownerType === 'team' && selectedTeamId);

    if (!title || !isOwnerSelected) {
      toast({
        title: 'Erro',
        description: 'Preencha todos os campos obrigatórios',
        variant: 'destructive',
      });
      return;
    }

    const totalWeight = Object.values(weights).reduce((sum, val) => sum + (Number(val) || 0), 0);
    if ((type === 'percentage' || type === 'percentual') && isAutoRedistributed && quarterCheckins.length > 0 && totalWeight !== 100) {
      toast({
        title: 'Distribuição Inválida',
        description: `A soma dos pesos deve ser exatamente 100%. Atual: ${totalWeight}%`,
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from('key_results')
        .insert({
          objective_id: objectiveId,
          title,
          type,
          direction,
          user_id: ownerType === 'user' ? selectedUserId : selectedTeamId,
          company_id: companyId,
          quarter_id: quarterId,
          created_by: user?.id,
          code: code || null,
          current: 0,
          baseline: 0,
          target: 0,
          weight: 1,
          is_auto_redistributed: (type === 'percentage' || type === 'percentual') ? isAutoRedistributed : false,
          auto_redistribute_weights: ((type === 'percentage' || type === 'percentual') && isAutoRedistributed) ? weights : null,
        });

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Key Result criado com sucesso!',
      });

      // Reset form
      setTitle('');
      setCode('');
      setOpen(false);
      onSuccess();
    } catch (error) {
      console.error('Erro ao criar KR:', error);
      toast({
        title: 'Erro ao criar Key Result',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-2">
          <Plus className="h-4 w-4" />
          Novo KR
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Adicionar Key Result
          </DialogTitle>
          <DialogDescription>
            Defina o novo indicador para este objetivo
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="kr-title">Título *</Label>
            <Input
              id="kr-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Aumentar conversão em 20%"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="kr-code">Código (opcional)</Label>
            <Input
              id="kr-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Ex: KR-01"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  <SelectItem value="number">Número</SelectItem>
                  <SelectItem value="percentage">Percentual</SelectItem>
                  <SelectItem value="currency">Moeda</SelectItem>
                  <SelectItem value="date">Data</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Direção</Label>
              <Select value={direction} onValueChange={setDirection}>
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

          {(type === 'percentage' || type === 'percentual') && (
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
              <Select value={ownerType} onValueChange={(v: any) => setOwnerType(v)}>
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
              {ownerType === 'user' ? (
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o usuário" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    {users.map(u => (
                      <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o time" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    {teams.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Adicionando...' : 'Adicionar Key Result'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
