export interface PushPayloadV1 {
  readonly v: 1;
  readonly title: string;
  readonly body: string;
  readonly tag?: string | undefined;
  readonly url?: string | undefined;
  readonly habitId?: string | undefined;
  readonly notificationId?: string | undefined;
}

export function parsePushPayload(raw: unknown): PushPayloadV1 | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (r['v'] !== 1) return null;
  if (typeof r['title'] !== 'string' || typeof r['body'] !== 'string') return null;

  const result: PushPayloadV1 = { v: 1, title: r['title'], body: r['body'] };

  const tag = r['tag'];
  if (typeof tag === 'string') (result as Record<string, unknown>)['tag'] = tag;
  const url = r['url'];
  if (typeof url === 'string') (result as Record<string, unknown>)['url'] = url;
  const habitId = r['habitId'];
  if (typeof habitId === 'string') (result as Record<string, unknown>)['habitId'] = habitId;
  const notificationId = r['notificationId'];
  if (typeof notificationId === 'string') (result as Record<string, unknown>)['notificationId'] = notificationId;

  return result;
}
