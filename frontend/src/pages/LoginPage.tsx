import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setToken } from '../api/client';

export default function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // BUG: при регистрации проверка совпадения паролей только на клиенте,
    // и сравнение нестрогое — можно обойти. А бэк confirm вообще игнорирует.
    if (mode === 'register' && password != confirm) {
      setError('Пароли не совпадают');
      return;
    }

    const path = mode === 'login' ? '/auth/login' : '/auth/register';
    const res = await api.post<{ token?: string; error?: string }>(path, {
      username,
      password,
      confirm_password: confirm,
    });

    // BUG: если token есть — заходим, но не показываем ошибку когда его нет
    if (res.token) {
      setToken(res.token);
      navigate('/pets');
    } else {
      // BUG: показываем res.error, но иногда там undefined → "undefined"
      setError(res.error || 'Ошибка');
    }
  };

  return (
    <div style={{ maxWidth: 380, margin: '80px auto' }}>
      <div className="card">
        <h2>{mode === 'login' ? 'Вход' : 'Регистрация'}</h2>
        {error && <div className="error">{error}</div>}
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
            <a onClick={() => setMode('register')}>Нет аккаунта? Регистрация</a>
          ) : (
            <a onClick={() => setMode('login')}>Уже есть аккаунт? Вход</a>
          )}
        </p>
      </div>
    </div>
  );
}
