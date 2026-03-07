import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Plus, Target } from 'lucide-react';

interface User {
  id: string;
  full_name: string;
}

interface Team {
  id: string;
  name: string;
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

  useEffect(() => {
    if (open) {
      loadUsers();
      loadTeams();
      if (defaultUserId) setSelectedUserId(defaultUserId);
    }
  }, [open, loadUsers, loadTeams, defaultUserId]);

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
                  <SelectItem value="increase">Aumentar</SelectItem>
                  <SelectItem value="decrease">Diminuir</SelectItem>
                  <SelectItem value="greater_than">Maior Que</SelectItem>
                  <SelectItem value="less_than">Menor Que</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

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
