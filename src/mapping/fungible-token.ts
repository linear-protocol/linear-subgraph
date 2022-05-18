import {
  near,
  BigInt,
  log,
  JSONValue,
  TypedMap,
  BigDecimal,
} from '@graphprotocol/graph-ts';
import { FtTransfer } from '../../generated/schema';
import { getOrInitUser, getOrInitStatus } from '../helper/initializer';
import { updatePrice } from '../helper/price';

export function handleFtTransfer(
  data: TypedMap<string, JSONValue>,
  receipt: near.ReceiptWithOutcome
): void {
  const timestamp = receipt.block.header.timestampNanosec;
  const receiptHash = receipt.receipt.id.toBase58();

  const oldOwnerId = data.get('old_owner_id')!.toString();
  const newOwnerId = data.get('new_owner_id')!.toString();
  const amount = BigInt.fromString(data.get('amount')!.toString());
  const amountFloat = BigDecimal.fromString(data.get('amount')!.toString());
  // update event
  let transferedEvent = FtTransfer.load(receiptHash);
  if (!transferedEvent) {
    const status = getOrInitStatus();
    const latestPrice = status.price;

    transferedEvent = new FtTransfer(receiptHash);
    transferedEvent.to = newOwnerId;
    transferedEvent.from = oldOwnerId;
    transferedEvent.amount = amount;
    transferedEvent.timestamp = timestamp.toString();
    transferedEvent.price = latestPrice;
    transferedEvent.save();

    // update from user
    let fromUser = getOrInitUser(oldOwnerId);
    fromUser.transferedOutValue = amountFloat
      .times(latestPrice)
      .plus(fromUser.transferedOutValue);
    fromUser.transferedOutShares = amount.plus(fromUser.transferedOutShares);
    fromUser.save();

    // update to user
    let toUser = getOrInitUser(newOwnerId);
    toUser.transferedInValue = amountFloat
      .times(latestPrice)
      .plus(toUser.transferedInValue);
    toUser.transferedInShares = amount.plus(toUser.transferedInShares);
    toUser.save();
  } else {
    log.error('Internal Error: {}', ['FtTransfer Event']);
  }
}

export function handleFtBurn(
  method: string,
  event: string,
  data: TypedMap<string, JSONValue>,
  receipt: near.ReceiptWithOutcome
): void {
  const amount = BigDecimal.fromString(data.get('amount')!.toString());

  // update price
  updatePrice(event, method, receipt, BigDecimal.zero(), amount.neg());
}

export function handleFtMint(
  method: string,
  event: string,
  data: TypedMap<string, JSONValue>,
  receipt: near.ReceiptWithOutcome
): void {
  const amount = BigDecimal.fromString(data.get('amount')!.toString());

  // update price
  updatePrice(event, method, receipt, BigDecimal.zero(), amount);
}
