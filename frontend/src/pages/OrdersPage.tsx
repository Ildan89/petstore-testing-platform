import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { Order, Pet, PetsResponse } from '../api/types';

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);
  const [petId, setPetId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    const res = await api.get<Order[]>('/orders');
    setOrders(res || []);
  };

  const loadPets = async () => {
    const res = await api.get<PetsResponse>('/pets?limit=100');
    setPets(res.data || []);
  };

  useEffect(() => {
    load();
    loadPets();
  }, []);

  const createOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!petId) return;

    // BUG: submitting-флаг ставится, но кнопка не блокируется по нему →
    // двойной клик создаёт два заказа (double submit)
    setSubmitting(true);
    await api.post('/orders', { pet_id: petId, quantity });
    setSubmitting(false);
    setPetId('');
    setQuantity(1);
    load();
  };

  const cancel = async (id: number) => {
    // BUG: удаление без подтверждения + любой чужой заказ можно отменить
    await api.del(`/orders/${id}`);
    load();
  };

  const formatDate = (d: string) => {
    // BUG: неверный формат даты — используем toLocaleDateString без времени,
    // и не учитываем таймзону, дата «плавает»
    return new Date(d).toLocaleDateString();
  };

  return (
    <div>
      <div className="card">
        <h2>Оформить заказ</h2>
        <form onSubmit={createOrder} className="row">
          <select value={petId} onChange={(e) => setPetId(e.target.value)} style={{ flex: 1 }}>
            <option value="">Выберите питомца</option>
            {pets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.status})
              </option>
            ))}
          </select>
          <input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            style={{ width: 80 }}
          />
          {/* BUG: кнопка не disabled при submitting */}
          <button type="submit">Заказать</button>
        </form>
      </div>

      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Питомец</th>
            <th>Покупатель</th>
            <th>Кол-во</th>
            <th>Статус</th>
            <th>Дата</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id}>
              <td>{o.id}</td>
              <td>{o.pet_name}</td>
              <td>{o.username}</td>
              <td>{o.quantity}</td>
              <td>{o.status}</td>
              <td>{formatDate(o.placed_at)}</td>
              <td>
                <button className="danger" onClick={() => cancel(o.id)}>
                  Отменить
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
