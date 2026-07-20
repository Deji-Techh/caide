import type { UserBudgetInfo } from "@/ipc/types";
import type { UserSettings } from "@/lib/schemas";

export interface PromoMessageConfig {
  id: string;
  text: string;
  cta: string;
  target: { type: "url"; url: string } | { type: "trial-dialog" };
  weight: number;
}

export const PROMO_MESSAGES: PromoMessageConfig[] = [
  {
    id: "caide-tools",
    text: "Web research, Smart Context, voice input, and visual editing are ready.",
    cta: "Available",
    target: { type: "url", url: "https://github.com/dyad-sh/dyad" },
    weight: 1,
  },
];

export function pickPromoMessage(seed?: number): PromoMessageConfig {
  void seed;
  return PROMO_MESSAGES[0];
}

export function shouldShowPromoMessage({
  promoSeed,
  settings,
  userBudget,
  messagesLength,
}: {
  promoSeed: number | null;
  settings: UserSettings | null | undefined;
  userBudget: UserBudgetInfo | undefined;
  messagesLength: number;
}) {
  void promoSeed;
  void settings;
  void userBudget;
  void messagesLength;
  return false;
}

export interface PromoMessageState {
  visible: boolean;
  seed: number;
}

export function usePromoMessage(): PromoMessageState {
  return { visible: false, seed: 0 };
}

export function PromoMessage({ seed }: { seed?: number }) {
  void seed;
  return null;
}
