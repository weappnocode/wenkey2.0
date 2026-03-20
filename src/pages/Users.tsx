import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Pencil, Trash2, Send, UserPlus, Users as UsersIcon, UserMinus } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useUserRole } from '@/hooks/useUserRole';
import { toast } from 'sonner';
import { toTitleCase } from '@/lib/utils';
import { callN8nWebhook } from '@/lib/n8nWebhook';
import { EmailScheduleCard } from '@/components/EmailScheduleCard';

interface Profile {
  id: string;
  full_name: string;
  email: string;
  position: string | null;
  sector: string | null;
  permission_type: 'user' | 'manager' | 'admin';
  avatar_url: string | null;
  is_active: boolean;
  company_id: string | null;
  is_team: boolean | null;
  team_member_ids: string[] | null;
  companies?: Company | null;
}

interface Company {
  id: string;
  name: string;
  sectors: string[];
}

interface CompanyMember {
  company_id: string;
  user_id: string;
  companies: Company;
}

type FilterStatus = 'all' | 'active' | 'pending';
type Permission = 'user' | 'manager' | 'admin';
type ProfileWithCompany = Profile & { companies?: Company | null };

export default function Users() {
  const { user, profile } = useAuth();
  const { selectedCompanyId, selectedCompany } = useCompany();
  const { isAdmin } = useUserRole();
  const [users, setUsers] = useState<Profile[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyMembers, setCompanyMembers] = useState<CompanyMember[]>([]);
  const [loading, setLoading] = useState(true);

  // User Dialogs
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);

  // Team Dialogs
  const [isTeamDialogOpen, setIsTeamDialogOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<Profile | null>(null);
  const [isDeleteTeamDialogOpen, setIsDeleteTeamDialogOpen] = useState(false);

  const [filterCompanyId, setFilterCompanyId] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');

  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    password: '',
    position: '',
    sector: '',
    permission_type: 'user' as Permission,
    company_id: '',
    avatar_file: null as File | null,
  });

  const [teamForm, setTeamForm] = useState({
    full_name: '',
    team_member_ids: [] as string[],
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    // Sempre acompanha a empresa escolhida na sidebar
    if (selectedCompanyId && filterCompanyId !== selectedCompanyId) {
      setFilterCompanyId(selectedCompanyId);
    }
  }, [selectedCompanyId, filterCompanyId]);

  useEffect(() => {
    if (selectedCompanyId) {
      setFormData((prev) => ({ ...prev, company_id: selectedCompanyId }));
    }
  }, [selectedCompanyId]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load users with companies
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select(`
          *,
          companies:company_id (
            id,
            name,
            sectors
          )
        `)
        .order('full_name');

      if (profilesError) throw profilesError;
      const normalized = ((profilesData as ProfileWithCompany[]) || []).map((p) => {
        let avatarUrl = p.avatar_url;
        if (avatarUrl && !String(avatarUrl).startsWith('http')) {
          const { data } = supabase.storage.from('avatars').getPublicUrl(avatarUrl);
          avatarUrl = data.publicUrl;
        }

        return {
          ...p,
          avatar_url: avatarUrl,
        };
      });
      setUsers(normalized);

      // Load companies
      const { data: companiesData, error: companiesError } = await supabase
        .from('companies')
        .select('*')
        .order('name');

      if (companiesError) throw companiesError;
      setCompanies(companiesData || []);

      // Load company members
      const { data: membersData, error: membersError } = await supabase
        .from('company_members')
        .select('*, companies(*)');

      if (membersError) throw membersError;
      setCompanyMembers(membersData || []);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      toast.error('Erro ao carregar dados: ' + message);
    } finally {
      setLoading(false);
    }
  };

  const getUserCompanyId = (user: Profile) => {
    // Primary: value stored in profiles table
    if (user.company_id) return user.company_id;

    // Fallback: membership row
    const membership = companyMembers.find((cm) => cm.user_id === user.id);
    return membership?.company_id || null;
  };

  const getUserCompany = (user: Profile) => {
    if (user.companies?.name) return user.companies.name;

    const membership = companyMembers.find((cm) => cm.user_id === user.id);
    if (membership?.companies?.name) return membership.companies.name;

    const companyId = getUserCompanyId(user);
    const company = companies.find((c) => c.id === companyId);
    return company?.name || '-';
  };

  const getCompanySectors = (companyId: string | null | undefined) => {
    if (!companyId) return [];
    const company = companies.find((c) => c.id === companyId);
    return (company?.sectors || []).filter(Boolean);
  };

  const handleCreate = async () => {
    try {
      if (!formData.full_name || !formData.email || !formData.password || !formData.company_id) {
        toast.error('Preencha todos os campos obrigatórios');
        return;
      }

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: { full_name: formData.full_name },
        },
      });

      if (authError) throw authError;

      if (authData.user) {
        let avatarUrl: string | null = null;

        if (formData.avatar_file) {
          const fileExt = formData.avatar_file.name.split('.').pop();
          const filePath = `${authData.user.id}/avatar.${fileExt}`;

          const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(filePath, formData.avatar_file, { upsert: true });

          if (!uploadError) {
            avatarUrl = filePath;
          }
        }

        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            position: formData.position || null,
            sector: formData.sector || null,
            permission_type: formData.permission_type,
            company_id: formData.company_id,
            avatar_url: avatarUrl,
          })
          .eq('id', authData.user.id);

        if (updateError) throw updateError;

        const { error: memberError } = await supabase.from('company_members').insert({
          user_id: authData.user.id,
          company_id: formData.company_id,
        });

        if (memberError) throw memberError;

        toast.success('Usuário criado com sucesso!');
        setIsCreateDialogOpen(false);
        resetForm();
        loadData();
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      toast.error('Erro ao criar usuário: ' + message);
    }
  };

  const handleEdit = async () => {
    try {
      if (!selectedUser) return;

      let avatarUrl = selectedUser.avatar_url;

      if (formData.avatar_file) {
        const fileExt = formData.avatar_file.name.split('.').pop();
        const filePath = `${selectedUser.id}/avatar.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, formData.avatar_file, { upsert: true });

        if (!uploadError) {
          avatarUrl = filePath;
        }
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name,
          position: formData.position || null,
          sector: formData.sector || null,
          permission_type: formData.permission_type,
          company_id: formData.company_id || null,
          avatar_url: avatarUrl,
          is_active: selectedUser.is_active,
        })
        .eq('id', selectedUser.id);

      if (error) throw error;

      if (formData.company_id && formData.company_id !== selectedUser.company_id) {
        await supabase.from('company_members').delete().eq('user_id', selectedUser.id);

        const { error: memberError } = await supabase
          .from('company_members')
          .insert({ user_id: selectedUser.id, company_id: formData.company_id });

        if (memberError) throw memberError;
      }

      toast.success('Usuário atualizado com sucesso!');
      setIsEditDialogOpen(false);
      setSelectedUser(null);
      resetForm();
      loadData();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      toast.error('Erro ao atualizar usuário: ' + message);
    }
  };

  const handleDelete = async () => {
    try {
      if (!selectedUser) return;

      const { error: memberError } = await supabase
        .from('company_members')
        .delete()
        .eq('user_id', selectedUser.id);

      if (memberError) throw memberError;

      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', selectedUser.id);

      if (error) throw error;

      toast.success('Usuário excluído com sucesso!');
      setIsDeleteDialogOpen(false);
      setSelectedUser(null);
      loadData();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      toast.error('Erro ao excluir usuário: ' + message);
    }
  };

  const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: !currentStatus })
        .eq('id', userId);

      if (error) throw error;

      // Se está ativando (false → true), dispara webhook de email de ativação
      if (!currentStatus) {
        const activatedUser = users.find(u => u.id === userId);
        if (activatedUser) {
          try {
            const companyId = activatedUser.company_id || getUserCompanyId(activatedUser);
            let companyName = 'Sua Empresa';

            if (companyId) {
              const { data: companyData } = await supabase
                .from('companies')
                .select('name')
                .eq('id', companyId)
                .single();
              if (companyData) companyName = companyData.name;
            }

            const result = await callN8nWebhook('emailAtivo', {
              user_id: activatedUser.id,
              email: activatedUser.email,
              full_name: activatedUser.full_name,
              company_name: companyName,
              activated_at: new Date().toISOString(),
            });

            if (result.success) {
              toast.success('Usuário ativado e email de boas-vindas enviado!');
            } else {
              toast.success('Usuário ativado! (email pode não ter sido enviado)');
            }
          } catch (webhookErr) {
            console.warn('[n8n] Webhook emailAtivo falhou (não impacta a ativação):', webhookErr);
            toast.success('Usuário ativado! (email pode não ter sido enviado)');
          }
        } else {
          toast.success('Status atualizado com sucesso!');
        }
      } else {
        toast.success('Usuário desativado com sucesso!');
      }

      loadData();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      toast.error('Erro ao atualizar status: ' + message);
    }
  };

  const handleTestWebhook = async (user: Profile) => {
    try {
      const companyId = user.company_id || getUserCompanyId(user);
      let companyName = 'Sua Empresa';

      if (companyId) {
        const { data: companyData } = await supabase
          .from('companies')
          .select('name')
          .eq('id', companyId)
          .single();

        if (companyData) {
          companyName = companyData.name;
        }
      }

      const payload = {
        user_id: user.id,
        email: user.email,
        full_name: user.full_name,
        company_name: companyName,
        activated_at: new Date().toISOString()
      };

      const result = await callN8nWebhook('emailAtivo', payload);

      if (result.success) {
        toast.success('Email de ativação enviado com sucesso!');
      } else {
        toast.error('Falha ao enviar email: ' + (result.error || 'Erro desconhecido'));
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      toast.error('Erro ao enviar teste: ' + message);
    }
  };

  const handleTestNewUserWebhook = async (user: Profile) => {
    try {
      const companyId = user.company_id || getUserCompanyId(user);
      let companyName = 'Sua Empresa';
      let adminEmails = '';

      if (companyId) {
        // Obter nome da empresa
        const { data: companyData } = await supabase
          .from('companies')
          .select('name')
          .eq('id', companyId)
          .single();

        if (companyData) {
          companyName = companyData.name;
        }

        // Obter emails dos admins da empresa
        const { data: adminsData } = await supabase
          .from('profiles')
          .select('email')
          .eq('company_id', companyId)
          .in('permission_type', ['admin', 'manager'])
          .eq('is_active', true)
          .neq('id', user.id); // Excluir o próprio usuário se ele for admin

        if (adminsData && adminsData.length > 0) {
          adminEmails = adminsData.map(a => a.email).join(',');
        } else {
          // Fallback para testes: se não achar admin, manda pro próprio usuário recém criado
          adminEmails = user.email;
        }
      }

      const payload = {
        type: 'new_user_registration',
        new_user_id: user.id,
        new_user_email: user.email,
        new_user_name: user.full_name,
        company_name: companyName,
        admin_emails: adminEmails,
        registered_at: new Date().toISOString()
      };

      const result = await callN8nWebhook('novocadastro', payload);

      if (result.success) {
        toast.success('Notificação de novo cadastro enviada!');
      } else {
        toast.error('Falha ao enviar notificação: ' + (result.error || 'Erro desconhecido'));
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      toast.error('Erro ao enviar teste: ' + message);
    }
  };

  const handleSaveTeam = async () => {
    try {
      if (!teamForm.full_name || !selectedCompanyId) {
        toast.error('Preencha o nome do time');
        return;
      }

      const teamData = {
        id: selectedTeam?.id || crypto.randomUUID(),
        full_name: teamForm.full_name,
        team_member_ids: teamForm.team_member_ids,
        company_id: selectedCompanyId,
        is_team: true,
        email: `team_${Date.now()}@virtual.internal`, // Email fictício para manter compatibilidade
        is_active: true,
        permission_type: 'user' as const,
      };

      if (selectedTeam) {
        const { error } = await supabase
          .from('profiles')
          .update(teamData)
          .eq('id', selectedTeam.id);
        if (error) throw error;
        toast.success('Time atualizado com sucesso!');
      } else {
        const { error } = await supabase
          .from('profiles')
          .insert(teamData);
        if (error) throw error;
        toast.success('Time criado com sucesso!');
      }

      setIsTeamDialogOpen(false);
      resetTeamForm();
      loadData();
    } catch (error: any) {
      toast.error('Erro ao salvar time: ' + error.message);
    }
  };

  const handleDeleteTeam = async () => {
    try {
      if (!selectedTeam) return;
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', selectedTeam.id);
      if (error) throw error;
      toast.success('Time excluído com sucesso!');
      setIsDeleteTeamDialogOpen(false);
      setSelectedTeam(null);
      loadData();
    } catch (error: any) {
      toast.error('Erro ao excluir time: ' + error.message);
    }
  };

  const openEditTeamDialog = (team: Profile) => {
    setSelectedTeam(team);
    setTeamForm({
      full_name: team.full_name,
      team_member_ids: team.team_member_ids || [],
    });
    setIsTeamDialogOpen(true);
  };

  const resetTeamForm = () => {
    setTeamForm({
      full_name: '',
      team_member_ids: [],
    });
    setSelectedTeam(null);
  };

  const openEditDialog = (user: Profile) => {
    setSelectedUser(user);
    setFormData({
      full_name: user.full_name,
      email: user.email,
      password: '',
      position: user.position || '',
      sector: user.sector || '',
      permission_type: user.permission_type,
      company_id: user.company_id || '',
      avatar_file: null,
    });
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (user: Profile) => {
    setSelectedUser(user);
    setIsDeleteDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      full_name: '',
      email: '',
      password: '',
      position: '',
      sector: '',
      permission_type: 'user',
      company_id: selectedCompanyId || '',
      avatar_file: null,
    });
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const filteredUsers = users.filter(user => {
    if (user.is_team) return false;
    const effectiveCompanyId = selectedCompanyId || profile?.company_id || '';
    const userCompanyId = getUserCompanyId(user);
    const matchesCompany = isAdmin
      ? (filterCompanyId === 'all' || userCompanyId === effectiveCompanyId)
      : (userCompanyId === profile?.company_id);

    // Status is 'active' only if is_active is true AND company_id exists
    const isUserActive = Boolean(user.is_active && userCompanyId);

    const matchesStatus =
      filterStatus === 'all' ||
      (filterStatus === 'active' && isUserActive) ||
      (filterStatus === 'pending' && !isUserActive);

    return matchesCompany && matchesStatus;
  });

  const teamsList = users.filter(u => u.is_team && u.company_id === selectedCompanyId);

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">{toTitleCase('Gestão de Usuários')}</h1>
          {isAdmin && (
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              {toTitleCase('Novo Usuário')}
            </Button>
          )}
        </div>

        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>{toTitleCase('Lista de Usuários')}</CardTitle>
              {isAdmin && (
                <div className="flex gap-4 w-full max-w-2xl">
                  <div className="flex-1">
                    <div className="h-10 px-3 flex items-center rounded-md border bg-muted/30 text-sm text-foreground">
                      {selectedCompany?.name ? toTitleCase(selectedCompany.name) : 'Nenhuma empresa selecionada'}
                    </div>
                  </div>
                  <div className="flex-1">
                    <Select value={filterStatus} onValueChange={(v: FilterStatus) => setFilterStatus(v)}>
                      <SelectTrigger>
                        <SelectValue placeholder={toTitleCase('Filtrar por status')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os status</SelectItem>
                        <SelectItem value="active">Ativos</SelectItem>
                        <SelectItem value="pending">Pendentes</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground">{toTitleCase('Carregando...')}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{toTitleCase('Usuário')}</TableHead>
                    <TableHead>{toTitleCase('Email')}</TableHead>
                    <TableHead>{toTitleCase('Empresa')}</TableHead>
                    <TableHead>{toTitleCase('Setor')}</TableHead>
                    <TableHead>{toTitleCase('Permissão')}</TableHead>
                    <TableHead>{toTitleCase('Status')}</TableHead>
                    <TableHead className="text-right">{toTitleCase('Ações')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map(user => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarImage src={user.avatar_url || undefined} />
                            <AvatarFallback>{getInitials(user.full_name)}</AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{toTitleCase(user.full_name)}</span>
                        </div>
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{toTitleCase(getUserCompany(user))}</TableCell>
                      <TableCell>{user.sector || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={user.permission_type === 'admin' ? 'default' : 'secondary'}>
                          {toTitleCase(user.permission_type)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {isAdmin ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="p-0 h-auto hover:bg-transparent"
                            onClick={() => toggleUserStatus(user.id, user.is_active)}
                          >
                            {(() => {
                              const isUserActive = Boolean(user.is_active && getUserCompanyId(user));
                              return (
                                <Badge
                                  variant={isUserActive ? 'default' : 'secondary'}
                                  className={!isUserActive ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 border-amber-200' : ''}
                                >
                                  {isUserActive ? toTitleCase('Ativo') : toTitleCase('Pendente')}
                                </Badge>
                              );
                            })()}
                          </Button>
                        ) : (
                          (() => {
                            const isUserActive = Boolean(user.is_active && getUserCompanyId(user));
                            return (
                              <Badge
                                variant={isUserActive ? 'default' : 'secondary'}
                                className={!isUserActive ? 'bg-amber-100 text-amber-700 border-amber-200' : ''}
                              >
                                {isUserActive ? toTitleCase('Ativo') : toTitleCase('Pendente')}
                              </Badge>
                            );
                          })()
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {isAdmin && (
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Testar email de Novo Cadastro (Admin)"
                              onClick={() => handleTestNewUserWebhook(user)}
                            >
                              <UserPlus className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Testar email de Ativação (Usuário)"
                              onClick={() => handleTestWebhook(user)}
                            >
                              <Send className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditDialog(user)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive"
                              onClick={() => openDeleteDialog(user)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>


        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>{toTitleCase('Gestão de Times')}</CardTitle>
              {isAdmin && (
                <Button onClick={() => { resetTeamForm(); setIsTeamDialogOpen(true); }}>
                  <Plus className="mr-2 h-4 w-4" />
                  Novo Time
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground">Carregando...</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Membros</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamsList.map(team => {
                    const memberSectors = (team.team_member_ids || [])
                      .map(id => users.find(u => u.id === id)?.sector)
                      .filter(Boolean) as string[];
                    const uniqueSectors = Array.from(new Set(memberSectors));

                    return (
                      <TableRow key={team.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar>
                              <AvatarFallback><UsersIcon className="h-4 w-4" /></AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{team.full_name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-2">
                            <div className="flex -space-x-2">
                              {(team.team_member_ids || []).slice(0, 5).map(memberId => {
                                const member = users.find(u => u.id === memberId);
                                if (!member) return null;
                                return (
                                  <Avatar key={memberId} className="border-2 border-background w-8 h-8">
                                    <AvatarImage src={member.avatar_url || ''} />
                                    <AvatarFallback className="text-[10px]">{getInitials(member.full_name)}</AvatarFallback>
                                  </Avatar>
                                );
                              })}
                              {(team.team_member_ids || []).length > 5 && (
                                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted border-2 border-background text-[10px] font-medium">
                                  +{(team.team_member_ids || []).length - 5}
                                </div>
                              )}
                              {(team.team_member_ids || []).length === 0 && (
                                <span className="text-muted-foreground text-sm italic">Nenhum membro</span>
                              )}
                            </div>
                            {uniqueSectors.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {uniqueSectors.map(sector => (
                                  <Badge key={sector} variant="secondary" className="text-[10px] py-0 px-1.5 font-normal opacity-70">
                                    {sector}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {isAdmin && (
                            <div className="flex justify-end gap-2">
                              <Button variant="ghost" size="icon" onClick={() => openEditTeamDialog(team)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="text-destructive" onClick={() => { setSelectedTeam(team); setIsDeleteTeamDialogOpen(true); }}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {teamsList.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                        Nenhum time cadastrado.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Email Schedule Config – Admin only */}
        {isAdmin && (
          <EmailScheduleCard companyId={selectedCompanyId || profile?.company_id || ''} />
        )}

        {/* Team Dialog */}
        <Dialog open={isTeamDialogOpen} onOpenChange={setIsTeamDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{selectedTeam ? 'Editar Time' : 'Novo Time'}</DialogTitle>
              <DialogDescription>Defina o nome do time e selecione os membros.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="team_name">Nome do Time</Label>
                <Input
                  id="team_name"
                  value={teamForm.full_name}
                  onChange={e => setTeamForm({ ...teamForm, full_name: e.target.value })}
                  placeholder="Ex: Marketing, Desenvolvimento"
                />
              </div>
              <div className="space-y-2">
                <Label>Membros do Time</Label>
                <div className="border rounded-md p-2 max-h-[200px] overflow-y-auto space-y-1">
                  {users.filter(u => !u.is_team && u.company_id === selectedCompanyId).map(u => (
                    <div key={u.id} className="flex items-center space-x-2 p-1 hover:bg-muted/50 rounded cursor-pointer" onClick={() => {
                      const current = [...teamForm.team_member_ids];
                      if (current.includes(u.id)) {
                        setTeamForm({ ...teamForm, team_member_ids: current.filter(id => id !== u.id) });
                      } else {
                        setTeamForm({ ...teamForm, team_member_ids: [...current, u.id] });
                      }
                    }}>
                      <div className={`w-4 h-4 border rounded flex items-center justify-center ${teamForm.team_member_ids.includes(u.id) ? 'bg-primary border-primary text-primary-foreground' : 'border-input'}`}>
                        {teamForm.team_member_ids.includes(u.id) && <Plus className="w-3 h-3" />}
                      </div>
                      <span className="text-sm">{u.full_name}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {teamForm.team_member_ids.length} membros selecionados.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsTeamDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSaveTeam}>Salvar Time</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Team Alert */}
        <AlertDialog open={isDeleteTeamDialogOpen} onOpenChange={setIsDeleteTeamDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir Time</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir o time <strong>{selectedTeam?.full_name}</strong>?
                Os OKRs vinculados a este time perderão sua referência (ou serão apagados se houver cascata).
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteTeam} className="bg-destructive text-destructive-foreground">Excluir</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Create Dialog */}
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Novo Usuário</DialogTitle>
              <DialogDescription>
                Preencha os dados do novo usuário
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="full_name">Nome Completo *</Label>
                <Input
                  id="full_name"
                  value={formData.full_name}
                  onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="password">Senha *</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={e => setFormData({ ...formData, password: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="company">Empresa *</Label>
                <div className="h-10 px-3 flex items-center rounded-md border bg-muted/30 text-sm text-foreground">
                  {selectedCompany?.name ? toTitleCase(selectedCompany.name) : 'Nenhuma empresa selecionada'}
                </div>
              </div>
              <div>
                <Label htmlFor="sector">Setor</Label>
                <Select
                  value={formData.sector}
                  onValueChange={value => setFormData({ ...formData, sector: value })}
                  disabled={getCompanySectors(formData.company_id).length === 0}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        getCompanySectors(formData.company_id).length === 0
                          ? 'Nenhum setor cadastrado para esta empresa'
                          : 'Selecione um setor'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {getCompanySectors(formData.company_id).map(sector => (
                      <SelectItem key={sector} value={sector}>
                        {sector}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="position">Cargo</Label>
                <Input
                  id="position"
                  value={formData.position}
                  onChange={e => setFormData({ ...formData, position: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="permission">Permissão</Label>
                <Select
                  value={formData.permission_type}
                  onValueChange={value =>
                    setFormData({ ...formData, permission_type: value as Permission })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Usuário</SelectItem>
                    <SelectItem value="manager">Gestor</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="avatar">Foto do Perfil</Label>
                <Input
                  id="avatar"
                  type="file"
                  accept="image/*"
                  onChange={e => setFormData({ ...formData, avatar_file: e.target.files?.[0] || null })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreate}>Criar Usuário</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Editar Usuário</DialogTitle>
              <DialogDescription>
                Atualize os dados do usuário
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit_full_name">Nome Completo</Label>
                <Input
                  id="edit_full_name"
                  value={formData.full_name}
                  onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit_company">Empresa</Label>
                <div className="h-10 px-3 flex items-center rounded-md border bg-muted/30 text-sm text-foreground">
                  {selectedCompany?.name ? toTitleCase(selectedCompany.name) : 'Nenhuma empresa selecionada'}
                </div>
              </div>
              <div>
                <Label htmlFor="edit_sector">Setor</Label>
                <Select
                  value={formData.sector}
                  onValueChange={value => setFormData({ ...formData, sector: value })}
                  disabled={getCompanySectors(formData.company_id).length === 0}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        getCompanySectors(formData.company_id).length === 0
                          ? 'Nenhum setor cadastrado para esta empresa'
                          : 'Selecione um setor'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {getCompanySectors(formData.company_id).map(sector => (
                      <SelectItem key={sector} value={sector}>
                        {sector}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit_position">Cargo</Label>
                <Input
                  id="edit_position"
                  value={formData.position}
                  onChange={e => setFormData({ ...formData, position: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit_permission">Permissão</Label>
                <Select
                  value={formData.permission_type}
                  onValueChange={value =>
                    setFormData({ ...formData, permission_type: value as Permission })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Usuário</SelectItem>
                    <SelectItem value="manager">Gestor</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit_avatar">Foto do Perfil</Label>
                <Input
                  id="edit_avatar"
                  type="file"
                  accept="image/*"
                  onChange={e => setFormData({ ...formData, avatar_file: e.target.files?.[0] || null })}
                />
                {selectedUser?.avatar_url && (
                  <p className="text-sm text-muted-foreground mt-1">Avatar atual será substituído se você selecionar um novo arquivo</p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleEdit}>Salvar Alterações</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Dialog */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir o usuário{' '}
                <strong>{selectedUser?.full_name}</strong>? Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
}




