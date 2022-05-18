import {
  near,
  BigInt,
  JSONValue,
  TypedMap,
  BigDecimal,
} from '@graphprotocol/graph-ts';
import { TotalSwapFee } from '../../generated/schema';
import {
  getOrInitUser,
  getOrInitStatus,
  getOrInitTotalSwapFee,
} from '../helper/initializer';
import { updatePrice } from '../helper/price';

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

  // update version
  let status = getOrInitStatus();
  const currentVersion = status.totalSwapFeeVersion;
  const nextVersion = currentVersion.plus(BigInt.fromU32(1));
  status.totalSwapFeeVersion = nextVersion;
  status.save();

  // update total swap fee
  const lastTotalFee = getOrInitTotalSwapFee(currentVersion.toString());
  let nextTotalFee = getOrInitTotalSwapFee(nextVersion.toString());
  nextTotalFee.timestamp = BigInt.fromU64(timestamp);
  nextTotalFee.feesPaid = lastTotalFee.feesPaid.plus(
    BigInt.fromString(poolFee.toString())
  );
  nextTotalFee.save();
}

export function handleRebalanceLiquidity(
  method: string,
  event: string,
  data: TypedMap<string, JSONValue>,
  receipt: near.ReceiptWithOutcome
): void {
  const increaseAmountStr = data.get('increased_amount')!.toString();
  const burnedSharesStr = data.get('burnt_stake_shares')!.toString();
  const burnedSharesFloat = BigDecimal.fromString(burnedSharesStr);
  const increasedAmountFloat = BigDecimal.fromString(increaseAmountStr);

  // update price
  updatePrice(
    event,
    method,
    receipt,
    increasedAmountFloat.neg(),
    burnedSharesFloat.neg()
  );
}
