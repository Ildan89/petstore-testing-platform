// Скрипт сидирования: 50 продавцов, ~500 животных, заказы на проданных.
// Запуск: node seed.mjs
import 'dotenv/config';
import pg from 'pg';
import bcrypt from 'bcryptjs';

const pool = new pg.Pool({
  host: process.env.PGHOST || 'pg4.sweb.ru',
  port: parseInt(process.env.PGPORT || '5433', 10),
  user: process.env.PGUSER || 'ramaldano2',
  password: process.env.PGPASSWORD || '',
  database: process.env.PGDATABASE || 'ramaldano2',
  max: 5,
});

// Детерминированный ГПСЧ (без Math.random для воспроизводимости)
let _s = 12345;
const rnd = () => {
  _s = (_s * 1103515245 + 12345) & 0x7fffffff;
  return _s / 0x7fffffff;
};
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const randint = (a, b) => a + Math.floor(rnd() * (b - a + 1));

const FUNNY = [
  'Весёлый Вова', 'Продавец года', 'Я Лучший', 'Котопродавец', 'Хвостатый Босс',
  'Мега Маркет', 'Лапа Удачи', 'Зоо Гуру', 'Питомцы 24/7', 'Добрый Дядя',
  'Усатый Барон', 'Пушистый Магнат', 'Король Клеток', 'Царь Зверей', 'Мистер Мяу',
  'Гав Инкорпорейтед', 'Чемпион Продаж', 'Зверский Дилер', 'Лучший из Лучших', 'Топ Продавец',
  'Хомяк Голд', 'Птичий Рынок', 'Аквариум Про', 'Рептилия Люкс', 'Дракон Продаёт',
  'Быстрые Лапки', 'Золотая Рыбка', 'Когтистая Рука', 'Волшебник Зоо', 'Босс Вольера',
  'Крутой Заводчик', 'Няшный Магаз', 'Зообарыга', 'Питон Селлер', 'Морская Свинка Инк',
  'Ушастый Магнат', 'Клык и Ко', 'Мурчащий Миллионер', 'Пёсель Плюс', 'Кото Кэш',
  'Джунгли Маркет', 'Зоо Империя', 'Лапки Вверх', 'Хвост Трубой', 'Мокрый Нос',
  'Сытый Кот', 'Верный Друг', 'Дикий Запад Зоо', 'Питомец Мечты', 'Зверополис',
];

const PET_NAMES = [
  'Барсик', 'Шарик', 'Мурка', 'Рекс', 'Кеша', 'Гоша', 'Жужа', 'Бублик', 'Тузик', 'Пушок',
  'Марсик', 'Феликс', 'Симба', 'Найда', 'Граф', 'Ляля', 'Персик', 'Рыжик', 'Дымка', 'Умка',
  'Тимон', 'Ричи', 'Босс', 'Локи', 'Тор', 'Ася', 'Буся', 'Гриша', 'Чип', 'Дейл',
];
const DESCS = [
  'Молодой и активный', 'Спокойный характер', 'Любит ласку', 'Приучен к лотку',
  'Отдаётся в добрые руки', 'Redkий окрас', 'Чемпион породы', 'Очень дружелюбный',
];

async function main() {
  const client = pool;
  console.log('Старт сидирования...');

  // Категории (id 1..8)
  const cats = (await client.query('SELECT id FROM categories ORDER BY id')).rows.map((r) => r.id);
  console.log('Категорий:', cats.length);

  // 1) 50 продавцов
  const hash = await bcrypt.hash('test123', 10);
  const sellerIds = [];
  for (let i = 0; i < FUNNY.length; i++) {
    const username = `${FUNNY[i]} #${i + 1}`;
    // upsert по username
    const existing = await client.query('SELECT id FROM users WHERE username = $1', [username]);
    if (existing.rows.length) {
      sellerIds.push(existing.rows[0].id);
    } else {
      const r = await client.query(
        'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id',
        [username, hash]
      );
      sellerIds.push(r.rows[0].id);
    }
  }
  console.log('Продавцов:', sellerIds.length);

  // 2) ~500 животных, случайно распределены
  const statuses = ['available', 'available', 'pending', 'sold']; // sold пореже
  const petIds = [];
  for (let i = 0; i < 500; i++) {
    const name = `${pick(PET_NAMES)}-${i + 1}`;
    const catId = pick(cats);
    const sellerId = pick(sellerIds);
    const status = pick(statuses);
    const price = randint(500, 50000);
    const desc = pick(DESCS);
    const r = await client.query(
      `INSERT INTO pets (name, category_id, status, price, description, seller_id)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [name, catId, status, price, desc, sellerId]
    );
    petIds.push({ id: r.rows[0].id, sellerId, catId, price, status });
  }
  console.log('Животных создано:', petIds.length);

  // 3) Заказы: все sold-животные получают заказ в ТЕКУЩЕМ месяце
  const buyers = ['Иван Иванов', 'Пётр Петров', 'Анна Смирнова', 'Ольга К.', 'Дмитрий В.'];
  let orders = 0;
  for (const p of petIds) {
    if (p.status !== 'sold') continue;
    // дата в текущем месяце
    const now = new Date();
    const day = randint(1, Math.min(now.getDate(), 28));
    const placed = new Date(now.getFullYear(), now.getMonth(), day, randint(8, 20), randint(0, 59));
    await client.query(
      `INSERT INTO orders (pet_id, seller_id, buyer_name, buyer_phone, quantity, status, placed_at)
       VALUES ($1,$2,$3,$4,$5,'delivered',$6)`,
      [p.id, p.sellerId, pick(buyers), `+79${randint(100000000, 999999999)}`, 1, placed.toISOString()]
    );
    orders++;
  }
  console.log('Заказов (текущий месяц, delivered):', orders);

  await pool.end();
  console.log('Готово.');
}

main().catch((e) => { console.error(e); process.exit(1); });
