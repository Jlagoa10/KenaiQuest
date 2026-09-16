import type { AuthResponseDto, LoginInput, RegisterInput, UserDto } from '@kenai/shared';
import { api, apiRequest, setAccessToken } from './apiClient.js';

export async function register(input: RegisterInput): Promise<AuthResponseDto> {
  const response = await api.post<AuthResponseDto>('/auth/register', input);
  setAccessToken(response.accessToken);
  return response;
}

export async function login(input: LoginInput): Promise<AuthResponseDto> {
  const response = await api.post<AuthResponseDto>('/auth/login', input);
  setAccessToken(response.accessToken);
  return response;
}

export async function logout(): Promise<void> {
  try {
    await api.post<void>('/auth/logout');
  } finally {
    setAccessToken(null);
  }
}

/**
 * Restores a session on page load using the httpOnly refresh cookie.
 * Returns null when there is no valid session, which is the normal path for a
 * first-time visitor and must not surface as an error.
 */
export async function restoreSession(): Promise<AuthResponseDto | null> {
  try {
    const response = await apiRequest<AuthResponseDto>('/auth/refresh', {
      method: 'POST',
      skipRefresh: true,
    });
    setAccessToken(response.accessToken);
    return response;
  } catch {
    setAccessToken(null);
    return null;
  }
}

export async function fetchMe(): Promise<UserDto> {
  const response = await api.get<{ user: UserDto }>('/auth/me');
  return response.user;
}

export async function updateProfile(input: {
  name?: string;
  timezone?: string;
  themePreference?: 'light' | 'dark' | 'system';
}): Promise<UserDto> {
  const response = await api.patch<{ user: UserDto }>('/users/me', input);
  return response.user;
}

export async function changePassword(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<void> {
  await api.post<void>('/users/me/password', input);
}
