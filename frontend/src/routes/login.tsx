import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { Check, Loader2, Lock, Mail, MapPin, User } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#/components/ui/tabs'
import {
  sendPasswordReset,
  signInWithEmail,
  signUpWithEmail,
} from '#/features/auth/authService'
import { useCities } from '#/features/tournaments/tournamentQueries'
import { useToast } from '#/hooks/useToast'

export const Route = createFileRoute('/login')({
  component: LoginPage,
})

function LoginPage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)

  const [loginForm, setLoginForm] = useState({ email: '', password: '' })
  const [signUpForm, setSignUpForm] = useState({ name: '', email: '', password: '' })
  const [selectedCities, setSelectedCities] = useState<string[]>([])
  const [resetEmail, setResetEmail] = useState('')
  const [resetSent, setResetSent] = useState(false)

  const { data: cities = [] } = useCities()

  function toggleCity(id: string) {
    setSelectedCities((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    )
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await signInWithEmail(loginForm.email, loginForm.password)
      void navigate({ to: '/' })
    } catch {
      toast({ variant: 'destructive', title: 'Email ou senha incorretos.' })
    } finally {
      setLoading(false)
    }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault()
    if (!signUpForm.name.trim()) {
      toast({ variant: 'destructive', title: 'Informe seu nome.' })
      return
    }
    if (selectedCities.length === 0) {
      toast({ variant: 'destructive', title: 'Selecione pelo menos uma cidade.' })
      return
    }
    setLoading(true)
    try {
      await signUpWithEmail(signUpForm.name, signUpForm.email, signUpForm.password, selectedCities)
      void navigate({ to: '/' })
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro ao criar conta', description: String(err) })
    } finally {
      setLoading(false)
    }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await sendPasswordReset(resetEmail)
      setResetSent(true)
    } catch {
      toast({ variant: 'destructive', title: 'Email não encontrado.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rise-in">
        <div className="mb-8 text-center">
          <h1 className="display-title text-4xl font-bold text-[var(--sea-ink)]">ArenaDraft</h1>
          <p className="mt-1 text-sm text-[var(--sea-ink-soft)]">Vôlei de areia. Ranking real.</p>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-center text-lg">Acesse sua conta</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login">
              <TabsList className="w-full mb-6">
                <TabsTrigger value="login" className="flex-1">
                  Entrar
                </TabsTrigger>
                <TabsTrigger value="signup" className="flex-1">
                  Cadastrar
                </TabsTrigger>
                <TabsTrigger value="reset" className="flex-1">
                  Recuperar
                </TabsTrigger>
              </TabsList>

              {/* LOGIN */}
              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="login-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[var(--sea-ink-soft)]" />
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="seu@email.com"
                        className="pl-9"
                        value={loginForm.email}
                        onChange={(e) => setLoginForm((f) => ({ ...f, email: e.target.value }))}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="login-password">Senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[var(--sea-ink-soft)]" />
                      <Input
                        id="login-password"
                        type="password"
                        placeholder="••••••••"
                        className="pl-9"
                        value={loginForm.password}
                        onChange={(e) => setLoginForm((f) => ({ ...f, password: e.target.value }))}
                        required
                      />
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? <Loader2 className="size-4 animate-spin" /> : 'Entrar'}
                  </Button>
                </form>
              </TabsContent>

              {/* SIGN UP */}
              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="signup-name">Nome</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[var(--sea-ink-soft)]" />
                      <Input
                        id="signup-name"
                        type="text"
                        placeholder="Seu nome completo"
                        className="pl-9"
                        value={signUpForm.name}
                        onChange={(e) => setSignUpForm((f) => ({ ...f, name: e.target.value }))}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="signup-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[var(--sea-ink-soft)]" />
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="seu@email.com"
                        className="pl-9"
                        value={signUpForm.email}
                        onChange={(e) => setSignUpForm((f) => ({ ...f, email: e.target.value }))}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="signup-password">Senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[var(--sea-ink-soft)]" />
                      <Input
                        id="signup-password"
                        type="password"
                        placeholder="Mínimo 6 caracteres"
                        className="pl-9"
                        minLength={6}
                        value={signUpForm.password}
                        onChange={(e) => setSignUpForm((f) => ({ ...f, password: e.target.value }))}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5">
                      <MapPin className="size-4" />
                      Cidades <span className="text-[var(--sea-ink-soft)] font-normal">(selecione onde joga)</span>
                    </Label>
                    {cities.length === 0 ? (
                      <p className="text-xs text-[var(--sea-ink-soft)] py-2">Nenhuma cidade cadastrada ainda.</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                        {cities.map((city) => {
                          const active = selectedCities.includes(city.id)
                          return (
                            <button
                              key={city.id}
                              type="button"
                              onClick={() => toggleCity(city.id)}
                              className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2 text-sm text-left transition-all cursor-pointer ${
                                active
                                  ? 'border-[var(--lagoon-deep)] bg-[var(--foam)] font-medium text-[var(--lagoon-deep)]'
                                  : 'border-[var(--line)] text-[var(--sea-ink)] hover:border-[var(--lagoon)]'
                              }`}
                            >
                              {active && <Check className="size-3.5 flex-shrink-0" />}
                              {city.name}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? <Loader2 className="size-4 animate-spin" /> : 'Criar conta'}
                  </Button>
                </form>
              </TabsContent>

              {/* RESET PASSWORD */}
              <TabsContent value="reset">
                {resetSent ? (
                  <div className="flex flex-col items-center gap-3 py-6 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--foam)] text-[var(--palm)]">
                      <Mail className="size-6" />
                    </div>
                    <p className="font-semibold text-[var(--sea-ink)]">Email enviado!</p>
                    <p className="text-sm text-[var(--sea-ink-soft)]">
                      Verifique sua caixa de entrada para redefinir sua senha.
                    </p>
                    <Button variant="ghost" size="sm" onClick={() => setResetSent(false)}>
                      Tentar novamente
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleReset} className="space-y-4">
                    <p className="text-sm text-[var(--sea-ink-soft)]">
                      Informe seu email e enviaremos um link para redefinir sua senha.
                    </p>
                    <div className="space-y-1.5">
                      <Label htmlFor="reset-email">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[var(--sea-ink-soft)]" />
                        <Input
                          id="reset-email"
                          type="email"
                          placeholder="seu@email.com"
                          className="pl-9"
                          value={resetEmail}
                          onChange={(e) => setResetEmail(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? <Loader2 className="size-4 animate-spin" /> : 'Enviar link'}
                    </Button>
                  </form>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
