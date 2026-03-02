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
import { Plus, Pencil, Trash2, Send, UserPlus } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useUserRole } from '@/hooks/useUserRole';
import { toast } from 'sonner';
import { toTitleCase } from '@/lib/utils';

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
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
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

      toast.success('Status atualizado com sucesso!');
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

      // Usa o mode 'no-cors' porque o n8n não retorna headers de CORS na web
      const response = await fetch('https://n8n-terj.onrender.com/webhook/emailAtivo', {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      // Quando usamos no-cors, o response é "opaco", então não podemos validar o boolean ok
      toast.success('Requisição de teste enviada! Verifique o n8n.');
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

      const response = await fetch('https://n8n-terj.onrender.com/webhook/novocadastro', {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      toast.success('Teste de novo cadastro enviado! Verifique o n8n.');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      toast.error('Erro ao enviar teste: ' + message);
    }
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




