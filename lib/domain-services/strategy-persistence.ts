import {
  STRATEGY_KEY,
  parseStrategy,
  validateStrategy,
  type StrategyStore,
} from "../strategy/model";
import { assertStrategyTransition } from "../strategy/adapt/mutations";
import { writeTogether } from "../system/storage-transaction";
export function persistStrategy(
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">,
  next: StrategyStore,
  expected: string | null,
) {
  if (expected !== null)
    assertStrategyTransition(parseStrategy(expected), next);
  const raw = JSON.stringify(validateStrategy(next));
  writeTogether(storage, [{ key: STRATEGY_KEY, expected, value: raw }]);
  return raw;
}
