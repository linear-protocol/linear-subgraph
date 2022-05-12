import {
  near,
  BigInt,
  log,
  JSONValue,
  TypedMap,
} from "@graphprotocol/graph-ts";
import { FtTransfer } from "../../generated/schema";
import { getOrInitUser } from "../helper/initializer";

export function handleFtTransfer(
  data: TypedMap<string, JSONValue>,
  receipt: near.ReceiptWithOutcome
): void {
  const timestamp = receipt.block.header.timestampNanosec;
  const receiptHash = receipt.receipt.id.toBase58();

  const oldOwnerId = data.get("old_owner_id")!.toString();
  const newOwnerId = data.get("new_owner_id")!.toString();
  const amount = BigInt.fromString(data.get("amount")!.toString());

  // update event
  let transferedEvent = FtTransfer.load(receiptHash);
  if (!transferedEvent) {
    transferedEvent = new FtTransfer(receiptHash);
    transferedEvent.to = newOwnerId;
    transferedEvent.from = oldOwnerId;
    transferedEvent.amount = amount;
    transferedEvent.timestamp = timestamp.toString();
    transferedEvent.save();

    // update from user
    let fromUser = getOrInitUser(oldOwnerId);
    let temp = fromUser.transferedOut!;
    temp.push(receiptHash);
    fromUser.transferedOut = temp;
    fromUser.save();

    // update to user
    let toUser = getOrInitUser(newOwnerId);
    temp = toUser.transferedIn!;
    temp.push(receiptHash);
    toUser.transferedIn = temp;
    toUser.save();
  } else {
    log.error("internal error: {}", ["transfer event"]);
  }
}
