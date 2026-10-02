import type { EventKey } from './events';

/**
 * NOT-02: the settings key that switches an event on/off. Stored keys keep
 * their historical names (never renamed); `payment_due_reminder` is stored as
 * `notify_event_due_reminder`.
 */
export function notifyEventSettingKey(event: EventKey): string {
  return event === 'payment_due_reminder' ? 'notify_event_due_reminder' : `notify_event_${event}`;
}
