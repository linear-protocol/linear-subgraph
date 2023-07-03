import { near, BigInt, JSONValue, TypedMap, BigDecimal } from '@graphprotocol/graph-ts';
import { updatePrice } from '../helper/price';
import { EpochCleanup, ValidatorEpochInfo } from '../../generated/schema';

export function handleEpochUpdateRewards(
  method: string,
  event: string,
  data: TypedMap<string, JSONValue>,
  receipt: near.ReceiptWithOutcome
): void {
  const rewards = BigDecimal.fromString(data.get('rewards')!.toString());
  updatePrice(event, method, receipt, rewards, BigDecimal.zero());
}

export function handleEpochUnstakeSuccess(
  data: TypedMap<string, JSONValue>,
  receipt: near.ReceiptWithOutcome
): void {
  const amount = BigInt.fromString(data.get('amount')!.toString());

  const epochId = receipt.block.header.epochId.toBase58();
  const validatorId = data.get('validator_id')!.toString();
  const id = epochId + '#' + validatorId;

  const entity = ValidatorEpochInfo.load(id);

  if (!entity) {
    const entity = new ValidatorEpochInfo(id);

    entity.epochId = epochId;
    entity.validatorId = validatorId;
    entity.epochUnstakedAmount = amount;

    entity.save();
  } else {
    // Logic here should be redundant because one validator can only be epoch_unstake() once.
    // But just in case, we still keep it here.
    entity.epochUnstakedAmount = entity.epochUnstakedAmount.plus(amount);

    entity.save();
  }
}

export function handleEpochCleanup(
  data: TypedMap<string, JSONValue>,
  receipt: near.ReceiptWithOutcome
): void {
  const timestamp = receipt.block.header.timestampNanosec;

  const stakeAmountToSettle = BigInt.fromString(data.get('stake_amount_to_settle')!.toString());
  const unstakeAmountToSettle = BigInt.fromString(data.get('unstake_amount_to_settle')!.toString());

  // Use epochId as id
  const id = receipt.block.header.epochId.toBase58();

  const entity = EpochCleanup.load(id);
  if (entity) {
    if (!entity.stakeAmountToSettle.equals(stakeAmountToSettle) ||
        !entity.unstakeAmountToSettle.equals(unstakeAmountToSettle)
    ) {
      throw new Error(`EpochCleanup entity already exists with different values. Receipt: ${receipt.receipt.id.toBase58()}`);
    }
  } else {
    const entity = new EpochCleanup(id);

    entity.timestamp = BigInt.fromU64(timestamp);
    entity.stakeAmountToSettle = stakeAmountToSettle;
    entity.unstakeAmountToSettle = unstakeAmountToSettle;

    entity.save();
  }
}
