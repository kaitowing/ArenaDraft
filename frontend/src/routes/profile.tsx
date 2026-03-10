import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { ArrowLeft, Save, Trophy, Target, MapPin, Venus, Mars, Sparkles } from 'lucide-react'
import { AuthGuard } from '#/features/auth/AuthGuard'
import { useAuth } from '#/features/auth/useAuth'
import { useCities, useAppUserRealtime } from '#/features/tournaments/tournamentQueries'
import { updateUserProfile } from '#/features/auth/authService'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '#/components/ui/avatar'
import { useToast } from '#/hooks/useToast'
import type { Gender } from '#/types'

export const Route = createFileRoute('/profile')({
  component: ProfilePage,
})

function ProfilePage() {
  return (
    <AuthGuard>
      <ProfileContent />
    </AuthGuard>
  )
}

function getInitials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

function genderLabel(gender: Gender) {
  switch (gender) {
    case 'male':
      return 'Masculino'
    case 'female':
      return 'Feminino'
  }
}

function genderIcon(gender: Gender) {
  switch (gender) {
    case 'male':
      return <Mars className="size-3.5" />
    case 'female':
      return <Venus className="size-3.5" />
  }
}

function ProfileContent() {
  const { user: firebaseUser } = useAuth()
  const { toast } = useToast()
  const { data: cities = [] } = useCities()

  const { data: appUser, isLoading } = useAppUserRealtime(firebaseUser?.uid)

  const [saving, setSaving] = useState(false)
  const [displayName, setDisplayName] = useState(appUser?.displayName || firebaseUser?.displayName || '')
  const [selectedCities, setSelectedCities] = useState<string[]>(appUser?.cities || [])
  const [gender, setGender] = useState<Gender | null>(appUser?.gender ?? null)

  useEffect(() => {
    if (appUser) {
      setDisplayName(appUser.displayName || firebaseUser?.displayName || '')
      setSelectedCities(appUser.cities || [])
      setGender(appUser.gender ?? null)
    }
  }, [appUser, firebaseUser])

  if (!firebaseUser || isLoading) {
    return (
      <main className="mx-auto max-w-lg px-4 pb-28 pt-6">
        <div className="mb-6">
          <Link to="/" className="mb-3 flex items-center gap-1 text-sm text-[var(--sea-ink-soft)] hover:text-[var(--sea-ink)]">
            <ArrowLeft className="size-4" />
            Voltar
          </Link>
          <div className="h-8 bg-[var(--surface)] rounded animate-pulse" />
        </div>
        <div className="space-y-4">
          <div className="h-32 bg-[var(--surface)] rounded-2xl animate-pulse" />
          <div className="h-64 bg-[var(--surface)] rounded-2xl animate-pulse" />
        </div>
      </main>
    )
  }

  if (!appUser) {
    return (
      <main className="mx-auto max-w-lg px-4 pt-6 text-center">
        <p className="text-[var(--sea-ink-soft)]">Perfil não encontrado.</p>
      </main>
    )
  }

  const toggleCity = (cityId: string) => {
    setSelectedCities(prev =>
      prev.includes(cityId)
        ? prev.filter(id => id !== cityId)
        : [...prev, cityId]
    )
  }

  const handleSave = async () => {
    if (!firebaseUser) return

    const name = displayName.trim()
    if (!name) {
      toast({ variant: 'destructive', title: 'Nome é obrigatório' })
      return
    }

    setSaving(true)
    try {
      await updateUserProfile(firebaseUser.uid, { displayName: name, cities: selectedCities, gender })
      toast({ title: 'Perfil atualizado!' })
      // Force page reload to get updated user data
      window.location.reload()
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro ao salvar', description: String(err) })
    } finally {
      setSaving(false)
    }
  }

  const selectedCityObjects = cities.filter(city => selectedCities.includes(city.id))

  return (
    <main className="mx-auto max-w-lg px-4 pb-28 pt-6">
      <div className="mb-6 rise-in">
        <Link
          to="/"
          className="mb-3 flex items-center gap-1 text-sm text-[var(--sea-ink-soft)] hover:text-[var(--sea-ink)]"
        >
          <ArrowLeft className="size-4" />
          Voltar
        </Link>
        <h1 className="display-title text-2xl font-bold text-[var(--sea-ink)]">Meu Perfil</h1>
      </div>

      <div className="space-y-6">
        {/* Profile Header */}
        <Card className="rise-in">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={firebaseUser.photoURL ?? undefined} />
                <AvatarFallback className="text-xl">
                  {getInitials(firebaseUser.displayName || 'U')}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-[var(--sea-ink)]">
                  {appUser.displayName}
                </h2>
                <p className="text-sm text-[var(--sea-ink-soft)]">
                  MMR: {appUser.mmr}
                </p>
                {gender && (
                  <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-[var(--surface)] px-3 py-1 text-xs font-semibold text-[var(--sea-ink)]">
                    {genderIcon(gender)}
                    {genderLabel(gender)}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <Card className="rise-in" style={{ animationDelay: '60ms' }}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="size-4 text-[var(--lagoon-deep)]" />
              Estatísticas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-[var(--lagoon-deep)]">
                  {appUser.stats.matchesWon}
                </p>
                <p className="text-xs text-[var(--sea-ink-soft)]">Vitórias</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-[var(--sea-ink)]">
                  {appUser.stats.matchesLost}
                </p>
                <p className="text-xs text-[var(--sea-ink-soft)]">Derrotas</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-[var(--sea-ink-soft)]">
                  {appUser.stats.tournamentsPlayed}
                </p>
                <p className="text-xs text-[var(--sea-ink-soft)]">Torneios</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Edit Profile */}
        <Card className="rise-in" style={{ animationDelay: '120ms' }}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="size-4 text-[var(--lagoon-deep)]" />
              Editar Perfil
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label htmlFor="display-name" className="block text-sm font-semibold text-[var(--sea-ink)] mb-2">
                Nome de exibição
              </label>
              <Input
                id="display-name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Seu nome"
                maxLength={50}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-[var(--sea-ink)] mb-2 flex items-center gap-2">
                <MapPin className="size-4" />
                Cidades favoritas
              </label>
              <div className="flex flex-wrap gap-2">
                {cities.map((city) => (
                  <button
                    key={city.id}
                    type="button"
                    onClick={() => toggleCity(city.id)}
                    className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                      selectedCities.includes(city.id)
                        ? 'bg-[var(--lagoon-deep)] text-white'
                        : 'bg-[var(--surface)] border border-[var(--line)] text-[var(--sea-ink-soft)] hover:border-[var(--lagoon-deep)]'
                    }`}
                  >
                    {city.name}
                  </button>
                ))}
              </div>
              {selectedCityObjects.length > 0 && (
                <p className="text-xs text-[var(--sea-ink-soft)] mt-2">
                  Cidades selecionadas: {selectedCityObjects.map(c => c.name).join(', ')}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-[var(--sea-ink)] mb-2 flex items-center gap-2">
                <Sparkles className="size-4" />
                Gênero esportivo
              </label>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { value: 'male' as Gender, label: 'Masculino', icon: Mars },
                  { value: 'female' as Gender, label: 'Feminino', icon: Venus },
                ]).map(({ value, label, icon: Icon }) => {
                  const active = gender === value
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setGender(value)}
                      className={`flex flex-col items-center gap-1 rounded-xl border-2 px-3 py-2 text-xs font-semibold transition-all cursor-pointer ${
                        active
                          ? 'border-[var(--lagoon-deep)] bg-[var(--foam)] text-[var(--lagoon-deep)]'
                          : 'border-[var(--line)] text-[var(--sea-ink-soft)] hover:border-[var(--lagoon)]'
                      }`}
                    >
                      <Icon className="size-4" />
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>

            <Button
              onClick={handleSave}
              disabled={saving}
              className="w-full"
            >
              {saving ? 'Salvando...' : (
                <>
                  <Save className="size-4 mr-2" />
                  Salvar alterações
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
