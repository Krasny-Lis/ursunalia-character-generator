import { Injectable, computed, isDevMode, signal } from '@angular/core';

/**
 * Design-review fixtures only. These signals never authenticate, authorize,
 * mutate an API session or persist payment / character data.
 */
export type PreviewRole = 'guest' | 'player' | 'gm' | 'organizer';
export type PreviewCharacter = 'none' | 'draft' | 'submitted' | 'changes' | 'rejected' | 'accepted';
export type PreviewPayment = 'unavailable' | 'unpaid' | 'paid';
export type PreviewCard = 'preparing' | 'review' | 'ready';

@Injectable({ providedIn: 'root' })
export class UiPreviewStore {
  /** Production builds do not expose the role switcher. */
  readonly enabled = isDevMode();
  readonly role = signal<PreviewRole>('guest');
  readonly character = signal<PreviewCharacter>('draft');
  readonly locked = signal(false);
  readonly payment = signal<PreviewPayment>('unavailable');
  readonly card = signal<PreviewCard>('preparing');
  readonly hasCardLink = signal(false);
  readonly collapsed = signal(false);

  readonly canViewCard = computed(() =>
    this.role() !== 'guest' &&
    this.character() === 'accepted' &&
    this.payment() === 'paid' &&
    (this.card() === 'review' || this.card() === 'ready') &&
    this.hasCardLink(),
  );

  setRole(role: string) {
    if (['guest', 'player', 'gm', 'organizer'].includes(role)) this.role.set(role as PreviewRole);
  }
  setCharacter(character: string) {
    if (['none', 'draft', 'submitted', 'changes', 'rejected', 'accepted'].includes(character))
      this.character.set(character as PreviewCharacter);
  }
  setPayment(payment: string) {
    if (['unavailable', 'unpaid', 'paid'].includes(payment)) this.payment.set(payment as PreviewPayment);
  }
  setCard(card: string) {
    if (['preparing', 'review', 'ready'].includes(card)) this.card.set(card as PreviewCard);
  }
}
