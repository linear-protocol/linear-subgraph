import {
  near,
  BigInt,
  log,
  JSONValue,
  TypedMap,
  BigDecimal,
} from "@graphprotocol/graph-ts";
import { FtTransfer, PriceVersion,Price } from "../../generated/schema";
import { getOrInitUser,getOrInitPrice,getLatestPrice } from "../helper/initializer";

export function handleFtTransfer(
  data: TypedMap<string, JSONValue>,
  receipt: near.ReceiptWithOutcome
): void {
  const timestamp = receipt.block.header.timestampNanosec;
  const receiptHash = receipt.receipt.id.toBase58();

  const oldOwnerId = data.get("old_owner_id")!.toString();
  const newOwnerId = data.get("new_owner_id")!.toString();
  const amount = BigInt.fromString(data.get("amount")!.toString());
  const amountFloat = BigDecimal.fromString(data.get("amount")!.toString());
  // update event
  let transferedEvent = FtTransfer.load(receiptHash);
  if (!transferedEvent) {
    const priceVersion = PriceVersion.load("price")!;
    const latestPrice = priceVersion.latestPrice;
    transferedEvent = new FtTransfer(receiptHash);
    transferedEvent.to = newOwnerId;
    transferedEvent.from = oldOwnerId;
    transferedEvent.amount = amount;
    transferedEvent.timestamp = timestamp.toString();
    transferedEvent.price = latestPrice;
    transferedEvent.save();

    // update from user
    let fromUser = getOrInitUser(oldOwnerId);
    let temp = fromUser.transferedOut!;
    fromUser.transferedOutValue = amountFloat.times(latestPrice).plus(fromUser.transferedOutValue);
    fromUser.transferedOutShares = amount.plus(fromUser.transferedOutShares);
    temp.push(receiptHash);
    fromUser.transferedOut = temp;
    fromUser.save();

    // update to user
    let toUser = getOrInitUser(newOwnerId);
    toUser.transferedInValue = amountFloat.times(latestPrice).plus(toUser.transferedInValue);
    toUser.transferedInShares = amount.plus(toUser.transferedInShares)
    temp = toUser.transferedIn!;
    temp.push(receiptHash);
    toUser.transferedIn = temp;
    toUser.save();
  } else {
    log.error("internal error: {}", ["transfer event"]);
  }
}

export function handleFtBurn(
  data: TypedMap<string, JSONValue>,
  receipt: near.ReceiptWithOutcome
): void {
  const timestamp = receipt.block.header.timestampNanosec;
  const receiptHash = receipt.receipt.id.toBase58();
  // r#"EVENT_JSON:{"standard":"nep141","version":"1.0.0","event":"ft_burn","data":[{"owner_id":"bob","amount":"100"}]}"#
  const amount = BigDecimal.fromString(data.get("amount")!.toString());
  let priceVersion = PriceVersion.load('price')!;
  let lastPrice = getOrInitPrice(priceVersion.lastPriceID.toString())!;
  let nextPrice = getOrInitPrice(priceVersion.nextPriceID.toString())!;
  // create new price
  nextPrice.deltaLinearAmount = amount;
  nextPrice.totalNearAmount = lastPrice.totalNearAmount;
  nextPrice.totalLinearAmount = lastPrice.totalLinearAmount.minus(amount);
  nextPrice.price = nextPrice.totalNearAmount.div(nextPrice.totalLinearAmount);
  nextPrice.timeStamp = BigInt.fromU64(timestamp);
  nextPrice.event = "ft_burn";
  nextPrice.receiptHash = receiptHash;
  nextPrice.method = "storage_unregister";
  nextPrice.save();
  // update price version
  priceVersion.lastPriceID = priceVersion.nextPriceID;
  priceVersion.nextPriceID = priceVersion.nextPriceID.plus(BigInt.fromU32(1));
  priceVersion.latestPrice = nextPrice.price;
  priceVersion.save();

}


export function handleEpochUpdateRewards(
  data: TypedMap<string, JSONValue>,
  receipt: near.ReceiptWithOutcome
): void {
  const timestamp = receipt.block.header.timestampNanosec;
  const receiptHash = receipt.receipt.id.toBase58();
  // "EVENT_JSON:{"standard":"linear","version":"1.0.0","event":"epoch_update_rewards","data":[{"validator_id":"alice","old_balance":"100","new_balance":"120","rewards":"20"}]}"#
  const rewards = BigDecimal.fromString(data.get("rewards")!.toString());
  let priceVersion = PriceVersion.load('price')!;
  let lastPrice = getOrInitPrice(priceVersion.lastPriceID.toString())!;
  let nextPrice = getOrInitPrice(priceVersion.nextPriceID.toString())!;
  nextPrice.deltaNearAmount = rewards;
  nextPrice.totalNearAmount = lastPrice.totalNearAmount.plus(rewards);
  nextPrice.totalLinearAmount = lastPrice.totalLinearAmount;
  nextPrice.price = nextPrice.totalNearAmount.div(nextPrice.totalLinearAmount);
  nextPrice.timeStamp = BigInt.fromU64(timestamp);
  nextPrice.event = "epoch_update_rewards";
  nextPrice.receiptHash = receiptHash;
  nextPrice.method = "epoch_update_rewards";
  nextPrice.save();

  priceVersion.lastPriceID = priceVersion.nextPriceID;
  priceVersion.nextPriceID = priceVersion.nextPriceID.plus(BigInt.fromU32(1));
  priceVersion.latestPrice = nextPrice.price;
  priceVersion.save()

}

export function handleFtMint(
  data: TypedMap<string, JSONValue>,
  receipt: near.ReceiptWithOutcome
): void {
  const timestamp = receipt.block.header.timestampNanosec;
  const receiptHash = receipt.receipt.id.toBase58();

  const amount = BigDecimal.fromString(data.get("amount")!.toString());
  let priceVersion = PriceVersion.load('price')!;
  let lastPrice = getOrInitPrice(priceVersion.lastPriceID.toString())!;
  let nextPrice = getOrInitPrice(priceVersion.nextPriceID.toString())!;
  // create new price
  nextPrice.deltaLinearAmount = amount;
  nextPrice.totalNearAmount = lastPrice.totalNearAmount;
  nextPrice.totalLinearAmount = lastPrice.totalLinearAmount.plus(amount);
  nextPrice.price = nextPrice.totalNearAmount.div(nextPrice.totalLinearAmount);
  nextPrice.timeStamp = BigInt.fromU64(timestamp);
  nextPrice.event = "ft_mint";
  nextPrice.receiptHash = receiptHash;
  nextPrice.method = "epoch_update_rewards";
  nextPrice.save();
  // update price version
  priceVersion.lastPriceID = priceVersion.nextPriceID;
  priceVersion.nextPriceID = priceVersion.nextPriceID.plus(BigInt.fromU32(1));
  priceVersion.latestPrice = nextPrice.price;
  priceVersion.save();


}
