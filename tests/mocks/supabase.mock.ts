// ============================================================================
// Supabase Mock - Simplified version for testing
// ============================================================================

import { vi } from 'vitest';

// ============================================================================
// Types
// ============================================================================

export type MockTableData = Record<string, Record<string, unknown>>;

export interface MockResponse<T> {
  data: T | null;
  error: Error | null;
}

export interface MockListResponse<T> {
  data: T[];
  error: Error | null;
  count?: number;
}

// ============================================================================
// Mock Implementation
// ============================================================================

export class MockSupabase {
  // In-memory storage for each table
  tables: Map<string, MockTableData> = new Map();
  
  // Storage (file storage)
  storageFiles: Map<string, Blob> = new Map();
  
  // Auth state
  auth = {
    user: null as Record<string, unknown> | null,
    getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    signInWithPassword: vi.fn().mockResolvedValue({ data: { user: {}, session: {} }, error: null }),
    signUp: vi.fn().mockResolvedValue({ data: { user: {}, session: {} }, error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
  };

  // ==========================================================================
  // Table Operations - Simplified
  // ==========================================================================

  from<T = Record<string, unknown>>(_tableName: string) {
    const tableName = _tableName;
    
    // Initialize table if needed
    if (!this.tables.has(tableName)) {
      this.tables.set(tableName, {});
    }
    
    const table = this.tables.get(tableName)!;
    
    return {
      // Select - returns Promise that resolves to data array
      select: () => {
        return {
          // Filters
          eq: (column: string, value: unknown) => {
            const filtered = Object.values(table).filter((row) => row[column] === value);
            return {
              order: () => ({ limit: () => Promise.resolve({ data: filtered as T[], error: null }) }),
              limit: (count: number) => Promise.resolve({ data: filtered.slice(0, count) as T[], error: null }),
              single: () => Promise.resolve({ data: filtered[0] as T | null, error: filtered[0] ? null : new Error('Not found') }),
              then: (onfulfilled?: (value: T[]) => T[] | PromiseLike<T[]>) => {
                if (onfulfilled) return Promise.resolve(onfulfilled(filtered as T[]));
                return Promise.resolve(filtered as T[]);
              },
            };
          },
          
          // Insert - simplified
          insert: (data: T | T[]) => {
            const items = Array.isArray(data) ? data : [data];
            const inserted: T[] = [];
            for (const item of items) {
              const id = (item as Record<string, unknown>).id as string || `mock_${Date.now()}_${Math.random()}`;
              const record = { ...item, id, created_at: new Date().toISOString() } as T;
              table[id] = record as Record<string, unknown>;
              inserted.push(record);
            }
            return Promise.resolve({ data: inserted, error: null });
          },
          
          // Update - simplified
          update: (_data: Partial<T>) => {
            return {
              eq: () => Promise.resolve({ data: null, error: null }),
            };
          },
          
          // Delete - simplified
          delete: () => {
            return {
              eq: () => Promise.resolve({ error: null }),
            };
          },
          
          // Get all
          then: (onfulfilled?: (value: T[]) => T[] | PromiseLike<T[]>) => {
            const all = Object.values(table) as T[];
            if (onfulfilled) return Promise.resolve(onfulfilled(all));
            return Promise.resolve(all);
          },
        };
      },
    };
  }

  // ==========================================================================
  // Realtime - Simplified
  // ==========================================================================

  channel(_name: string) {
    return {
      on: () => ({ subscribe: () => {}, unsubscribe: () => {} }),
      subscribe: () => {},
      unsubscribe: () => {},
    };
  }

  removeChannel() {}

  // ==========================================================================
  // Storage - Simplified
  // ==========================================================================

  storage = {
    from: (_bucket: string) => ({
      upload: vi.fn().mockResolvedValue({ data: { path: 'test/path' }, error: null }),
      download: vi.fn().mockResolvedValue({ data: new Blob(), error: null }),
      getPublicUrl: (_path: string) => ({ data: { publicUrl: 'https://test.url' } }),
      remove: vi.fn().mockResolvedValue({ error: null }),
    }),
  };

  // ==========================================================================
  // Test Utilities
  // ==========================================================================

  insertTestData(tableName: string, data: Record<string, unknown>[]): void {
    if (!this.tables.has(tableName)) {
      this.tables.set(tableName, {});
    }
    
    const table = this.tables.get(tableName)!;
    for (const record of data) {
      const id = record.id as string || `mock_${Date.now()}_${Math.random()}`;
      table[id] = { ...record, id, created_at: new Date().toISOString() };
    }
  }

  getTableData<T>(tableName: string): T[] {
    const table = this.tables.get(tableName);
    if (!table) return [];
    return Object.values(table) as T[];
  }

  clearAll(): void {
    this.tables.clear();
    this.storageFiles.clear();
  }

  clearTable(tableName: string): void {
    this.tables.delete(tableName);
  }
}

// ============================================================================
// Singleton
// ============================================================================

let supabaseInstance: MockSupabase | null = null;

export function getSupabaseMock(): MockSupabase {
  if (!supabaseInstance) {
    supabaseInstance = new MockSupabase();
  }
  return supabaseInstance;
}

export function resetSupabaseMock(): void {
  supabaseInstance = null;
}

export function mockSupabase() {
  const mock = getSupabaseMock();
  return { supabase: mock };
}

// ============================================================================
// Common Test Data
// ============================================================================

export const MOCK_ORG_DATA = {
  id: 'org_1234567890',
  name: 'Test Organization',
  slug: 'test-org',
  plan: 'PRO',
  stripeCustomerId: 'cus_test123',
  createdAt: new Date().toISOString(),
};

export const MOCK_USER_DATA = {
  id: 'user_1234567890',
  email: 'test@example.com',
  createdAt: new Date().toISOString(),
};

export const MOCK_CONTENT_DATA = [
  {
    id: 'content_1',
    organizationId: 'org_1234567890',
    platform: 'INSTAGRAM',
    contentType: 'POST',
    status: 'DRAFT',
    caption: 'Test post 1',
    hashtags: ['#test'],
    confidenceScore: 0.85,
  },
  {
    id: 'content_2',
    organizationId: 'org_1234567890',
    platform: 'INSTAGRAM',
    contentType: 'REEL',
    status: 'PUBLISHED',
    caption: 'Test post 2',
    hashtags: ['#viral'],
    confidenceScore: 0.92,
    publishedAt: new Date().toISOString(),
  },
];
