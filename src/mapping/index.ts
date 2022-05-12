import {
  near,
  BigInt,
  log,
  json,
  JSONValue,
  TypedMap,
  BigDecimal,
} from "@graphprotocol/graph-ts";
import {
  Price,
  FtTransfer,
  TotalSwapFee,
  Version,
} from "../../generated/schema";
import { getOrInitUser } from "./helper/initializer";

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
      method == "stake_all") &&
    event == "stake"
  ) {
    handleStakeEvent(data, receipt);
  } else if (
    (method == "unstake" || method == "unstake_all") &&
    event == "unstake"
  ) {
    handleUnstakeEvent(data, receipt);
  } else if (method == "instant_unstake" && event == "instant_unstake") {
    handleInstantUnstakeEvent(data);
  } else if (
    (method == "ft_transfer" ||
      method == "ft_transfer_call" ||
      method == "remove_liquidity") &&
    event == "ft_transfer"
  ) {
    handleFtTransferEvent(data, receipt);
  } else if (
    method == "instant_unstake" &&
    event == "liquidity_pool_swap_fee"
  ) {
    handleLiquidityPoolSwapFeeEvent(data, receipt);
  }
}

// ----- Event Mapping Handlers ------

function handleStakeEvent(
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

function handleUnstakeEvent(
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

function handleInstantUnstakeEvent(data: TypedMap<string, JSONValue>): void {
  // parse event
  let accountId = data.get("account_id")!.toString();
  let unstakeAmountStr = data.get("unstaked_amount")!.toString();
  let unstakeLinearAmountStr = data.get("swapped_stake_shares")!.toString();
  let unstakeAmount = BigInt.fromString(unstakeAmountStr);
  let unstakeLinearAmount = BigInt.fromString(unstakeLinearAmountStr);
  let feesPaid = BigInt.fromString(data.get("fee_amount")!.toString());

  // update user
  let user = getOrInitUser(accountId);
  user.unstakeReceivedNear = user.unstakeReceivedNear.plus(unstakeAmount);
  user.unstakedLinear = user.unstakedLinear.plus(unstakeLinearAmount);
  user.feesPaid = user.feesPaid.plus(feesPaid);
  user.save();
}

function handleFtTransferEvent(
  data: TypedMap<string, JSONValue>,
  receipt: near.ReceiptWithOutcome
): void {
  const timestamp = receipt.block.header.timestampNanosec;
  const receiptHash = receipt.receipt.id.toBase58();

  const oldOwnerId = data.get("old_owner_id")!.toString();
  const newOwnerId = data.get("new_owner_id")!.toString();
  const amount = BigInt.fromString(data.get("amount")!.toString());

  // update event
  let transferedEvent = FtTransfer.load(receiptHash);
  if (!transferedEvent) {
    transferedEvent = new FtTransfer(receiptHash);
    transferedEvent.to = newOwnerId;
    transferedEvent.from = oldOwnerId;
    transferedEvent.amount = amount;
    transferedEvent.timestamp = timestamp.toString();
    transferedEvent.save();

    // update from user
    let fromUser = getOrInitUser(oldOwnerId);
    let temp = fromUser.transferedOut!;
    temp.push(receiptHash);
    fromUser.transferedOut = temp;
    fromUser.save();

    // update to user
    let toUser = getOrInitUser(newOwnerId);
    temp = toUser.transferedIn!;
    temp.push(receiptHash);
    toUser.transferedIn = temp;
    toUser.save();
  } else {
    log.error("internal error: {}", ["transfer event"]);
  }
}

function handleLiquidityPoolSwapFeeEvent(
  data: TypedMap<string, JSONValue>,
  receipt: near.ReceiptWithOutcome
): void {
  const timestamp = receipt.block.header.timestampNanosec;

  const poolFee = data.get("pool_fee_stake_shares")!;

  // update total swap fee
  let version = Version.load("latest".toString());
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
    version = new Version("latest".toString());
    version.version = 0;
    version.save();

    // create total fees
    let newTotalFee = new TotalSwapFee("0".toString());
    newTotalFee.timestamp = timestamp.toString();
    newTotalFee.feesPaid = BigInt.fromString(poolFee.toString());
    newTotalFee.save();
  }
}
