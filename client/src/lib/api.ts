import { User } from '../types';

const getApiBase = () => {
  if (typeof window !== 'undefined') {
    return '/api';
  }
  // Server runtime function context: resolve from bound service environment variable
  const backend = process.env.BACKEND_API_URL;
  if (backend) {
    const trimmed = backend.replace(/\/$/, '');
    return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
  }
  return 'http://localhost:4000/api';
};

interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  code?: string;
  status: number;
}

async function request<T = any>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  try {
    const baseUrl = getApiBase();
    const url = endpoint.startsWith('http') ? endpoint : `${baseUrl}${endpoint}`;
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      credentials: 'include', // Include session cookie
    });

    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      return {
        error: body.error || `Request failed with status ${res.status}`,
        code: body.code,
        status: res.status,
      };
    }

    return {
      data: body,
      status: res.status,
    };
  } catch (err: any) {
    return {
      error: err.message || 'Network connection failed. Backend might be unreachable.',
      status: 0,
    };
  }
}

export const api = {
  checkUsername: async (username: string) => {
    return request<{ valid: boolean; available: boolean; error?: string }>(
      `/auth/check-username?username=${encodeURIComponent(username)}`
    );
  },

  register: async (payload: {
    username: string;
    password: string[];
    confirmPassword: string[];
    gender: string;
    publicKey?: string;
  }) => {
    return request<{ message: string; user: User; token: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  login: async (payload: { username: string; password: string[] }) => {
    return request<{ message: string; user: User; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  getMe: async () => {
    return request<{ user: User }>('/auth/me');
  },

  logout: async () => {
    return request<{ success: boolean }>('/auth/logout', {
      method: 'POST',
    });
  },

  getUserPublicKey: async (username: string) => {
    return request<{ user: { username: string; canonicalUsername: string; publicKey: string | null; isOnline: boolean } }>(
      `/auth/user/${encodeURIComponent(username)}/public-key`
    );
  },

  updatePublicKey: async (publicKey: string) => {
    return request<{ success: boolean }>('/auth/public-key', {
      method: 'POST',
      body: JSON.stringify({ publicKey }),
    });
  },

  getAccountStatus: async () => {
    return request<{
      account: {
        username: string;
        canonicalUsername: string;
        gender: string;
        createdAt: string;
        lastActivityAt: string;
        expiresAt: string;
        hoursUntilInactivityDeletion: number;
        policy: string;
      };
    }>('/account/status');
  },

  deleteAccount: async () => {
    return request<{ success: boolean; message: string }>('/account/me', {
      method: 'DELETE',
    });
  },
};
