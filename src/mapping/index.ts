import {
  near,
  BigInt,
  log,
  json,
  TypedMap,
  JSONValue,
  Value,
  BigDecimal,
} from "@graphprotocol/graph-ts";
import {
  Price,
  Account,
  LpApy,
  LpApyFlag,
  FtTransfer,
} from "../../generated/schema";

export function handleReceipt(receipt: near.ReceiptWithOutcome): void {
  const actions = receipt.receipt.actions;
  for (let i = 0; i < actions.length; i++) {
    handleAction(actions[i], receipt);
  }
}

function checkAndCreateUser(
  id: string,
  startTime: string,
  height: BigInt,
  mintedLinear: BigInt,
  stakedNear: BigInt,
  unstakeReceivedNear: BigInt,
  unstakeLinear: BigInt,
  transferedIn: string[],
  transferedOut: string[],
  feesPayed: BigInt
): void {
  let user = new Account(id);
  user.startTime = startTime;
  user.height = height;
  user.mintedLinear = mintedLinear;
  user.stakedNear = stakedNear;
  user.unstakeReceivedNear = unstakeReceivedNear;
  user.unstakeLinear = unstakeLinear;
  user.transferedIn = transferedIn;
  user.transferedOut = transferedOut;
  user.feesPayed = feesPayed;
  user.save();
}

