import {
  near,
  BigInt,
  JSONValue,
  TypedMap,
  BigDecimal,
} from "@graphprotocol/graph-ts";
import { Price } from "../../generated/schema";
import { getOrInitUser } from "../helper/initializer";

export function handleStake(
  data: TypedMap<string, JSONValue>,
  receipt: near.ReceiptWithOutcome
): void {
  const timestamp = receipt.block.header.timestampNanosec;
  const blockHeight = receipt.block.header.height;

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

  // create price
  let price = new Price(blockHeight.toString());
  price.linearAmount = mintedSharesFloat;
  price.nearAmount = stakeAmountFloat;
  price.timestamp = timestamp.toString();
  price.price = stakeAmountFloat.div(mintedSharesFloat);
  price.save();
}

export function handleUnstake(
  data: TypedMap<string, JSONValue>,
  receipt: near.ReceiptWithOutcome
): void {
  const timestamp = receipt.block.header.timestampNanosec;
  const blockHeight = receipt.block.header.height;

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

  // create price
  let price = new Price(blockHeight.toString());
  price.nearAmount = unstakeSharesFloat;
  price.linearAmount = burnedSharesFloat;
  price.timestamp = timestamp.toString();
  price.price = unstakeSharesFloat.div(burnedSharesFloat);
  price.save();
}
