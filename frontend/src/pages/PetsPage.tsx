import { useEffect, useState } from 'react';
import { api, isAdmin } from '../api/client';
import type { Pet, Category, PetsResponse } from '../api/types';
import { petStatusRu } from '../api/labels';
import { PageSizeSelect, apiLimit } from '../components/PageSize';
import { SellerFilter } from '../components/SellerFilter';
import { Modal } from '../components/Modal';
import { useSnackbar } from '../components/Snackbar';

// По ТЗ в каталоге питомцев дефолт 5 (противоречит общему правилу 20).
const PETS_DEFAULT_SIZE = 5;

export default function PetsPage() {
  const admin = isAdmin();
  const [pets, setPets] = useState<Pet[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [status, setStatus] = useState('');
  const [sellerId, setSellerId] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PETS_DEFAULT_SIZE);
  const [total, setTotal] = useState(0);
  const [editing, setEditing] = useState<Partial<Pet> | null>(null);
  const { notify } = useSnackbar();

  const load = async () => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (categoryId) params.set('category_id', categoryId);
    if (status) params.set('status', status);
    if (admin && sellerId) params.set('seller_id', sellerId);
    params.set('page', String(page));
    // BUG #8: на бэк уходит выбранный размер + 10 (apiLimit).
    params.set('limit', String(apiLimit(pageSize)));
    try {
      const res = await api.get<PetsResponse>(`/pets?${params.toString()}`);
      setPets(res.data || []);
      setTotal(res.pagination?.total || 0);
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Ошибка загрузки');
    }
  };

  const loadCategories = async () => {
    try {
      const res = await api.get<Category[]>('/categories');
      setCategories(res || []);
    } catch { /* тихо */ }
  };

  useEffect(() => {
    load();
  }, [page, pageSize, categoryId, status, sellerId]);

  useEffect(() => {
    loadCategories();
  }, []);

  const changeCategory = (val: string) => { setCategoryId(val); setPage(1); };
  const changeStatus = (val: string) => { setStatus(val); setPage(1); };
  const resetFilters = () => { setSearch(''); setCategoryId(''); setStatus(''); setSellerId(''); setPage(1); };

  const doSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm('Удалить питомца?')) return;
    try {
      await api.del(`/pets/${id}`);
      load();
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Ошибка удаления');
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    const body = {
      name: editing.name,
      category_id: editing.category_id,
      status: editing.status,
      price: editing.price,
      description: editing.description,
    };
    try {
      if (editing.id) {
        await api.put(`/pets/${editing.id}`, body);
      } else {
        await api.post('/pets', body);
      }
      setEditing(null);
      load();
    } catch (e) {
      // BUG #10: конкретную ошибку "Не удалось подключиться к базе данных"
      // при создании молча проглатываем — форма закрывается как при успехе.
      // Все прочие ошибки показываем (требование).
      const msg = e instanceof Error ? e.message : 'Ошибка';
      if (msg.includes('Не удалось подключиться к базе данных')) {
        setEditing(null);
        load();
        return;
      }
      notify(msg);
      // Список обновляем в любом случае (напр. при double-submit питомец мог создаться)
      load();
    }
  };

  const totalPages = Math.ceil(total / pageSize);
  const changePageSize = (v: number) => { setPageSize(v); setPage(1); };

  const formatPrice = (price: string) => {
    const n = Number(price);
    return `${n.toLocaleString('ru-RU')} ₽`;
  };

  return (
    <div>
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0 }}>Питомцы</h2>
          <button onClick={() => setEditing({ status: 'available' })}>+ Добавить</button>
        </div>
        <form onSubmit={doSearch} className="row" style={{ marginTop: 12 }}>
          <input
            placeholder="Поиск по имени или описанию..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1 }}
          />
          <button type="submit">Найти</button>
        </form>
        <div className="row" style={{ marginTop: 12 }}>
          <select value={categoryId} onChange={(e) => changeCategory(e.target.value)}>
            <option value="">Все категории</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select value={status} onChange={(e) => changeStatus(e.target.value)}>
            <option value="">Все статусы</option>
            <option value="available">В продаже</option>
            <option value="pending">Бронь</option>
            <option value="sold">Продан</option>
          </select>
          {admin && (
            <SellerFilter value={sellerId} onChange={(v) => { setSellerId(v); setPage(1); }} />
          )}
          <button className="secondary" onClick={resetFilters}>Сбросить</button>
        </div>
      </div>


      {editing && (
        <Modal
          title={editing.id ? 'Редактировать питомца' : 'Новый питомец'}
          onClose={() => setEditing(null)}
        >
          <form onSubmit={save}>
            <div className="form-field">
              <label>Имя</label>
              <input
                maxLength={50}
                value={editing.name || ''}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              />
            </div>
            <div className="form-field">
              <label>Категория</label>
              <select
                value={editing.category_id ?? ''}
                onChange={(e) =>
                  setEditing({ ...editing, category_id: e.target.value ? Number(e.target.value) : null })
                }
              >
                <option value="">—</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label>Статус</label>
              <select
                value={editing.status || 'available'}
                onChange={(e) => setEditing({ ...editing, status: e.target.value as Pet['status'] })}
              >
                <option value="available">В продаже</option>
                <option value="pending">Бронь</option>
                <option value="sold">Продан</option>
              </select>
            </div>
            <div className="form-field">
              <label>Цена</label>
              <input
                type="number"
                value={editing.price || ''}
                onChange={(e) => setEditing({ ...editing, price: e.target.value })}
              />
            </div>
            <div className="form-field">
              <label>Описание</label>
              <textarea
                maxLength={1000}
                value={editing.description || ''}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })}
              />
            </div>
            <div className="row">
              <button type="submit">Сохранить</button>
              <button type="button" className="secondary" onClick={() => setEditing(null)}>
                Отмена
              </button>
            </div>
          </form>
        </Modal>
      )}

      <table className="clip-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Имя</th>
            {admin && <th>Продавец</th>}
            <th>Категория</th>
            <th>Статус</th>
            <th>Цена</th>
            <th>Действия</th>
          </tr>
        </thead>
        <tbody>
          {pets.map((pet) => (
            <tr key={pet.id}>
              <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{pet.id}</td>
              <td>{pet.name}</td>
              {admin && <td>{pet.seller_name || '—'}</td>}
              <td>{pet.category_name || '—'}</td>
              <td>
                {pet.status ? (
                  <span className={`badge ${pet.status}`}>{petStatusRu(pet.status)}</span>
                ) : (
                  <span className="badge">—</span>
                )}
              </td>
              <td>{formatPrice(pet.price)}</td>
              <td>
                <div className="row">
                  <button className="secondary" onClick={() => setEditing(pet)}>✏️</button>
                  <button className="danger" onClick={() => remove(pet.id)}>🗑</button>
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
        <PageSizeSelect value={pageSize} onChange={changePageSize} />
      </div>
    </div>
  );
}
