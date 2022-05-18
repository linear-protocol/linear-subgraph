import { near, json, JSONValue, TypedMap } from "@graphprotocol/graph-ts";
import { handleStake, handleUnstake,handleRebalance } from "./stake";
import { handleFtTransfer,handleFtBurn,handleEpochUpdateRewards,handleFtMint } from "./fungible-token";
import {
  handleInstantUnstake,
  handleLiquidityPoolSwapFee,
} from "./liquidity-pool";

export function handleReceipt(receipt: near.ReceiptWithOutcome): void {
  const actions = receipt.receipt.actions;
  for (let i = 0; i < actions.length; i++) {
    handleAction(actions[i], receipt);
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
    if (outcomeLog.startsWith("EVENT_JSON:")) {
      outcomeLog = outcomeLog.replace("EVENT_JSON:", "");
      const jsonData = json.try_fromString(outcomeLog);
      const jsonObject = jsonData.value.toObject();
      const event = jsonObject.get("event")!;
      const dataArr = jsonObject.get("data")!.toArray();
      const dataObj: TypedMap<string, JSONValue> = dataArr[0].toObject();

      handleEvent(methodName, event.toString(), dataObj, receipt);
    }
  }
}

function handleEvent(
  method: string,
  event: string,
  data: TypedMap<string, JSONValue>,
  receipt: near.ReceiptWithOutcome
): void {
  if (
    (method == "stake" ||
      method == "deposit_and_stake" ||
      method == "stake_all") 
  ) {
    if (event == "stake") {
      handleStake(data, receipt, method);
    } else if (event == "rebalance_liquidity") {
      handleRebalance(data, receipt, method);
    }
  } else if (
    (method == "unstake" || method == "unstake_all") &&
    event == "unstake"
  ) {
    handleUnstake(data, receipt, method);
  } else if (method == "instant_unstake" && event == "instant_unstake") {
    handleInstantUnstake(data);
  } else if (
    (method == "ft_transfer" ||
      method == "ft_transfer_call" ||
      method == "remove_liquidity") &&
    event == "ft_transfer"
  ) {
    handleFtTransfer(data, receipt);
  } else if (
    method == "instant_unstake" &&
    event == "liquidity_pool_swap_fee"
  ) {
    handleLiquidityPoolSwapFee(data, receipt);
  } else if (
    method == "storage_unregister" && 
    event == "ft_burn"
  ) {
    handleFtBurn(data,receipt);
  } else if (
    (method == "epoch_update_rewards" ||
     method ==  "validator_get_balance_callback") 
  ) {
    if (event == "epoch_update_rewards") {
      handleEpochUpdateRewards(data,receipt);
    } else if (event == "ft_mint"){
      handleFtMint(data,receipt);
    }
  } 
}
