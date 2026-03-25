import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { callN8nWebhook } from '@/lib/n8nWebhook';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Target, Loader2 } from 'lucide-react';


export default function Auth() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    company_id: '',
  });
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!formData.company_id) {
        toast.error('Selecione uma empresa para o cadastro.');
        setLoading(false);
        return;
      }

      const { error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            full_name: formData.fullName,
            company_id: formData.company_id,
            is_active: false,
          },
        },
      });

      if (error) throw error;

      // Dispara webhook n8n para notificar admins sobre novo cadastro (falha silenciosa)
      try {
        const selectedCompany = companies.find(c => c.id === formData.company_id);
        const companyName = selectedCompany?.name || 'Sua Empresa';

        // Busca emails dos admins/managers da empresa
        const { data: adminsData } = await supabase
          .from('profiles')
          .select('email')
          .eq('company_id', formData.company_id)
          .in('permission_type', ['admin', 'manager'])
          .eq('is_active', true);

        const adminEmails = adminsData && adminsData.length > 0
          ? adminsData.map(a => a.email).join(',')
          : '';

        if (adminEmails) {
          await callN8nWebhook('novocadastro', {
            type: 'new_user_registration',
            new_user_email: formData.email,
            new_user_name: formData.fullName,
            company_name: companyName,
            admin_emails: adminEmails,
            registered_at: new Date().toISOString(),
          });
        }
      } catch (webhookErr) {
        console.warn('[n8n] Webhook novocadastro falhou (não impacta o cadastro):', webhookErr);
      }

      toast.success('Conta criada! Confirme seu email. Após a confirmação, um administrador precisará ativar sua conta.');
      navigate(`/confirm-email?email=${encodeURIComponent(formData.email)}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao criar conta');
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (error) throw error;

      toast.success('Login realizado com sucesso!');
      navigate('/');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    document.title = 'Wenkey - Entrar ou Cadastrar';

    const loadCompanies = async () => {
      try {
        // Tenta via função SECURITY DEFINER para contornar RLS em ambiente público
        const { data, error } = await supabase.rpc('public_active_companies');

        if (error) {
          console.warn('RPC public_active_companies falhou, tentando select direto', error);
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('companies')
            .select('id, name')
            .eq('is_active', true)
            .order('name');

          if (fallbackError) throw fallbackError;
          setCompanies(fallbackData || []);
        } else {
          setCompanies((data as { id: string; name: string }[]) || []);
        }
      } catch (err) {
        console.error('Erro ao carregar empresas:', err);
        toast.error('Erro ao carregar empresas');
      }
    };

    loadCompanies();
  }, []);

  const { user } = useAuth(); // Add this to hook usage

  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);


  return (
    <div className="min-h-screen grid md:grid-cols-2">
      {/* Coluna esquerda: formulário */}
      <div className="flex items-center justify-center p-8 bg-gradient-subtle">
        <div className="w-full max-w-md">
          <div className="flex items-center justify-center mb-8 gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center">
              <Target className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              Wenkey
            </h1>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Bem-vindo</CardTitle>
              <CardDescription>
                Gerencie seus OKRs de forma eficiente e organizada
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs
                value={activeTab}
                onValueChange={(value) => setActiveTab(value as 'signin' | 'signup')}
                className="w-full"
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="signin">Entrar</TabsTrigger>
                  <TabsTrigger value="signup">Cadastrar</TabsTrigger>
                </TabsList>

                <TabsContent value="signin">
                  <form onSubmit={handleSignIn} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signin-email">Email</Label>
                      <Input
                        id="signin-email"
                        type="email"
                        placeholder="seu@email.com"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signin-password">Senha</Label>
                      <Input
                        id="signin-password"
                        type="password"
                        placeholder="••••••••"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        required
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Entrando...
                        </>
                      ) : (
                        'Entrar'
                      )}
                    </Button>
                  </form>
                  <div className="mt-4 text-center border-t pt-4">
                    <button
                      type="button"
                      className="text-sm text-muted-foreground hover:text-primary transition-colors"
                      onClick={() => navigate('/forgot-password')}
                    >
                      Esqueceu a senha?
                    </button>
                  </div>
                </TabsContent>

                <TabsContent value="signup">
                  <form onSubmit={handleSignUp} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-name">Nome Completo</Label>
                      <Input
                        id="signup-name"
                        type="text"
                        placeholder="João Silva"
                        value={formData.fullName}
                        onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-company">Empresa</Label>
                      <Select
                        value={formData.company_id}
                        onValueChange={(value) => setFormData({ ...formData, company_id: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={companies.length === 0 ? "Nenhuma empresa encontrada" : "Selecione uma empresa"} />
                        </SelectTrigger>
                        <SelectContent>
                          {companies.length === 0 ? (
                            <div className="p-2 text-sm text-muted-foreground">Carregando empresas...</div>
                          ) : (
                            companies.map((company) => (
                              <SelectItem key={company.id} value={company.id}>
                                {company.name}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-email">Email</Label>
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="seu@email.com"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-password">Senha</Label>
                      <Input
                        id="signup-password"
                        type="password"
                        placeholder="••••••••"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        required
                        minLength={6}
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Criando conta...
                        </>
                      ) : (
                        'Criar Conta'
                      )}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Coluna direita: imagem de escritório com overlay azul */}
      <div className="relative hidden md:block overflow-hidden">
        <img
          src="/images/office.jpg"
          alt="Escritório moderno"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-slate-900/40" />
        <div className="absolute inset-0 flex items-center justify-center p-10">
          <div className="max-w-md text-center text-white relative z-10 p-8 rounded-3xl bg-white/10 backdrop-blur-md border border-white/20 shadow-2xl">
            <h2 className="text-4xl font-bold mb-4 tracking-tight drop-shadow-2xl">Bem-vindo ao Wenkey</h2>
            <p className="text-lg text-white/90 font-medium leading-relaxed">Acompanhe metas, quarters e resultados em uma plataforma simples e poderosa.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
