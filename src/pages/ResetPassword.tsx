import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Target, ShieldCheck, Loader2, ArrowLeft } from 'lucide-react';

type ViewState = 'checking' | 'ready' | 'missing' | 'success';

const ResetPassword = () => {
  const navigate = useNavigate();
  const [viewState, setViewState] = useState<ViewState>('checking');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.title = 'Wenkey - Redefinir Senha';

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setViewState('ready');
      } else {
        setViewState('missing');
      }
    });
  }, []);

  const handleReset = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!password || password.length < 6) {
      toast.error('A senha precisa ter pelo menos 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('As senhas precisam ser iguais.');
      return;
    }

    setSubmitting(true);

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      toast.error(error.message);
      setSubmitting(false);
      return;
    }

    setViewState('success');
    toast.success('Senha atualizada com sucesso!');
    await supabase.auth.signOut();
    setTimeout(() => navigate('/auth'), 2500);
  };

  return (
    <div className="min-h-screen grid md:grid-cols-2">
      {/* Coluna esquerda: formulário */}
      <div className="flex items-center justify-center p-8 bg-gradient-subtle">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="flex items-center justify-center mb-8 gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center">
              <Target className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              Wenkey
            </h1>
          </div>

          <Card>
            <CardHeader className="text-center space-y-3">
              <div className="mx-auto w-14 h-14 rounded-full bg-gradient-primary flex items-center justify-center text-white">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <CardTitle>Redefinir senha</CardTitle>
              <CardDescription>
                Escolha uma nova senha segura para acessar o Wenkey.
              </CardDescription>
            </CardHeader>

            <CardContent>
              {/* Verificando sessão */}
              {viewState === 'checking' && (
                <div className="flex flex-col items-center gap-3 py-8 text-muted-foreground">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  <p className="text-sm">Validando o link…</p>
                </div>
              )}

              {/* Link inválido ou expirado */}
              {viewState === 'missing' && (
                <div className="space-y-5 text-center">
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    Este link de recuperação não é válido ou já foi utilizado.
                    Solicite um novo link na tela de login.
                  </p>
                  <Button
                    className="w-full"
                    onClick={() => navigate('/auth')}
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Voltar ao login
                  </Button>
                </div>
              )}

              {/* Formulário de nova senha */}
              {viewState === 'ready' && (
                <form onSubmit={handleReset} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-password">Nova senha</Label>
                    <Input
                      id="new-password"
                      type="password"
                      placeholder="Mínimo 6 caracteres"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      autoFocus
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirme a nova senha</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      placeholder="Repita a nova senha"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={6}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Atualizando…
                      </>
                    ) : (
                      'Atualizar senha'
                    )}
                  </Button>
                  <button
                    type="button"
                    className="w-full text-sm text-muted-foreground hover:text-primary transition-colors"
                    onClick={() => navigate('/auth')}
                  >
                    <ArrowLeft className="inline mr-1 h-3 w-3" />
                    Voltar ao login
                  </button>
                </form>
              )}

              {/* Sucesso */}
              {viewState === 'success' && (
                <div className="flex flex-col items-center gap-4 py-6 text-center">
                  <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                    <ShieldCheck className="w-8 h-8 text-green-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Senha atualizada!</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Redirecionando para o login…
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Coluna direita: imagem com overlay */}
      <div className="relative hidden md:block overflow-hidden">
        <img
          src="/images/office.jpg"
          alt="Escritório moderno"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-slate-900/40" />
        <div className="absolute inset-0 flex items-center justify-center p-10">
          <div className="max-w-md text-center text-white relative z-10 p-8 rounded-3xl bg-white/10 backdrop-blur-md border border-white/20 shadow-2xl">
            <ShieldCheck className="mx-auto w-12 h-12 mb-4 text-white/90" />
            <h2 className="text-4xl font-bold mb-4 tracking-tight drop-shadow-2xl">
              Segurança em primeiro lugar
            </h2>
            <p className="text-lg text-white/90 font-medium leading-relaxed">
              Crie uma senha forte para manter sua conta protegida e seus OKRs seguros.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
