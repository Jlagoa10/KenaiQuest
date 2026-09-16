import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Moon, Sun } from 'lucide-react';
import { THEME_PREFERENCE_LABELS } from '@kenai/shared';
import { Button } from '../components/ui/Button';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { SelectField, TextField } from '../components/ui/Field';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import * as authService from '../services/authService';
import { ApiError } from '../services/apiClient';

/** A curated list covering Brazil plus common diaspora zones, ordered sensibly. */
const TIMEZONES = [
  'America/Sao_Paulo',
  'America/Bahia',
  'America/Fortaleza',
  'America/Recife',
  'America/Belem',
  'America/Manaus',
  'America/Cuiaba',
  'America/Campo_Grande',
  'America/Porto_Velho',
  'America/Boa_Vista',
  'America/Rio_Branco',
  'America/Noronha',
  'America/New_York',
  'America/Los_Angeles',
  'Europe/Lisbon',
  'Europe/London',
  'Europe/Madrid',
  'Europe/Berlin',
  'UTC',
];

export function ProfilePage() {
  const { user, updateUser, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const { notify } = useToast();
  const navigate = useNavigate();

  const [name, setName] = useState(user?.name ?? '');
  const [timezone, setTimezone] = useState(user?.timezone ?? 'America/Sao_Paulo');
  const [isSaving, setIsSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // The stored timezone might not be in the curated list (set from the browser
  // at sign-up), so it is added rather than silently replaced.
  const timezoneOptions = TIMEZONES.includes(timezone) ? TIMEZONES : [timezone, ...TIMEZONES];

  async function handleSaveProfile(event: React.FormEvent) {
    event.preventDefault();
    setIsSaving(true);
    try {
      const updated = await authService.updateProfile({ name, timezone });
      updateUser(updated);
      notify('Perfil atualizado.', 'success');
    } catch (error) {
      notify(
        error instanceof ApiError ? error.message : 'Não foi possível salvar o perfil.',
        'error',
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleChangePassword(event: React.FormEvent) {
    event.preventDefault();
    setPasswordError(null);
    setIsChangingPassword(true);
    try {
      await authService.changePassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      // Changing the password revokes every session, this one included.
      notify('Senha alterada. Entre novamente com a nova senha.', 'success');
      await logout();
      navigate('/entrar', { replace: true });
    } catch (error) {
      setPasswordError(
        error instanceof ApiError ? error.message : 'Não foi possível alterar a senha.',
      );
    } finally {
      setIsChangingPassword(false);
    }
  }

  async function handleLogout() {
    await logout();
    navigate('/entrar', { replace: true });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold sm:text-3xl">Perfil</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Ajuste seus dados, fuso horário e preferência de tema.
        </p>
      </div>

      <Card>
        <CardHeader title="Seus dados" />
        <form onSubmit={handleSaveProfile}>
          <CardBody className="space-y-4">
            <TextField
              label="Nome"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              minLength={2}
              maxLength={60}
            />

            <TextField label="E-mail" value={user?.email ?? ''} disabled readOnly />

            <SelectField
              label="Fuso horário"
              value={timezone}
              onChange={(event) => setTimezone(event.target.value)}
              hint="Define o que conta como Hoje e Ontem ao concluir suas metas."
            >
              {timezoneOptions.map((zone) => (
                <option key={zone} value={zone}>
                  {zone.replace(/_/g, ' ')}
                </option>
              ))}
            </SelectField>
          </CardBody>
          <div className="flex justify-end border-t p-4 sm:p-5">
            <Button type="submit" isLoading={isSaving}>
              Salvar alterações
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <CardHeader title="Aparência" description="Sua preferência fica salva neste dispositivo." />
        <CardBody>
          <div className="flex gap-2">
            <Button
              variant={theme === 'light' ? 'primary' : 'secondary'}
              icon={<Sun size={16} />}
              onClick={() => setTheme('light')}
              className="flex-1"
              aria-pressed={theme === 'light'}
            >
              {THEME_PREFERENCE_LABELS.light}
            </Button>
            <Button
              variant={theme === 'dark' ? 'primary' : 'secondary'}
              icon={<Moon size={16} />}
              onClick={() => setTheme('dark')}
              className="flex-1"
              aria-pressed={theme === 'dark'}
            >
              {THEME_PREFERENCE_LABELS.dark}
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Alterar senha" />
        <form onSubmit={handleChangePassword}>
          <CardBody className="space-y-4">
            <TextField
              label="Senha atual"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              required
            />
            <TextField
              label="Nova senha"
              type="password"
              autoComplete="new-password"
              hint="Mínimo de 8 caracteres, com letras e números."
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              required
              minLength={8}
              {...(passwordError ? { error: passwordError } : {})}
            />
          </CardBody>
          <div className="flex justify-end border-t p-4 sm:p-5">
            <Button
              type="submit"
              variant="secondary"
              isLoading={isChangingPassword}
              disabled={!currentPassword || !newPassword}
            >
              Alterar senha
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <CardBody>
          <Button variant="danger" fullWidth icon={<LogOut size={16} />} onClick={handleLogout}>
            Sair da conta
          </Button>
        </CardBody>
      </Card>
    </div>
  );
}
