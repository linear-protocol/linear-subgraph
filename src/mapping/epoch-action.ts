import { near, JSONValue, TypedMap, BigDecimal } from '@graphprotocol/graph-ts';
import { updatePrice } from '../helper/price';

export function handleEpochUpdateRewards(
  method: string,
  event: string,
  data: TypedMap<string, JSONValue>,
  receipt: near.ReceiptWithOutcome
): void {
  const rewards = BigDecimal.fromString(data.get('rewards')!.toString());

  // update price
  updatePrice(event, method, receipt, rewards, BigDecimal.zero());
}
