import {
  near,
  BigInt,
  log,
  json,
  BigDecimal,
} from "@graphprotocol/graph-ts";
import {
  Price,
  Account,
  FtTransfer,
  TotalSwapFee,
  Version
} from "../../generated/schema";

export function handleReceipt(receipt: near.ReceiptWithOutcome): void {
  const actions = receipt.receipt.actions;
  for (let i = 0; i < actions.length; i++) {
    handleAction(actions[i], receipt);
  }
}

function createAccount(
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
  log.info("create account {}", [id]);
  let account = new Account(id);
  account.startTime = startTime;
  account.height = height;
  account.mintedLinear = mintedLinear;
  account.stakedNear = stakedNear;
  account.unstakeReceivedNear = unstakeReceivedNear;
  account.unstakeLinear = unstakeLinear;
  account.transferedIn = transferedIn;
  account.transferedOut = transferedOut;
  account.feesPayed = feesPayed;
  account.save();
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
          // parse event
          const data = jsonObject.get("data")!;
          const dataArr = data.toArray();
          const dataObj = dataArr[0].toObject();
          const accountId = dataObj.get("account_id")!.toString();
          const stakeAmountStr = dataObj.get("staked_amount")!.toString();
          const mintedSharesStr = dataObj
            .get("minted_stake_shares")!
            .toString();
          const stakeAmount = BigInt.fromString(stakeAmountStr);
          const minted_shares = BigInt.fromString(mintedSharesStr);

          // update account
          let account = Account.load(accountId);
          if (!account) {
            let transferedIn: string[] = [];
            let transferedOut: string[] = [];
            createAccount(
              accountId,
              timeStamp.toString(),
              BigInt.fromU64(blockHeight),
              minted_shares,
              stakeAmount,
              BigInt.zero(),
              BigInt.zero(),
              transferedIn,
              transferedOut,
              BigInt.zero()
            );
          } else {
            log.info("update account {}", [accountId]);
            account.stakedNear += stakeAmount;
            account.mintedLinear += minted_shares;
            account.save();
          }

          // update price
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
  } else if (methodName == "unstake") {
    for (let logIndex = 0; logIndex < outcome.logs.length; logIndex++) {
      let outcomeLog = outcome.logs[logIndex].toString();
      if (outcomeLog.startsWith("EVENT_JSON:")) {
        outcomeLog = outcomeLog.replace("EVENT_JSON:", "");
        const jsonData = json.try_fromString(outcomeLog);
        const jsonObject = jsonData.value.toObject();
        const event = jsonObject.get("event")!;

        if (event.toString() == "unstake") {
          // parse event
          const data = jsonObject.get("data")!;
          const dataArr = data.toArray();
          const dataObj = dataArr[0].toObject();
          const accountId = dataObj.get("account_id")!.toString();
          const unstakeAmountStr = dataObj.get("unstaked_amount")!.toString();
          const burnedSharesStr = dataObj.get("burnt_stake_shares")!.toString();
          const unstakeAmount = BigInt.fromString(unstakeAmountStr);
          const burnedShares = BigInt.fromString(burnedSharesStr);

          // update account
          let account = Account.load(accountId)!;
          account.unstakeReceivedNear += unstakeAmount;
          account.unstakeLinear += burnedShares;
          account.save();

          // update price
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
  } else if (methodName == "add_liquidity" || methodName == "remove_liquidity") {
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
          // parse event
          const data = jsonObject.get("data")!;
          const dataArr = data.toArray();
          const dataObj = dataArr[0].toObject();
          const accountId = dataObj.get("account_id")!.toString();
          let account = Account.load(accountId);

          // update account
          if (!account) {
            createAccount(
              accountId,
              timeStamp.toString(),
              BigInt.fromU64(blockHeight),
              BigInt.zero(),
              BigInt.zero(),
              BigInt.zero(),
              BigInt.zero(),
              [],
              [],
              BigInt.zero()
            );
          }
        } else if (event.toString() == "ft_transfer") {
          // parse event
          let data = jsonObject.get("data")!;
          let dataArr = data.toArray();
          let dataObj = dataArr[0].toObject();
          let oldOwnerId = dataObj.get("old_owner_id")!.toString();
          let newOwnerId = dataObj.get("new_owner_id")!.toString();
          let amount = dataObj.get("amount")!.toString();
          let amountInt = BigInt.fromString(amount);

          // update FT Transfer event
          let transferedEvent = FtTransfer.load(receiptHash);
          if (transferedEvent) {
            log.error("internal error: {}", ["transfer event"]);
          } else {
            transferedEvent = new FtTransfer(receiptHash);
            transferedEvent.to = newOwnerId;
            transferedEvent.from = oldOwnerId;
            transferedEvent.amount = amountInt;
            transferedEvent.timeStamp = timeStamp.toString();
            transferedEvent.save();
          }

          // update from account
          let fromAccount = Account.load(oldOwnerId);
          if (fromAccount) {
            let temp = fromAccount.transferedOut!;
            temp.push(receiptHash);
            fromAccount.transferedOut = temp;
            fromAccount.save();
          } else {
            createAccount(
              oldOwnerId,
              timeStamp.toString(),
              BigInt.fromU64(blockHeight),
              BigInt.zero(),
              BigInt.zero(),
              BigInt.zero(),
              BigInt.zero(),
              [],
              [receiptHash],
              BigInt.zero()
            );
          }

          // update to account
          let toAccount = Account.load(newOwnerId);
          if (toAccount) {
            let temp = toAccount.transferedIn!;
            temp.push(receiptHash);
            toAccount.transferedIn = temp;
            toAccount.save();
          } else {
            createAccount(
              newOwnerId,
              timeStamp.toString(),
              BigInt.fromU64(blockHeight),
              BigInt.zero(),
              BigInt.zero(),
              BigInt.zero(),
              BigInt.zero(),
              [receiptHash],
              [],
              BigInt.zero()
            );
          }
        }
      }
    }
  } else if (methodName == "ft_transfer" || methodName == "ft_transfer_call") {
    for (let logIndex = 0; logIndex < outcome.logs.length; logIndex++) {
      let outcomeLog = outcome.logs[logIndex].toString();
      if (outcomeLog.startsWith("EVENT_JSON:")) {
        outcomeLog = outcomeLog.replace("EVENT_JSON:", "");
        let jsonData = json.try_fromString(outcomeLog);
        let jsonObject = jsonData.value.toObject();
        let event = jsonObject.get("event")!;
        log.info("get ft transfer event {}", [event.toString()]);

        if (event.toString() == "ft_transfer") {
          // parse event
          let data = jsonObject.get("data")!;
          let dataArr = data.toArray();
          let dataObj = dataArr[0].toObject();
          let oldOwnerId = dataObj.get("old_owner_id")!.toString();
          let newOwnerId = dataObj.get("new_owner_id")!.toString();
          let amount = dataObj.get("amount")!.toString();
          let amountInt = BigInt.fromString(amount);

          // update FT transfer event
          let transferedEvent = FtTransfer.load(receiptHash);
          if (transferedEvent) {
            log.error("internal error: {}", ["transfer event"]);
          } else {
            transferedEvent = new FtTransfer(receiptHash);
            transferedEvent.to = newOwnerId;
            transferedEvent.from = oldOwnerId;
            transferedEvent.amount = amountInt;
            transferedEvent.timeStamp = timeStamp.toString();
            transferedEvent.save();
          }

          // update from account
          let fromAccount = Account.load(oldOwnerId);
          if (fromAccount) {
            let temp = fromAccount.transferedOut!;
            temp.push(receiptHash);
            fromAccount.transferedOut = temp;
            fromAccount.save();
          } else {
            createAccount(
              oldOwnerId,
              timeStamp.toString(),
              BigInt.fromU64(blockHeight),
              BigInt.zero(),
              BigInt.zero(),
              BigInt.zero(),
              BigInt.zero(),
              [],
              [receiptHash],
              BigInt.zero()
            );
          }

          // update to account
          let toAccount = Account.load(newOwnerId);
          if (toAccount) {
            let temp = toAccount.transferedIn!;
            temp.push(receiptHash);
            toAccount.transferedIn = temp;
            toAccount.save();
          } else {
            createAccount(
              newOwnerId,
              timeStamp.toString(),
              BigInt.fromU64(blockHeight),
              BigInt.zero(),
              BigInt.zero(),
              BigInt.zero(),
              BigInt.zero(),
              [receiptHash],
              [],
              BigInt.zero()
            );
          }
        }
      }
    }
  } else if (methodName == "instant_unstake") {
    for (let logIndex = 0; logIndex < outcome.logs.length; logIndex++) {
      let outcomeLog = outcome.logs[logIndex].toString();
      if (outcomeLog.startsWith("EVENT_JSON:")) {
        outcomeLog = outcomeLog.replace("EVENT_JSON:", "");
        let jsonData = json.try_fromString(outcomeLog);
        let jsonObject = jsonData.value.toObject();
        let event = jsonObject.get("event")!;

        if (event.toString() == "instant_unstake") {
          // parse event
          let data = jsonObject.get("data")!;
          let dataArr = data.toArray();
          let dataObj = dataArr[0].toObject();
          let accountId = dataObj.get("account_id")!.toString();
          let unstakeAmountStr = dataObj.get("unstaked_amount")!.toString();
          let unstakeLinearAmountStr = dataObj
            .get("swapped_stake_shares")!
            .toString();
          let unstakeAmount = BigInt.fromString(unstakeAmountStr);
          let unstakeLinearAmount = BigInt.fromString(unstakeLinearAmountStr);
          let feesPayedStr = dataObj.get("fee_amount")!.toString();
          let feesPayed = BigInt.fromString(feesPayedStr);

          // update account
          let account = Account.load(accountId)!;
          if (!account) {
            createAccount(
              accountId,
              timeStamp.toString(),
              BigInt.fromU64(blockHeight),
              BigInt.zero(),
              BigInt.zero(),
              unstakeAmount,
              unstakeLinearAmount,
              [],
              [],
              BigInt.zero()
            );
          } else {
            account.unstakeReceivedNear += unstakeAmount;
            account.unstakeLinear += unstakeLinearAmount;
            account.feesPayed += feesPayed;
            account.save();
          }
        } else if (event.toString() == "liquidity_pool_swap_fee") {
          // parse event
          let data = jsonObject.get("data")!;
          let dataArr = data.toArray();
          let dataObj = dataArr[0].toObject();
          let poolFeesObj = dataObj.get("pool_fee_stake_shares")!;

          // update total swap fee
          let version = Version.load("latest".toString());
          if (version) {
            // increment version
            const lastVersion = version.version;
            const lastTotalFee = TotalSwapFee.load(lastVersion.toString())!;
            version.version += 1;
            version.save();
            const lastFees = lastTotalFee.feesPayed;

            // save latest total fees
            const newVersion = lastVersion + 1;
            let newTotalFee = new TotalSwapFee(newVersion.toString());
            newTotalFee.timeStamp = timeStamp.toString();
            newTotalFee.feesPayed =
              lastFees + BigInt.fromString(poolFeesObj.toString());
            newTotalFee.save();
          } else {
            // save version
            version = new Version("latest".toString());
            version.version = 0;
            version.save();

            // save initial total fees
            let newTotalFee = new TotalSwapFee("0".toString());
            newTotalFee.timeStamp = timeStamp.toString();
            newTotalFee.feesPayed = BigInt.fromString(poolFeesObj.toString());
            newTotalFee.save();
          }
        }
      }
    }
  }
}
