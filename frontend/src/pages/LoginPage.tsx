import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setToken } from '../api/client';
import { PawIcon } from '../components/Logo';
import { useSnackbar } from '../components/Snackbar';

export default function LoginPage() {
  const navigate = useNavigate();
  const { notify } = useSnackbar();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === 'register' && password !== confirm) {
      notify('Пароли не совпадают');
      return;
    }

    const path = mode === 'login' ? '/auth/login' : '/auth/register';
    try {
      const res = await api.post<{ token: string }>(path, {
        username,
        password,
        confirm_password: confirm,
      });
      setToken(res.token);
      navigate('/task');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Ошибка');
    }
  };

  return (
    <div style={{ maxWidth: 420, margin: '60px auto' }}>
      <div className="login-logo">
        <span className="login-logo-icon">
          <PawIcon size={44} />
        </span>
        <div className="login-logo-text">
          <div className="login-logo-title">ЗооМаркет</div>
          <div className="login-logo-sub">CRM для продавцов</div>
        </div>
      </div>
      <div className="warning-banner">
        ⚠️ Это учебная платформа для тестовых заданий. Не вводите реальные
        логины и пароли — данные могут быть общедоступны.
      </div>
      <div className="card">
        <h2>{mode === 'login' ? 'Вход' : 'Регистрация'}</h2>
        <form onSubmit={submit}>
          <div className="form-field">
            <label>Логин</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div className="form-field">
            <label>Пароль</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {mode === 'register' && (
            <div className="form-field">
              <label>Подтверждение пароля</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
          )}
          <button type="submit" style={{ width: '100%', marginTop: 8 }}>
            {mode === 'login' ? 'Войти' : 'Зарегистрироваться'}
          </button>
        </form>
        <p style={{ marginTop: 16, textAlign: 'center' }}>
          {mode === 'login' ? (
            <a onClick={() => setMode('register')} style={{ cursor: 'pointer' }}>
              Нет аккаунта? Регистрация
            </a>
          ) : (
            <a onClick={() => setMode('login')} style={{ cursor: 'pointer' }}>
              Уже есть аккаунт? Вход
            </a>
          )}
        </p>
      </div>
    </div>
  );
}
