export interface Pet {
  id: string; // BIGINT приходит строкой с бэка
  name: string;
  category_id: number;
  category_name: string;
  status: 'available' | 'pending' | 'sold';
  price: string; // NUMERIC приходит строкой
  description: string;
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
  user_id: number;
  quantity: number;
  status: string;
  placed_at: string;
  pet_name: string;
  username: string;
}

export interface LogEntry {
  id?: number;
  level: string;
  message: string;
  endpoint?: string;
  method?: string;
  created_at?: string;
  timestamp?: string;
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
