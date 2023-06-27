import { near, json, JSONValue, TypedMap } from '@graphprotocol/graph-ts';
import { handleStake, handleUnstake } from './stake';
import { handleFtTransfer, handleFtBurn, handleFtMint } from './fungible-token';
import { handleEpochUpdateRewards, handleEpochUnstakeSuccess } from './epoch-action';
import {
  handleInstantUnstake,
  handleLiquidityPoolSwapFee,
  handleRebalanceLiquidity,
} from './liquidity-pool';

function handleEvent(
  method: string,
  event: string,
  data: TypedMap<string, JSONValue>,
  receipt: near.ReceiptWithOutcome
): void {
  if (
    method == 'stake' ||
    method == 'deposit_and_stake' ||
    method == 'stake_all'
  ) {
    if (event == 'stake') {
      handleStake(method, event, data, receipt);
    } else if (event == 'rebalance_liquidity') {
      handleRebalanceLiquidity(method, event, data, receipt);
    }
  } else if (
    (method == 'unstake' || method == 'unstake_all') &&
    event == 'unstake'
  ) {
    handleUnstake(method, event, data, receipt);
  } else if (method == 'instant_unstake' && event == 'instant_unstake') {
    handleInstantUnstake(data);
  } else if (
    (method == 'ft_transfer' ||
      method == 'ft_transfer_call' ||
      // there may be received $LiNEAR when removing liquidity
      method == 'remove_liquidity') &&
    event == 'ft_transfer'
  ) {
    handleFtTransfer(data, receipt);
  } else if (
    method == 'instant_unstake' &&
    event == 'liquidity_pool_swap_fee'
  ) {
    handleLiquidityPoolSwapFee(data, receipt);
  } else if (method == 'storage_unregister' && event == 'ft_burn') {
    handleFtBurn(method, event, data, receipt);
  } else if (
    method == 'epoch_update_rewards' ||
    method == 'validator_get_balance_callback'
  ) {
    if (event == 'epoch_update_rewards') {
      handleEpochUpdateRewards(method, event, data, receipt);
    } else if (event == 'ft_mint') {
      handleFtMint(method, event, data, receipt);
    }
  } else if (method == 'validator_unstaked_callback') {
    if (event == 'epoch_unstake_success') {
      handleEpochUnstakeSuccess(data, receipt);
    }
  }
}

function handleAction(
  action: near.ActionValue,
  receipt: near.ReceiptWithOutcome
): void {
  if (action.kind != near.ActionKind.FUNCTION_CALL) {
    return;
  }
  const outcome = receipt.outcome;
  const methodName = action.toFunctionCall().methodName;

  for (let logIndex = 0; logIndex < outcome.logs.length; logIndex++) {
    let outcomeLog = outcome.logs[logIndex].toString();
    if (outcomeLog.startsWith('EVENT_JSON:')) {
      outcomeLog = outcomeLog.replace('EVENT_JSON:', '');
      const jsonData = json.try_fromString(outcomeLog);
      const jsonObject = jsonData.value.toObject();
      const event = jsonObject.get('event')!;
      const dataArr = jsonObject.get('data')!.toArray();
      const dataObj: TypedMap<string, JSONValue> = dataArr[0].toObject();

      handleEvent(methodName, event.toString(), dataObj, receipt);
    }
  }
}

export function handleReceipt(receipt: near.ReceiptWithOutcome): void {
  const actions = receipt.receipt.actions;
  for (let i = 0; i < actions.length; i++) {
    handleAction(actions[i], receipt);
  }
}
