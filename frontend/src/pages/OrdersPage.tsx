import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { Order, Pet, PetsResponse } from '../api/types';
import { orderStatusRu } from '../api/labels';

const NEXT_STATUS: Record<string, string> = {
  placed: 'approved',
  approved: 'delivered',
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);
  const [petId, setPetId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [buyerName, setBuyerName] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const res = await api.get<Order[]>('/orders');
      setOrders(res || []);
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
    loadPets();
  }, []);

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
        <h2>Оформить заказ</h2>
        <form onSubmit={createOrder}>
          <div className="row">
            <select value={petId} onChange={(e) => setPetId(e.target.value)} style={{ flex: 1 }}>
              <option value="">Выберите питомца (доступного)</option>
              {pets.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              style={{ width: 80 }}
            />
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <input
              placeholder="Имя покупателя"
              value={buyerName}
              onChange={(e) => setBuyerName(e.target.value)}
              style={{ flex: 1 }}
            />
            <input
              placeholder="+7XXXXXXXXXX"
              value={buyerPhone}
              onChange={(e) => setBuyerPhone(e.target.value)}
              style={{ flex: 1 }}
            />
            <button type="submit">Заказать</button>
          </div>
        </form>
        {error && <div className="error" style={{ marginTop: 8 }}>{error}</div>}
      </div>

      <table>
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
    </div>
  );
}
