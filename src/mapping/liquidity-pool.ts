import { near, BigInt, JSONValue, TypedMap, BigDecimal } from '@graphprotocol/graph-ts';
import { TotalSwapFee, Version } from '../../generated/schema';
import { getOrInitUser, getOrInitPrice } from '../helper/initializer';
import { PriceVersion } from '../../generated/schema';

export function handleInstantUnstake(data: TypedMap<string, JSONValue>): void {
  // parse event
  let accountId = data.get('account_id')!.toString();
  let unstakeAmountStr = data.get('unstaked_amount')!.toString();
  let unstakeLinearAmountStr = data.get('swapped_stake_shares')!.toString();
  let unstakeAmount = BigInt.fromString(unstakeAmountStr);
  let unstakeLinearAmount = BigInt.fromString(unstakeLinearAmountStr);
  let feesPaid = BigInt.fromString(data.get('fee_amount')!.toString());

  // update user
  let user = getOrInitUser(accountId);
  user.unstakeReceivedNear = user.unstakeReceivedNear.plus(unstakeAmount);
  user.unstakedLinear = user.unstakedLinear.plus(unstakeLinearAmount);
  user.feesPaid = user.feesPaid.plus(feesPaid);
  user.save();
}

export function handleLiquidityPoolSwapFee(
  data: TypedMap<string, JSONValue>,
  receipt: near.ReceiptWithOutcome
): void {
  const timestamp = receipt.block.header.timestampNanosec;

  const poolFee = data.get('pool_fee_stake_shares')!;

  // update total swap fee
  let version = Version.load('latest'.toString());
  if (version) {
    // increment version
    const lastVersion = version.version;
    const lastTotalFee = TotalSwapFee.load(lastVersion.toString())!;
    version.version += 1;
    version.save();

    // create total fees
    const lastFees = lastTotalFee.feesPaid;
    const newVersion = lastVersion + 1;
    let newTotalFee = new TotalSwapFee(newVersion.toString());
    newTotalFee.timestamp = timestamp.toString();
    newTotalFee.feesPaid = lastFees.plus(BigInt.fromString(poolFee.toString()));
    newTotalFee.save();
  } else {
    // creaate version
    version = new Version('latest'.toString());
    version.version = 0;
    version.save();

    // create total fees
    let newTotalFee = new TotalSwapFee('0'.toString());
    newTotalFee.timestamp = timestamp.toString();
    newTotalFee.feesPaid = BigInt.fromString(poolFee.toString());
    newTotalFee.save();
  }
}

export function handleRebalanceLiquidity(
  data: TypedMap<string, JSONValue>,
  receipt: near.ReceiptWithOutcome,
  methodName: string
): void {
  const timestamp = receipt.block.header.timestampNanosec;
  const receiptHash = receipt.receipt.id.toBase58();

  // rebalance operation is a internal operation in linear, so we don't care about the accountId
  const increaseSharesStr = data.get('increased_amount')!.toString();
  const burnedSharesStr = data.get('burnt_stake_shares')!.toString();
  const burnedSharesFloat = BigDecimal.fromString(burnedSharesStr);
  const increasedSharesFloat = BigDecimal.fromString(increaseSharesStr);
  let priceVersion = PriceVersion.load('price')!;
  let lastPrice = getOrInitPrice(priceVersion.lastPriceID.toString())!;
  let nextPrice = getOrInitPrice(priceVersion.nextPriceID.toString())!;
  // create new price
  nextPrice.deltaLinearAmount = burnedSharesFloat;
  nextPrice.deltaNearAmount = increasedSharesFloat;
  nextPrice.totalNearAmount = lastPrice.totalNearAmount.minus(increasedSharesFloat);
  nextPrice.totalLinearAmount = lastPrice.totalLinearAmount.minus(burnedSharesFloat);
  nextPrice.price = nextPrice.totalNearAmount.div(nextPrice.totalLinearAmount);
  nextPrice.timeStamp = BigInt.fromU64(timestamp);
  nextPrice.event = 'rebalance_liquidity';
  nextPrice.method = methodName;
  nextPrice.receiptHash = receiptHash;
  nextPrice.save();
  // update price version
  priceVersion.lastPriceID = priceVersion.nextPriceID;
  priceVersion.nextPriceID = priceVersion.nextPriceID.plus(BigInt.fromU32(1));
  priceVersion.latestPrice = nextPrice.price;
  priceVersion.save();
}
