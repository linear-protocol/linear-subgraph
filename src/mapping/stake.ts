import {
  near,
  BigInt,
  JSONValue,
  TypedMap,
  BigDecimal,
} from '@graphprotocol/graph-ts';
import { getOrInitUser } from '../helper/initializer';
import { updatePrice } from '../helper/price';
import { addStakeAmountChange } from '../helper/stake';

export function handleStake(
  method: string,
  event: string,
  data: TypedMap<string, JSONValue>,
  receipt: near.ReceiptWithOutcome
): void {
  const timestamp = receipt.block.header.timestampNanosec;

  // parse event
  const accountId = data.get('account_id')!.toString();
  const stakeAmountStr = data.get('staked_amount')!.toString();
  const mintedSharesStr = data.get('minted_stake_shares')!.toString();
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

  // update price
  updatePrice(event, method, receipt, stakeAmountFloat, mintedSharesFloat);

  // record stake amount change
  addStakeAmountChange(
    receipt.receipt.id.toBase58(),
    accountId,
    BigInt.fromU64(timestamp),
    stakeAmount
  );
}

export function handleUnstake(
  method: string,
  event: string,
  data: TypedMap<string, JSONValue>,
  receipt: near.ReceiptWithOutcome
): void {
  // parse event
  const accountId = data.get('account_id')!.toString();
  const unstakeAmountStr = data.get('unstaked_amount')!.toString();
  const burnedSharesStr = data.get('burnt_stake_shares')!.toString();
  const unstakeAmount = BigInt.fromString(unstakeAmountStr);
  const burnedShares = BigInt.fromString(burnedSharesStr);
  const burnedSharesFloat = BigDecimal.fromString(burnedSharesStr);
  const unstakeSharesFloat = BigDecimal.fromString(unstakeAmountStr);

  // update user
  let user = getOrInitUser(accountId);
  user.unstakeReceivedNear = user.unstakeReceivedNear.plus(unstakeAmount);
  user.unstakedLinear = user.unstakedLinear.plus(burnedShares);
  user.save();

  // update price
  updatePrice(
    event,
    method,
    receipt,
    unstakeSharesFloat.neg(),
    burnedSharesFloat.neg()
  );

  // record stake amount change
  addStakeAmountChange(
    receipt.receipt.id.toBase58(),
    accountId,
    BigInt.fromU64(receipt.block.header.timestampNanosec),
    unstakeAmount.neg()
  );
}
