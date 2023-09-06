import { BigInt } from "@graphprotocol/graph-ts";
import { StakeAmountChange } from '../../generated/schema';

export function addStakeAmountChange(
  receiptId: string,
  accountId: string,
  timestamp: BigInt,
  amount: BigInt
): void {
  const change = new StakeAmountChange(receiptId);
  change.accountId = accountId;
  change.timestamp = timestamp;
  change.amount = amount;
  change.save();
}
