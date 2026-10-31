import { User } from '../types';

let inMemorySessionToken: string | null = null;

export const setApiSessionToken = (token: string | null) => {
  inMemorySessionToken = token;
  if (typeof window !== 'undefined') {
    try {
      if (token) {
        sessionStorage.setItem('spillout_token', token);
      } else {
        sessionStorage.removeItem('spillout_token');
      }
    } catch {
      // sessionStorage may be restricted
    }
  }
};

export const getApiSessionToken = (): string | null => {
  if (inMemorySessionToken) return inMemorySessionToken;
  if (typeof window !== 'undefined') {
    try {
      const saved = sessionStorage.getItem('spillout_token');
      if (saved) {
        inMemorySessionToken = saved;
        return saved;
      }
    } catch {
      // Ignore sessionStorage errors
    }
  }
  return null;
};

const getApiBase = () => {
  if (typeof window !== 'undefined') {
    // If NEXT_PUBLIC_API_URL is explicitly set to an external backend, use it;
    // otherwise route through same-origin /api proxy
    const customApi = process.env.NEXT_PUBLIC_API_URL;
    if (customApi) {
      const trimmed = customApi.replace(/\/$/, '');
      return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
    }
    return '/api';
  }
  // Server runtime function context: resolve from bound service environment variable
  const backend = process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL;
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
    const activeToken = inMemorySessionToken || getApiSessionToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}),
      ...(options.headers as Record<string, string> || {}),
    };

    const res = await fetch(url, {
      ...options,
      headers,
      credentials: 'include', // Include session cookie for same-origin or CORS
    });

    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      let errorMessage = body.error;
      if (!errorMessage) {
        if (res.status === 500) {
          errorMessage = 'Server error (500): The backend service is unreachable or database is disconnected. Please check BACKEND_API_URL and DATABASE_URL.';
        } else if (res.status === 502 || res.status === 503 || res.status === 504) {
          errorMessage = `Backend service unavailable (${res.status}). Please verify that the backend server is running and reachable.`;
        } else if (res.status === 404) {
          errorMessage = 'API endpoint not found (404). Check API URL routing configuration.';
        } else {
          errorMessage = `Request failed with status ${res.status}`;
        }
      }

      return {
        error: errorMessage,
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
    avatarId?: string | null;
    publicKey?: string;
  }) => {
    const res = await request<{ message: string; user: User; token: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (res.data?.token) {
      setApiSessionToken(res.data.token);
    }
    return res;
  },

  login: async (payload: { username: string; password: string[] }) => {
    const res = await request<{ message: string; user: User; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (res.data?.token) {
      setApiSessionToken(res.data.token);
    }
    return res;
  },

  getMe: async () => {
    const res = await request<{ user: User; token?: string }>('/auth/me');
    if (res.data?.token) {
      setApiSessionToken(res.data.token);
    }
    return res;
  },

  logout: async () => {
    const res = await request<{ success: boolean }>('/auth/logout', {
      method: 'POST',
    });
    setApiSessionToken(null);
    return res;
  },

  getUserPublicKey: async (username: string) => {
    return request<{ user: { username: string; canonicalUsername: string; gender?: string; avatarId?: string | null; publicKey: string | null; isOnline: boolean } }>(
      `/auth/user/${encodeURIComponent(username)}/public-key`
    );
  },

  updatePublicKey: async (publicKey: string) => {
    return request<{ success: boolean }>('/auth/public-key', {
      method: 'POST',
      body: JSON.stringify({ publicKey }),
    });
  },

  updateAvatar: async (avatarId: string | null) => {
    return request<{ success: boolean; user: User }>('/account/avatar', {
      method: 'POST',
      body: JSON.stringify({ avatarId }),
    });
  },

  getConversationMessages: async (username: string) => {
    return request<{
      conversationId: string;
      messages: Array<{
        id: string;
        senderCanonical: string;
        recipientCanonical: string;
        ciphertext: string;
        iv: string;
        tag?: string;
        senderEphemeralPublicKey: string;
        createdAt: string;
        expiresAt: string;
        status: 'sending' | 'sent' | 'delivered' | 'failed';
        deliveredAt?: string | null;
      }>;
    }>(`/messages/${encodeURIComponent(username)}`);
  },

  acknowledgeMessage: async (messageId: string) => {
    return request<{ success: boolean }>(`/messages/${encodeURIComponent(messageId)}/ack`, {
      method: 'POST',
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
