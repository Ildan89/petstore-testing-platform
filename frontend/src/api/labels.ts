// Русские подписи для статусов (значения в БД остаются английскими).

export const PET_STATUS_RU: Record<string, string> = {
  available: 'В продаже',
  pending: 'Бронь',
  sold: 'Продан',
};

export const ORDER_STATUS_RU: Record<string, string> = {
  placed: 'Оформлен',
  approved: 'Подтверждён',
  delivered: 'Доставлен',
  cancelled: 'Отменён',
};

export const petStatusRu = (s: string | null | undefined): string =>
  s ? PET_STATUS_RU[s] ?? s : '—';

export const orderStatusRu = (s: string | null | undefined): string =>
  s ? ORDER_STATUS_RU[s] ?? s : '—';
