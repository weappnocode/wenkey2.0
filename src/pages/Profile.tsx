import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, KeyRound, User as UserIcon } from 'lucide-react';
import { toTitleCase } from '@/lib/utils';

export default function Profile() {
  const { profile, user } = useAuth();
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const getInitials = (name?: string) => {
    if (!name) return '';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      toast.error('A nova senha deve ter pelo menos 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('As senhas não coincidem.');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        throw error;
      }

      toast.success('Senha atualizada com sucesso!');
      setPassword('');
      setConfirmPassword('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao atualizar senha');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-4xl max-w-full mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-black">Meu Perfil</h1>
          <p className="text-muted-foreground text-sm">Gerencie as configurações da sua conta e preferências.</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Dados do Usuário */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <UserIcon className="w-5 h-5 text-primary" />
                Informações Pessoais
              </CardTitle>
              <CardDescription>Visualização dos seus dados vinculados à conta</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col items-center gap-4 pb-4">
                <Avatar className="w-24 h-24 border-4 border-muted">
                  {profile?.avatar_url ? (
                    <AvatarImage src={profile.avatar_url} alt={profile.full_name} className="object-cover" />
                  ) : (
                    <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                      {getInitials(profile?.full_name)}
                    </AvatarFallback>
                  )}
                </Avatar>
                <div className="text-center space-y-1">
                  <h3 className="font-semibold text-lg">{profile?.full_name ? toTitleCase(profile.full_name) : 'Usuário'}</h3>
                  <p className="text-sm text-muted-foreground">{profile?.position ? toTitleCase(profile.position) : 'Sem Cargo Definido'}</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <span className="font-medium text-sm text-muted-foreground">E-mail</span>
                  <span className="col-span-2 text-sm">{user?.email}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <span className="font-medium text-sm text-muted-foreground">Status</span>
                  <span className="col-span-2 text-sm">
                    {profile?.is_active ? (
                      <span className="text-green-600 bg-green-100 px-2 py-0.5 rounded-full text-xs font-medium">Ativo</span>
                    ) : (
                      <span className="text-yellow-600 bg-yellow-100 px-2 py-0.5 rounded-full text-xs font-medium">Inativo</span>
                    )}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <span className="font-medium text-sm text-muted-foreground">Permissão</span>
                  <span className="col-span-2 text-sm uppercase text-xs font-semibold text-primary">{profile?.permission_type || 'USER'}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Alteração de Senha */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <KeyRound className="w-5 h-5 text-primary" />
                Alterar Senha
              </CardTitle>
              <CardDescription>Utilize esta seção para modificar sua senha de acesso atual</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="newPassword">Nova Senha</Label>
                  <Input 
                    id="newPassword" 
                    type="password" 
                    placeholder="Mínimo de 6 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
                  <Input 
                    id="confirmPassword" 
                    type="password" 
                    placeholder="Repita a nova senha"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
                
                <Button type="submit" className="w-full mt-4" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Atualizando...
                    </>
                  ) : (
                    'Salvar Nova Senha'
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}