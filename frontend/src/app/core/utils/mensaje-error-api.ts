export const mensajeErrorApi = (error: unknown, fallback: string): string => {
  if (typeof error !== 'object' || error === null || !('error' in error)) {
    return fallback;
  }

  const payload = (error as { error?: unknown }).error;
  if (typeof payload !== 'object' || payload === null) {
    return fallback;
  }

  const data = payload as Record<string, unknown>;
  if (typeof data['estado'] === 'string') return data['estado'];
  if (typeof data['mensaje'] === 'string') return data['mensaje'];
  if (typeof data['message'] === 'string') return data['message'];
  return fallback;
};