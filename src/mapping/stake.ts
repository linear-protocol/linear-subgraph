import {
  near,
  BigInt,
  JSONValue,
  TypedMap,
  BigDecimal,
} from "@graphprotocol/graph-ts";
import { Price ,PriceVersion} from "../../generated/schema";
import { getOrInitUser,getLatestPrice,getOrInitPrice } from "../helper/initializer";

export function handleStake(
  data: TypedMap<string, JSONValue>,
  receipt: near.ReceiptWithOutcome,
  methodName: string
): void {
  const timestamp = receipt.block.header.timestampNanosec;
  const blockHeight = receipt.block.header.height;
  const receiptHash = receipt.receipt.id.toBase58();
  // parse event
  const accountId = data.get("account_id")!.toString();
  const stakeAmountStr = data.get("staked_amount")!.toString();
  const mintedSharesStr = data.get("minted_stake_shares")!.toString();
  const stakeAmount = BigInt.fromString(stakeAmountStr);
  const mintedShares = BigInt.fromString(mintedSharesStr);
  const mintedSharesFloat = BigDecimal.fromString(mintedSharesStr);
  const stakeAmountFloat = BigDecimal.fromString(stakeAmountStr);

  // update user
  let user = getOrInitUser(accountId);
  user.stakedNear = user.stakedNear.plus(stakeAmount);
  user.mintedLinear = user.mintedLinear.plus(mintedShares);
  if (user.firstStakingTime.isZero()) {
    user.firstStakingTime = BigInt.fromU64(timestamp);
  }
  user.save();
  // query the lastest version of price
  let latestPrice = getLatestPrice();
  if (latestPrice == null) {
    // create the first version of price
    let tmpPrice = getOrInitPrice('0');
    let initValue = BigDecimal.fromString("10000000000000000000000000");
    tmpPrice.totalLinearAmount = initValue.plus(mintedSharesFloat);
    tmpPrice.totalNearAmount = initValue.plus(stakeAmountFloat);
    tmpPrice.deltaLinearAmount = mintedSharesFloat;
    tmpPrice.deltaNearAmount = stakeAmountFloat;
    tmpPrice.price = tmpPrice.totalNearAmount.div(tmpPrice.totalLinearAmount);
    tmpPrice.timeStamp = BigInt.fromU64(timestamp);
    tmpPrice.event = "stake";
    tmpPrice.receiptHash = receiptHash;
    tmpPrice.method = methodName;
    tmpPrice.save();

    let priceVersion = new PriceVersion("price");
    priceVersion.lastPriceID = BigInt.fromString("0");
    priceVersion.nextPriceID = BigInt.fromString("1");
    priceVersion.latestPrice = tmpPrice.price;
    priceVersion.save();
  } else {
    let priceVersion = PriceVersion.load('price')!;
    let lastPrice = getOrInitPrice(priceVersion.lastPriceID.toString())!;
    let nextPrice = getOrInitPrice(priceVersion.nextPriceID.toString())!;
    // create new price
    nextPrice.deltaLinearAmount = mintedSharesFloat;
    nextPrice.deltaNearAmount = stakeAmountFloat;
    nextPrice.totalNearAmount = lastPrice.totalNearAmount.plus(stakeAmountFloat);
    nextPrice.totalLinearAmount = lastPrice.totalLinearAmount.plus(mintedSharesFloat);
    nextPrice.price = nextPrice.totalNearAmount.div(nextPrice.totalLinearAmount);
    nextPrice.timeStamp = BigInt.fromU64(timestamp);
    nextPrice.event = "stake";
    nextPrice.receiptHash = receiptHash;
    nextPrice.method = methodName;
    nextPrice.save();
    // update price version
    priceVersion.lastPriceID = priceVersion.nextPriceID;
    priceVersion.nextPriceID = priceVersion.nextPriceID.plus(BigInt.fromU32(1));
    priceVersion.latestPrice = nextPrice.price;
    priceVersion.save();
  }
}

export function handleUnstake(
  data: TypedMap<string, JSONValue>,
  receipt: near.ReceiptWithOutcome,
  methodName: string
): void {
  const timestamp = receipt.block.header.timestampNanosec;
  const blockHeight = receipt.block.header.height;
  const receiptHash = receipt.receipt.id.toBase58();
  // parse event
  const accountId = data.get("account_id")!.toString();
  const unstakeAmountStr = data.get("unstaked_amount")!.toString();
  const burnedSharesStr = data.get("burnt_stake_shares")!.toString();
  const unstakeAmount = BigInt.fromString(unstakeAmountStr);
  const burnedShares = BigInt.fromString(burnedSharesStr);
  const burnedSharesFloat = BigDecimal.fromString(burnedSharesStr);
  const unstakeSharesFloat = BigDecimal.fromString(unstakeAmountStr);

  // update user
  let user = getOrInitUser(accountId);
  user.unstakeReceivedNear = user.unstakeReceivedNear.plus(unstakeAmount);
  user.unstakedLinear = user.unstakedLinear.plus(burnedShares);
  user.save();

  let priceVersion = PriceVersion.load('price')!;
  let lastPrice = getOrInitPrice(priceVersion.lastPriceID.toString())!;
  let nextPrice = getOrInitPrice(priceVersion.nextPriceID.toString())!;
  // create new price
  nextPrice.deltaLinearAmount = burnedSharesFloat;
  nextPrice.deltaNearAmount = unstakeSharesFloat;
  nextPrice.totalNearAmount = lastPrice.totalNearAmount.minus(unstakeSharesFloat);
  nextPrice.totalLinearAmount = lastPrice.totalLinearAmount.minus(burnedSharesFloat);
  nextPrice.price = nextPrice.totalNearAmount.div(nextPrice.totalLinearAmount);
  nextPrice.timeStamp = BigInt.fromU64(timestamp);
  nextPrice.event = "unstake";
  nextPrice.receiptHash = receiptHash;
  nextPrice.method = methodName;
  nextPrice.save();
  // update price version
  priceVersion.lastPriceID = priceVersion.nextPriceID;
  priceVersion.nextPriceID = priceVersion.nextPriceID.plus(BigInt.fromU32(1));
  priceVersion.latestPrice = nextPrice.price;
  priceVersion.save();
}

export function handleRebalance(
  data: TypedMap<string, JSONValue>,
  receipt: near.ReceiptWithOutcome,
  methodName: string
): void {
  const timestamp = receipt.block.header.timestampNanosec;
  const blockHeight = receipt.block.header.height;
  const receiptHash = receipt.receipt.id.toBase58();

  // rebalance operation is a internal operation in linear, so we don't care about the accountId
  const increaseSharesStr = data.get("increased_amount")!.toString();
  const burnedSharesStr = data.get("burnt_stake_shares")!.toString();
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
  nextPrice.event = "rebalance_liquidity";
  nextPrice.method = methodName;
  nextPrice.receiptHash = receiptHash;
  nextPrice.save();
  // update price version
  priceVersion.lastPriceID = priceVersion.nextPriceID;
  priceVersion.nextPriceID = priceVersion.nextPriceID.plus(BigInt.fromU32(1));
  priceVersion.latestPrice = nextPrice.price;
  priceVersion.save();
}
