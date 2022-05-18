import { near, BigInt, JSONValue, TypedMap, BigDecimal } from '@graphprotocol/graph-ts';
import { PriceVersion } from '../../generated/schema';
import { getOrInitPrice } from '../helper/initializer';

export function handleEpochUpdateRewards(
  data: TypedMap<string, JSONValue>,
  receipt: near.ReceiptWithOutcome
): void {
  const timestamp = receipt.block.header.timestampNanosec;
  const receiptHash = receipt.receipt.id.toBase58();

  const rewards = BigDecimal.fromString(data.get('rewards')!.toString());
  let priceVersion = PriceVersion.load('price')!;
  let lastPrice = getOrInitPrice(priceVersion.lastPriceID.toString())!;
  let nextPrice = getOrInitPrice(priceVersion.nextPriceID.toString())!;
  nextPrice.deltaNearAmount = rewards;
  nextPrice.totalNearAmount = lastPrice.totalNearAmount.plus(rewards);
  nextPrice.totalLinearAmount = lastPrice.totalLinearAmount;
  nextPrice.price = nextPrice.totalNearAmount.div(nextPrice.totalLinearAmount);
  nextPrice.timeStamp = BigInt.fromU64(timestamp);
  nextPrice.event = 'epoch_update_rewards';
  nextPrice.receiptHash = receiptHash;
  nextPrice.method = 'epoch_update_rewards';
  nextPrice.save();

  priceVersion.lastPriceID = priceVersion.nextPriceID;
  priceVersion.nextPriceID = priceVersion.nextPriceID.plus(BigInt.fromU32(1));
  priceVersion.latestPrice = nextPrice.price;
  priceVersion.save();
}
