interface Endpoint {
  method: string;
  path: string;
  auth: boolean;
  desc: string;
  body?: string;
}

const ENDPOINTS: { group: string; items: Endpoint[] }[] = [
  {
    group: 'Авторизация',
    items: [
      { method: 'POST', path: '/api/auth/register', auth: false, desc: 'Регистрация продавца', body: '{ "username", "password", "confirm_password" }' },
      { method: 'POST', path: '/api/auth/login', auth: false, desc: 'Вход, возвращает JWT-токен', body: '{ "username", "password" }' },
      { method: 'GET', path: '/api/auth/me', auth: true, desc: 'Текущий профиль' },
    ],
  },
  {
    group: 'Питомцы',
    items: [
      { method: 'GET', path: '/api/pets', auth: true, desc: 'Список (search, category_id, status, page, limit)' },
      { method: 'GET', path: '/api/pets/:id', auth: true, desc: 'Один питомец по id' },
      { method: 'POST', path: '/api/pets', auth: true, desc: 'Создать', body: '{ "name", "category_id", "status", "price", "description" }' },
      { method: 'PUT', path: '/api/pets/:id', auth: true, desc: 'Обновить' },
      { method: 'DELETE', path: '/api/pets/:id', auth: true, desc: 'Удалить' },
    ],
  },
  {
    group: 'Заказы',
    items: [
      { method: 'GET', path: '/api/orders', auth: true, desc: 'Список заказов' },
      { method: 'POST', path: '/api/orders', auth: true, desc: 'Оформить заказ', body: '{ "pet_id", "quantity", "buyer_name", "buyer_phone" }' },
      { method: 'PUT', path: '/api/orders/:id/status', auth: true, desc: 'Сменить статус', body: '{ "status": "approved|delivered|cancelled" }' },
      { method: 'DELETE', path: '/api/orders/:id', auth: true, desc: 'Удалить заказ' },
    ],
  },
  {
    group: 'Прочее',
    items: [
      { method: 'GET', path: '/api/categories', auth: true, desc: 'Список категорий' },
      { method: 'GET', path: '/api/dashboard', auth: true, desc: 'Счётчики продавца' },
      { method: 'GET', path: '/api/logs', auth: true, desc: 'Логи (level, source=db|file, search)' },
      { method: 'POST', path: '/api/sql/execute', auth: true, desc: 'Выполнить SELECT-запрос', body: '{ "query": "SELECT ..." }' },
    ],
  },
];

const methodColor: Record<string, string> = {
  GET: '#2e7d32',
  POST: '#1565c0',
  PUT: '#ef6c00',
  DELETE: '#c62828',
};

export default function DocsPage() {
  return (
    <div>
      <h2>Документация API</h2>

      <div className="card">
        <h3>Авторизация</h3>
        <p style={{ color: '#555' }}>
          Все методы, кроме <code>/api/auth/register</code> и{' '}
          <code>/api/auth/login</code>, требуют заголовок:
        </p>
        <pre className="code-block">Authorization: Bearer &lt;token&gt;</pre>
        <p style={{ color: '#555' }}>
          Токен выдаётся при входе/регистрации и действует 24 часа.
        </p>
      </div>

      {ENDPOINTS.map((g) => (
        <div className="card" key={g.group}>
          <h3>{g.group}</h3>
          {g.items.map((e, i) => (
            <div key={i} className="endpoint">
              <span className="method" style={{ background: methodColor[e.method] }}>
                {e.method}
              </span>
              <code className="endpoint-path">{e.path}</code>
              {e.auth && <span className="lock" title="Требует токен">🔒</span>}
              <div className="endpoint-desc">{e.desc}</div>
              {e.body && <pre className="code-block small">{e.body}</pre>}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
