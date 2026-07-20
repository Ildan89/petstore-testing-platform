import { useEffect, useState } from 'react';
import { api, isAdmin } from '../api/client';
import type { Order, Pet, PetsResponse } from '../api/types';
import { orderStatusRu } from '../api/labels';
import { PageSizeSelect, apiLimit, DEFAULT_PAGE_SIZE } from '../components/PageSize';
import { SellerFilter } from '../components/SellerFilter';
import { Modal } from '../components/Modal';

interface OrdersResponse {
  data: Order[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

const NEXT_STATUS: Record<string, string> = {
  placed: 'approved',
  approved: 'delivered',
};

export default function OrdersPage() {
  const admin = isAdmin();
  const [orders, setOrders] = useState<Order[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);
  const [petId, setPetId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [buyerName, setBuyerName] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [error, setError] = useState('');
  // поиск по животному + фильтр по продавцу (admin) + пагинация
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [sellerId, setSellerId] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [total, setTotal] = useState(0);

  const load = async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (admin && sellerId) params.set('seller_id', sellerId);
      params.set('page', String(page));
      params.set('limit', String(apiLimit(pageSize)));
      const res = await api.get<OrdersResponse>(`/orders?${params.toString()}`);
      setOrders(res.data || []);
      setTotal(res.pagination?.total || 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    }
  };

  const loadPets = async () => {
    try {
      const res = await api.get<PetsResponse>('/pets?limit=100&status=available');
      setPets(res.data || []);
    } catch { /* тихо */ }
  };

  useEffect(() => {
    load();
  }, [page, pageSize, search, sellerId]);

  useEffect(() => {
    loadPets();
  }, []);

  const totalPages = Math.ceil(total / pageSize);

  const createOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!petId) return;

    const body = {
      pet_id: petId,
      quantity,
      buyer_name: buyerName,
      buyer_phone: buyerPhone,
    };

    // BUG #3: один клик — два одинаковых POST-запроса (double submit).
    // Видно на вкладке Network: два вызова вместо одного.
    api.post('/orders', body).catch(() => {});
    try {
      await api.post('/orders', body);
      setPetId('');
      setQuantity(1);
      setBuyerName('');
      setBuyerPhone('');
      setShowOrderForm(false);
      load();
      loadPets();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    }
  };

  const changeStatus = async (order: Order) => {
    const next = NEXT_STATUS[order.status];
    if (!next) return;
    try {
      await api.put(`/orders/${order.id}/status`, { status: next });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    }
  };

  const cancel = async (order: Order) => {
    if (!confirm('Отменить заказ?')) return;
    try {
      await api.put(`/orders/${order.id}/status`, { status: 'cancelled' });
      load();
      loadPets();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    }
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });

  return (
    <div>
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0 }}>Заказы</h2>
          <button onClick={() => { setError(''); setShowOrderForm(true); }}>
            + Оформить заказ
          </button>
        </div>
      </div>

      {showOrderForm && (
        <Modal title="Оформить заказ" onClose={() => setShowOrderForm(false)}>
          <form onSubmit={createOrder}>
            <div className="form-field">
              <label>Питомец</label>
              <select value={petId} onChange={(e) => setPetId(e.target.value)}>
                <option value="">Выберите питомца (доступного)</option>
                {pets.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label>Количество</label>
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
              />
            </div>
            <div className="form-field">
              <label>Имя покупателя</label>
              <input
                placeholder="Имя покупателя"
                maxLength={100}
                value={buyerName}
                onChange={(e) => setBuyerName(e.target.value)}
              />
            </div>
            <div className="form-field">
              <label>Телефон</label>
              <input
                placeholder="+7XXXXXXXXXX"
                maxLength={20}
                value={buyerPhone}
                onChange={(e) => setBuyerPhone(e.target.value)}
              />
            </div>
            {error && <div className="error">{error}</div>}
            <div className="row">
              <button type="submit">Оформить заказ</button>
              <button type="button" className="secondary" onClick={() => setShowOrderForm(false)}>
                Отмена
              </button>
            </div>
          </form>
        </Modal>
      )}

      <div className="card">
        <form
          className="row"
          onSubmit={(e) => { e.preventDefault(); setSearch(searchInput); setPage(1); }}
        >
          <input
            placeholder="Поиск по названию животного..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            style={{ flex: 1 }}
          />
          <button type="submit">Найти</button>
          {admin && (
            <SellerFilter value={sellerId} onChange={(v) => { setSellerId(v); setPage(1); }} />
          )}
          {(search || sellerId) && (
            <button
              type="button"
              className="secondary"
              onClick={() => { setSearch(''); setSearchInput(''); setSellerId(''); setPage(1); }}
            >
              Сбросить
            </button>
          )}
        </form>
      </div>

      <table className="clip-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Питомец</th>
            <th>Продавец</th>
            <th>Покупатель</th>
            <th>Кол-во</th>
            <th>Статус</th>
            <th>Дата</th>
            <th>Действия</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id}>
              <td>{o.id}</td>
              <td>{o.pet_name}</td>
              <td>{o.seller_name}</td>
              <td>
                {o.buyer_name || '—'}
                {o.buyer_phone ? <div style={{ fontSize: 12, color: '#888' }}>{o.buyer_phone}</div> : null}
              </td>
              <td>{o.quantity}</td>
              <td>{orderStatusRu(o.status)}</td>
              <td>{formatDate(o.placed_at)}</td>
              <td>
                <div className="row">
                  {NEXT_STATUS[o.status] && (
                    <button className="secondary" onClick={() => changeStatus(o)}>
                      → {orderStatusRu(NEXT_STATUS[o.status])}
                    </button>
                  )}
                  {o.status !== 'cancelled' && o.status !== 'delivered' && (
                    <button className="danger" onClick={() => cancel(o)}>Отменить</button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="row" style={{ marginTop: 16, justifyContent: 'center' }}>
        <button className="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
          ← Назад
        </button>
        <span>Страница {page} из {totalPages || 1}</span>
        <button className="secondary" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
          Вперёд →
        </button>
        <PageSizeSelect value={pageSize} onChange={(v) => { setPageSize(v); setPage(1); }} />
      </div>
    </div>
  );
}
