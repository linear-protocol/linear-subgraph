import {
  near,
  BigInt,
  JSONValue,
  TypedMap,
  BigDecimal,
} from '@graphprotocol/graph-ts';
import { TotalSwapFee, Version } from '../../generated/schema';
import { getOrInitUser } from '../helper/initializer';
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
  method: string,
  event: string,
  data: TypedMap<string, JSONValue>,
  receipt: near.ReceiptWithOutcome
): void {
  // rebalance operation is a internal operation in linear, so we don't care about the accountId
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
