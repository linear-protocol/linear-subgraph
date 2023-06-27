import { near, BigInt, JSONValue, TypedMap, BigDecimal } from '@graphprotocol/graph-ts';
import { updatePrice } from '../helper/price';
import { ValidatorEpochInfo } from '../../generated/schema';

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
    entity.epochUnstakedAmount = entity.epochUnstakedAmount.plus(amount);

    entity.save();
  }
}