function handleAction(
  action: near.ActionValue,
  receiptWithOutcome: near.ReceiptWithOutcome
): void {
  if (action.kind != near.ActionKind.FUNCTION_CALL) {
    return;
  }
  const timeStamp = receiptWithOutcome.block.header.timestampNanosec;
  const blockHeight = receiptWithOutcome.block.header.height;
  const epochId = receiptWithOutcome.block.header.epochId;
  const outcome = receiptWithOutcome.outcome;
  const receiptHash = receiptWithOutcome.receipt.id.toBase58();
  const functionCall = action.toFunctionCall();
  const methodName = functionCall.methodName;

  if (
    methodName == "stake" ||
    methodName == "deposit_and_stake" ||
    methodName == "stake_all"
  ) {
    for (let logIndex = 0; logIndex < outcome.logs.length; logIndex++) {
      let outcomeLog = outcome.logs[logIndex].toString();
      if (outcomeLog.startsWith("EVENT_JSON:")) {
        outcomeLog = outcomeLog.replace("EVENT_JSON:", "");
        const jsonData = json.try_fromString(outcomeLog);
        const jsonObject = jsonData.value.toObject();
        const event = jsonObject.get("event")!;
        if (event.toString() == "stake") {
          const data = jsonObject.get("data")!;
          const dataArr = data.toArray();
          const dataObj = dataArr[0].toObject();
          const account = dataObj.get("account_id")!.toString();
          const stakeAmountStr = dataObj.get("staked_amount")!.toString();
          const mintedSharesStr = dataObj
            .get("minted_stake_shares")!
            .toString();
          const stakeAmount = BigInt.fromString(stakeAmountStr);
          const minted_shares = BigInt.fromString(mintedSharesStr);
          let user = Account.load(account);
          // update user
          if (!user) {
            let transferedIn: string[] = [];
            let transferedOut: string[] = [];
            log.info("create user {}", [account]);
            checkAndCreateUser(
              account,
              timeStamp.toString(),
              BigInt.fromU64(blockHeight),
              minted_shares,
              stakeAmount,
              BigInt.fromI32(0),
              BigInt.fromI32(0),
              transferedIn,
              transferedOut,
              BigInt.fromI32(0)
            );
          } else {
            log.info("update user {}", [account]);
            user.stakedNear += stakeAmount;
            user.mintedLinear += minted_shares;
            user.save();
          }
          // update price
          log.info("start handle {}", ["price"]);
          let price = new Price(blockHeight.toString());
          let minted_sharesFloat = BigDecimal.fromString(mintedSharesStr);
          let stakeAmountFloat = BigDecimal.fromString(stakeAmountStr);
          price.linearAmount = minted_sharesFloat;
          price.nearAmount = stakeAmountFloat;
          price.timeStamp = timeStamp.toString();
          price.price = stakeAmountFloat.div(minted_sharesFloat);
          price.save();
        }
      }
    }
  }
  if (methodName == "unstake") {
    for (let logIndex = 0; logIndex < outcome.logs.length; logIndex++) {
      let outcomeLog = outcome.logs[logIndex].toString();
      if (outcomeLog.startsWith("EVENT_JSON:")) {
        outcomeLog = outcomeLog.replace("EVENT_JSON:", "");
        const jsonData = json.try_fromString(outcomeLog);
        const jsonObject = jsonData.value.toObject();
        const event = jsonObject.get("event")!;
        if (event.toString() == "unstake") {
          log.info("start handle {}", ["unstake"]);
          const data = jsonObject.get("data")!;
          const dataArr = data.toArray();
          const dataObj = dataArr[0].toObject();
          const account = dataObj.get("account_id")!.toString();
          const unstakeAmountStr = dataObj.get("unstaked_amount")!.toString();
          const burnedSharesStr = dataObj.get("burnt_stake_shares")!.toString();
          const unstakeAmount = BigInt.fromString(unstakeAmountStr);
          const burnedShares = BigInt.fromString(burnedSharesStr);
          let user = Account.load(account)!;
          log.info("find {}", ["user"]);
          user.unstakeReceivedNear += unstakeAmount;
          user.unstakeLinear += burnedShares;
          user.save();
          // update price
          log.info("start handle {}", ["price"]);
          let price = new Price(blockHeight.toString());
          const burnedSharesFloat = BigDecimal.fromString(burnedSharesStr);
          const unstakeSharesFloat = BigDecimal.fromString(unstakeAmountStr);
          price.nearAmount = unstakeSharesFloat;
          price.linearAmount = burnedSharesFloat;
          price.timeStamp = timeStamp.toString();
          price.price = unstakeSharesFloat.div(burnedSharesFloat);
          price.save();
        }
      }
    }
  }
  if (methodName == "add_liquidity" || methodName == "remove_liquidity") {
    for (let logIndex = 0; logIndex < outcome.logs.length; logIndex++) {
      let outcomeLog = outcome.logs[logIndex].toString();
      if (outcomeLog.startsWith("EVENT_JSON:")) {
        outcomeLog = outcomeLog.replace("EVENT_JSON:", "");
        const jsonData = json.try_fromString(outcomeLog);
        const jsonObject = jsonData.value.toObject();
        const event = jsonObject.get("event")!;
        if (
          event.toString() == "add_liquidity" ||
          event.toString() == "remove_liquidity"
        ) {
          log.info("start handle {}", ["liquidity"]);
          const data = jsonObject.get("data")!;
          const dataArr = data.toArray();
          const dataObj = dataArr[0].toObject();
          const account = dataObj.get("account_id")!.toString();
          let user = Account.load(account);
          log.info("create {}", ["user"]);
          // update user
          if (!user) {
            checkAndCreateUser(
              account,
              timeStamp.toString(),
              BigInt.fromU64(blockHeight),
              BigInt.fromI32(0),
              BigInt.fromI32(0),
              BigInt.fromI32(0),
              BigInt.fromI32(0),
              [],
              [],
              BigInt.fromI32(0)
            );
          }
        }
      }
    }
  }
  if (methodName == "ft_transfer" || methodName == "ft_transfer_call") {
    for (let logIndex = 0; logIndex < outcome.logs.length; logIndex++) {
      let outcomeLog = outcome.logs[logIndex].toString();
      if (outcomeLog.startsWith("EVENT_JSON:")) {
        outcomeLog = outcomeLog.replace("EVENT_JSON:", "");
        let jsonData = json.try_fromString(outcomeLog);
        let jsonObject = jsonData.value.toObject();
        let event = jsonObject.get("event")!;
        log.info("get ft transer event {}", [event.toString()]);
        if (event.toString() == "ft_transfer") {
          log.info("start handle {}", ["ft transer"]);
          let data = jsonObject.get("data")!;
          let dataArr = data.toArray();
          let dataObj = dataArr[0].toObject();
          let fromAccount = dataObj.get("old_owner_id")!.toString();
          let toAccount = dataObj.get("new_owner_id")!.toString();
          let amount = dataObj.get("amount")!.toString();
          let amountInt = BigInt.fromString(amount);
          let fromUser = Account.load(fromAccount);
          let toUser = Account.load(toAccount);
          let transferedEvent = FtTransfer.load(receiptHash);
          if (transferedEvent) {
            log.error("internal error: {}", ["transfer event"]);
          } else {
            transferedEvent = new FtTransfer(receiptHash);
            transferedEvent.to = toAccount;
            transferedEvent.from = fromAccount;
            transferedEvent.amount = amountInt;
            transferedEvent.timeStamp = timeStamp.toString();
            transferedEvent.save();
          }
          if (fromUser) {
            let temp = fromUser.transferedOut!;
            temp.push(receiptHash);
            fromUser.transferedOut = temp;
            fromUser.save();
          } else {
            checkAndCreateUser(
              fromAccount,
              timeStamp.toString(),
              BigInt.fromU64(blockHeight),
              BigInt.fromU32(0),
              BigInt.fromU32(0),
              BigInt.fromU32(0),
              BigInt.fromU32(0),
              [],
              [receiptHash],
              BigInt.fromI32(0)
            );
          }
          if (toUser) {
            let temp = toUser.transferedIn!;
            temp.push(receiptHash);
            toUser.transferedIn = temp;
            toUser.save();
          } else {
            checkAndCreateUser(
              toAccount,
              timeStamp.toString(),
              BigInt.fromU64(blockHeight),
              BigInt.fromU32(0),
              BigInt.fromU32(0),
              BigInt.fromU32(0),
              BigInt.fromU32(0),
              [receiptHash],
              [],
              BigInt.fromI32(0)
            );
          }
        }
      }
    }
  }

  if (methodName == "instant_unstake") {
    for (let logIndex = 0; logIndex < outcome.logs.length; logIndex++) {
      let outcomeLog = outcome.logs[logIndex].toString();
      if (outcomeLog.startsWith("EVENT_JSON:")) {
        log.info("into {}", ["instant unstake"]);
        outcomeLog = outcomeLog.replace("EVENT_JSON:", "");
        let jsonData = json.try_fromString(outcomeLog);
        let jsonObject = jsonData.value.toObject();
        let event = jsonObject.get("event")!;
        log.info("get instant unstake {}", [event.toString()]);
        if (event.toString() == "instant_unstake") {
          log.info("start handle {}", ["instant unstake"]);
          let data = jsonObject.get("data")!;
          log.info("get instant unstake {}", ["data"]);
          let dataArr = data.toArray();
          let dataObj = dataArr[0].toObject();
          let account = dataObj.get("account_id")!.toString();
          log.info("get instant unstake {}", ["account"]);
          let unstakeAmountStr = dataObj.get("unstaked_amount")!.toString();
          log.info("get instant unstake {}", ["unstakeAmountStr"]);
          let unstakeLinearAmountStr = dataObj
            .get("swapped_stake_shares")!
            .toString();
          log.info("get instant unstake {}", ["unstakeLinearAmountStr"]);
          let unstakeAmount = BigInt.fromString(unstakeAmountStr);
          let unstakeLinearAmount = BigInt.fromString(unstakeLinearAmountStr);
          let feesPayedStr = dataObj.get("fee_amount")!.toString();
          log.info("get instant unstake {}", ["fee_amount"]);
          let feesPayed = BigInt.fromString(feesPayedStr);
          let user = Account.load(account)!;
          log.info("find {}", ["user"]);
          if (!user) {
            checkAndCreateUser(
              account,
              timeStamp.toString(),
              BigInt.fromU64(blockHeight),
              BigInt.fromU64(0),
              BigInt.fromU64(0),
              unstakeAmount,
              unstakeLinearAmount,
              [],
              [],
              BigInt.fromI32(0)
            );
          } else {
            user.unstakeReceivedNear += unstakeAmount;
            user.unstakeLinear += unstakeLinearAmount;
            user.feesPayed += feesPayed;
            user.save();
          }
        }

        if (event.toString() == "liquidity_pool_swap_fee") {
          log.info("into {}", ["liquidity_pool_swap_fee"]);
          if (!jsonObject) {
            log.info("jsonobject {}", ["null"]);
            return;
          }
          let data = jsonObject.get("data");
          if (!data) {
            log.info("data {}", ["null"]);
            return;
          }
          let dataArr = data.toArray();
          if (!dataArr) {
            log.info("dataArr {}", ["null"]);
            return;
          }
          let dataObj = dataArr[0].toObject();
          if (!dataObj) {
            log.info("dataObj {}", ["null"]);
            return;
          }
          let poolFeesObj = dataObj.get("pool_fee_stake_shares");
          if (!poolFeesObj) {
            log.info("poolFeesObj {}", ["null"]);
            return;
          }
          let lpFlag = LpApyFlag.load("flag".toString());
          if (lpFlag) {
            const lastLpFlag = lpFlag.lastApyId;
            const lastLpApy = LpApy.load(lastLpFlag.toString())!;
            lpFlag.lastApyId += 1;
            lpFlag.save();
            const lastFees = lastLpApy.feesPayed;

            const newLpApyId = lastLpFlag + 1;
            let newLpApy = new LpApy(newLpApyId.toString());
            newLpApy.timeStamp = timeStamp.toString();
            newLpApy.feesPayed =
              lastFees + BigInt.fromString(poolFeesObj.toString());
            newLpApy.save();
            log.info("finish to save {}", ["lp apy fee"]);
          } else {
            lpFlag = new LpApyFlag("flag".toString());
            lpFlag.lastApyId = 0;
            lpFlag.save();
            let newLpApy = new LpApy("0".toString());
            newLpApy.timeStamp = timeStamp.toString();
            newLpApy.feesPayed = BigInt.fromString(poolFeesObj.toString());
            newLpApy.save();
            log.info("finish to save {}", ["lp apy fee"]);
          }
        }
      }
    }
  }
}
