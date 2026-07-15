import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { Pet, Category, PetsResponse } from '../api/types';

export default function PetsPage() {
  const [pets, setPets] = useState<Pet[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit] = useState(5);
  const [editing, setEditing] = useState<Partial<Pet> | null>(null);

  const load = async () => {
    // BUG: search вставляется в URL без encodeURIComponent → спецсимволы (&, #, %) ломают запрос
    let url = `/pets?search=${search}&page=${page}&limit=${limit}`;
    // Фильтры по категории и статусу (рабочие)
    if (categoryId) url += `&category_id=${categoryId}`;
    if (status) url += `&status=${status}`;
    const res = await api.get<PetsResponse>(url);
    setPets(res.data || []);
    setTotal(res.pagination?.total || 0);
  };

  const loadCategories = async () => {
    const res = await api.get<Category[]>('/categories');
    setCategories(res || []);
  };

  useEffect(() => {
    load();
    // BUG: categories грузятся один раз, но зависимость на page/search
    // приводит к тому что load дергается, а список категорий нет
  }, [page, categoryId, status]);

  useEffect(() => {
    loadCategories();
  }, []);

  // Смена фильтра сбрасывает страницу на 1 (рабочее поведение)
  const changeCategory = (val: string) => {
    setCategoryId(val);
    setPage(1);
  };
  const changeStatus = (val: string) => {
    setStatus(val);
    setPage(1);
  };
  const resetFilters = () => {
    setSearch('');
    setCategoryId('');
    setStatus('');
    setPage(1);
  };

  const doSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // BUG: при поиске не сбрасываем page на 1 → можно оказаться на пустой странице
    load();
  };

  const remove = async (id: string) => {
    // BUG: удаление без подтверждения
    await api.del(`/pets/${id}`);
    load();
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
    if (editing.id) {
      // BUG: id BIGINT берётся из объекта как строка, но при формировании URL
      // JS может представить большое число некорректно если где-то был Number()
      await api.put(`/pets/${editing.id}`, body);
    } else {
      await api.post('/pets', body);
    }
    // BUG: не ждём и не перезагружаем актуально — иногда список не обновляется
    setEditing(null);
    load();
  };

  const totalPages = Math.ceil(total / limit);

  const formatPrice = (price: string) => {
    const n = Number(price);
    // BUG: цена 0 или отрицательная показывается как «Бесплатно»
    if (n <= 0) return 'Бесплатно';
    return `${n} ₽`;
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
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select value={status} onChange={(e) => changeStatus(e.target.value)}>
            <option value="">Все статусы</option>
            <option value="available">available</option>
            <option value="pending">pending</option>
            <option value="sold">sold</option>
          </select>
          <button className="secondary" onClick={resetFilters}>
            Сбросить
          </button>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Имя</th>
            <th>Категория</th>
            <th>Статус</th>
            <th>Цена</th>
            <th>Действия</th>
          </tr>
        </thead>
        <tbody>
          {pets.map((pet) => (
            <tr key={pet.id}>
              {/* BUG: длинный BIGINT id отображается, но при копировании в другие формы теряет точность */}
              <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{pet.id}</td>
              {/* BUG: имя рендерится через dangerouslySetInnerHTML → XSS */}
              <td dangerouslySetInnerHTML={{ __html: pet.name }} />
              <td>{pet.category_name}</td>
              <td>
                <span className={`badge ${pet.status}`}>{pet.status}</span>
              </td>
              <td>{formatPrice(pet.price)}</td>
              <td>
                <div className="row">
                  <button className="secondary" onClick={() => setEditing(pet)}>
                    ✏️
                  </button>
                  <button className="danger" onClick={() => remove(pet.id)}>
                    🗑
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="row" style={{ marginTop: 16, justifyContent: 'center' }}>
        <button
          className="secondary"
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
        >
          ← Назад
        </button>
        {/* BUG: показываем неверное общее число страниц — total не учитывает фильтр поиска */}
        <span>
          Страница {page} из {totalPages || 1}
        </span>
        <button
          className="secondary"
          disabled={page >= totalPages}
          onClick={() => setPage(page + 1)}
        >
          Вперёд →
        </button>
      </div>

      {editing && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3>{editing.id ? 'Редактировать' : 'Новый питомец'}</h3>
          <form onSubmit={save}>
            <div className="form-field">
              <label>Имя</label>
              <input
                value={editing.name || ''}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              />
            </div>
            <div className="form-field">
              <label>Категория</label>
              <select
                value={editing.category_id || ''}
                onChange={(e) =>
                  setEditing({ ...editing, category_id: Number(e.target.value) })
                }
              >
                <option value="">—</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label>Статус</label>
              <select
                value={editing.status || 'available'}
                onChange={(e) =>
                  setEditing({ ...editing, status: e.target.value as Pet['status'] })
                }
              >
                <option value="available">available</option>
                <option value="pending">pending</option>
                <option value="sold">sold</option>
              </select>
            </div>
            <div className="form-field">
              <label>Цена</label>
              {/* BUG: нет ограничения min=0, можно ввести отрицательную цену */}
              <input
                type="number"
                value={editing.price || ''}
                onChange={(e) => setEditing({ ...editing, price: e.target.value })}
              />
            </div>
            <div className="form-field">
              <label>Описание</label>
              <textarea
                value={editing.description || ''}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })}
              />
            </div>
            <div className="row">
              <button type="submit">Сохранить</button>
              {/* BUG: кнопка «Отмена» имеет type submit по умолчанию внутри form →
                  вместо отмены сабмитит форму */}
              <button className="secondary" onClick={() => setEditing(null)}>
                Отмена
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
