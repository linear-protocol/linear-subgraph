import { near, BigInt, BigDecimal } from '@graphprotocol/graph-ts';
import { Price, Status } from '../../generated/schema';
import { getOrInitPrice, getOrInitStatus } from './initializer';

export function getLatestPrice(): Price | null {
  let status = Status.load('price');
  if (status != null) {
    let price = Price.load(status.lastestPriceVersion.toString())!;
    return price as Price;
  } else {
    return null;
  }
}

export function updatePrice(
  event: string,
  method: string,
  receipt: near.ReceiptWithOutcome,
  deltaNear: BigDecimal,
  deltaLinear: BigDecimal
): void {
  const timestamp = receipt.block.header.timestampNanosec;
  const receiptHash = receipt.receipt.id.toBase58();

  let status = getOrInitStatus();
  let lastPrice = getOrInitPrice(status.lastestPriceVersion.toString())!;

  // create new price
  const nextVersion = status.lastestPriceVersion.plus(BigInt.fromU32(1));
  let nextPrice = new Price(nextVersion.toString());
  nextPrice.deltaNearAmount = deltaNear;
  nextPrice.deltaLinearAmount = deltaLinear;
  nextPrice.totalNearAmount = lastPrice.totalNearAmount.plus(deltaNear);
  nextPrice.totalLinearAmount = lastPrice.totalLinearAmount.plus(deltaLinear);
  nextPrice.price = nextPrice.totalNearAmount.div(nextPrice.totalLinearAmount);
  nextPrice.timestamp = BigInt.fromU64(timestamp);
  nextPrice.event = event;
  nextPrice.receiptHash = receiptHash;
  nextPrice.method = method;
  nextPrice.save();

  // update status
  status.lastestPriceVersion = nextVersion;
  status.latestPrice = nextPrice.price;
  status.save();
}
