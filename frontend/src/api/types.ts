export interface Pet {
  id: string; // BIGINT приходит строкой с бэка
  name: string;
  category_id: number | null;
  category_name: string | null;
  status: 'available' | 'pending' | 'sold' | null;
  price: string; // NUMERIC приходит строкой
  description: string;
  seller_id: number | null;
  seller_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: number;
  name: string;
}

export interface Order {
  id: number;
  pet_id: string;
  seller_id: number;
  buyer_name: string;
  buyer_phone: string;
  quantity: number;
  status: string;
  placed_at: string;
  pet_name: string;
  pet_price: string;
  seller_name: string;
}

export interface LogEntry {
  id?: number;
  level: string;
  message: string;
  endpoint?: string;
  method?: string;
  created_at?: string;
  timestamp?: string;
  sql_query?: string;
  db_response?: string;
  stack?: string;
  details?: unknown;
}

export interface PetsResponse {
  data: Pet[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface DashboardStats {
  pets: number;
  orders: number;
  salesTotal: number;
}
