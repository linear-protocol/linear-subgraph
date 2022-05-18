import { near, BigInt, BigDecimal } from '@graphprotocol/graph-ts';
import { Price, Status } from '../../generated/schema';
import { getOrInitPrice, getOrInitStatus } from './initializer';

export function getLatestPrice(): Price | null {
  const status = getOrInitStatus();
  if (status != null) {
    const price = Price.load(status.priceVersion.toString())!;
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
  let lastPrice = getOrInitPrice(status.priceVersion.toString());

  // create new price
  const nextVersion = status.priceVersion.plus(BigInt.fromU32(1));
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
  status.priceVersion = nextVersion;
  status.price = nextPrice.price;
  status.save();
}
