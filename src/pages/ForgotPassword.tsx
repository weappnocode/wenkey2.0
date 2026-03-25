import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Target, Loader2, Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [email, setEmail] = useState('');

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetEmail = email.trim();

    if (!targetEmail) {
      toast.error('Informe o email utilizado no cadastro.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(targetEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;

      setSubmitted(true);
      toast.success('Link de recuperação enviado!');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível enviar o email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid md:grid-cols-2">
      {/* Coluna esquerda: formulário */}
      <div className="flex items-center justify-center p-8 bg-gradient-subtle">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="flex items-center justify-center mb-8 gap-3 cursor-pointer" onClick={() => navigate('/auth')}>
            <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center">
              <Target className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              Wenkey
            </h1>
          </div>

          <Card className="border-none shadow-xl bg-white/80 backdrop-blur-sm">
            <CardHeader className="text-center space-y-2">
              <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-2">
                <Mail className="w-7 h-7" />
              </div>
              <CardTitle className="text-2xl">Esqueceu a senha?</CardTitle>
              <CardDescription>
                {submitted 
                  ? "Verifique sua caixa de entrada para redefinir sua senha."
                  : "Não se preocupe! Insira seu email abaixo e enviaremos instruções para você."}
              </CardDescription>
            </CardHeader>

            <CardContent>
              {!submitted ? (
                <form onSubmit={handleResetRequest} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email de cadastro</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="seu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="h-11"
                      autoFocus
                    />
                  </div>
                  <Button type="submit" className="w-full h-11 text-base font-medium" disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      'Enviar link de recuperação'
                    )}
                  </Button>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    className="w-full" 
                    onClick={() => navigate('/auth')}
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Voltar para o login
                  </Button>
                </form>
              ) : (
                <div className="space-y-6">
                  <div className="flex flex-col items-center gap-2 py-4 text-center">
                    <CheckCircle2 className="w-12 h-12 text-success" />
                    <p className="font-medium text-foreground">Email enviado com sucesso!</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Se existir uma conta associada a <strong>{email}</strong>, você receberá um link em instantes.
                    </p>
                  </div>
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="w-full" 
                    onClick={() => navigate('/auth')}
                  >
                    Voltar ao login
                  </Button>
                  <p className="text-center text-xs text-muted-foreground px-4">
                    Não recebeu o email? Verifique sua caixa de spam ou tente novamente em alguns minutos.
                  </p>
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
            <h2 className="text-4xl font-bold mb-4 tracking-tight drop-shadow-2xl">
              Recupere seu acesso
            </h2>
            <p className="text-lg text-white/90 font-medium leading-relaxed">
              Estamos aqui para ajudar você a voltar ao comando dos seus OKRs.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
