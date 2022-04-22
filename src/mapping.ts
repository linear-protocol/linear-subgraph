import { near, BigInt, log,json, TypedMap, JSONValue, Value, bigInt } from "@graphprotocol/graph-ts";
import { Price,Account,LpApy} from "../generated/schema";

export function handleReceipt(
  receipt: near.ReceiptWithOutcome
): void {
  const actions = receipt.receipt.actions;
  let sender_id = receipt.receipt.signerId.toString()
  let contract_id = receipt.receipt.predecessorId.toString()
  let receiver_id = receipt.receipt.receiverId.toString()
  log.info('sender contract receiver',[sender_id,contract_id,receiver_id])
  for (let i = 0; i < actions.length; i++) {
    handleAction(actions[i], receipt)
  }
}


function handleAction(
  action: near.ActionValue,
  receiptWithOutcome: near.ReceiptWithOutcome
): void {
  if (action.kind != near.ActionKind.FUNCTION_CALL) {
    return;
  }
  let timeStamp = receiptWithOutcome.block.header.timestampNanosec
  let blockHeight = receiptWithOutcome.block.header.height
  let epochId = receiptWithOutcome.block.header.epochId
  const outcome = receiptWithOutcome.outcome;
  const functionCall = action.toFunctionCall()
  const methodName = functionCall.methodName
  
  if (methodName == 'stake' || methodName == 'deposit_and_stake' || methodName == 'stake_all' ) {
    for (let logIndex = 0; logIndex < outcome.logs.length; logIndex++) {
      let outcomeLog = outcome.logs[logIndex].toString();
      if (outcomeLog.includes('EVENT_JSON:')){
        log.info('start ',['stake'])
        outcomeLog = outcomeLog.replace('EVENT_JSON:','')
        const jsonData = json.try_fromString(outcomeLog)
        const jsonObject = jsonData.value.toObject()
        const event = jsonObject.get('event')!
        if (event.toString() == "stake"){
          const data = jsonObject.get('data')!
          const dataObj = data.toObject()
          const account = dataObj.get('account_id')!.toString()
          const stakeAmount = dataObj.get('staked_amount')!.toU64()
          const minted_shares = dataObj.get('minted_stake_shares')!.toU64()
          let user = Account.load(account)
          log.info('create ',['user'])
          // update user
          if (!user){
            user = new Account(account)
            user.StartTime = timeStamp.toString()
            user.height = BigInt.fromU64(blockHeight)
            user.MintedLinear = BigInt.fromU64(minted_shares)
            user.StakedNEAR = BigInt.fromU64(stakeAmount)
            user.UnstakeGetNear = BigInt.fromU64(0)
            user.UnstakeLinear = BigInt.fromU64(0)
            user.FeesPayed = BigInt.fromU64(0)
            user.Earned1 = BigInt.fromU64(0)
            user.Earned2 = BigInt.fromU64(0)
            user.save()
          }else {
            user.StakedNEAR = user.StakedNEAR + BigInt.fromU64(stakeAmount)
            user.MintedLinear = user.MintedLinear + BigInt.fromU64(minted_shares)
          }
          // update price
          let price = new Price(blockHeight.toString())
          price.price = BigInt.fromU64(stakeAmount) / BigInt.fromU64(minted_shares)
          log.info('price ',[price.price.toString()])
          price.timeStamp = timeStamp.toString()
          price.save()
        }
      }
    }   
  }
  if (methodName == 'unstake' ) {
    for (let logIndex = 0; logIndex < outcome.logs.length; logIndex++) {
      let outcomeLog = outcome.logs[logIndex].toString();
      if (outcomeLog.includes('EVENT_JSON:')){
        log.info('start ',['unstake'])
        outcomeLog = outcomeLog.replace('EVENT_JSON:','')
        const jsonData = json.try_fromString(outcomeLog)
        const jsonObject = jsonData.value.toObject()
        const event = jsonObject.get('event')!
        if (event.toString() == "unstake"){
          const data = jsonObject.get('data')!
          const dataObj = data.toObject()
          const account = dataObj.get('account_id')!.toString()
          const unstakeAmount = dataObj.get('"unstaked_amount')!.toU64()
          const burnedShares = dataObj.get('burnt_stake_shares')!.toU64()
          let user = Account.load(account)!
          log.info('find ',['user'])
          user.UnstakeGetNear += BigInt.fromU64(unstakeAmount)
          user.UnstakeLinear += BigInt.fromU64(burnedShares)
          user.save()
          // update price
          let price = new Price(blockHeight.toString())
          price.price = BigInt.fromU64(unstakeAmount) / BigInt.fromU64(burnedShares)
          log.info('price ',[price.price.toString()])
          price.timeStamp = timeStamp.toString()
          price.save()
        }
      }
    }
  }
  if (methodName == 'add_liquidity' || methodName == 'remove_liquidity' ) {
    for (let logIndex = 0; logIndex < outcome.logs.length; logIndex++) {
      let outcomeLog = outcome.logs[logIndex].toString();
      if (outcomeLog.includes('EVENT_JSON:')){
        log.info('start ',['liquidity'])
        outcomeLog = outcomeLog.replace('EVENT_JSON:','')
        const jsonData = json.try_fromString(outcomeLog)
        const jsonObject = jsonData.value.toObject()
        const event = jsonObject.get('event')!
        if (event.toString() == "add_liquidity" || event.toString() == "remove_liquidity" ){
          const data = jsonObject.get('data')!
          const dataObj = data.toObject()
          const account = dataObj.get('account_id')!.toString()
          let user = Account.load(account)
          log.info('create ',['user'])
          // update user
          if (!user){
            user = new Account(account)
            user.StartTime = timeStamp.toString()
            user.height = BigInt.fromU64(blockHeight)
            user.MintedLinear = BigInt.fromU64(0)
            user.StakedNEAR = BigInt.fromU64(0)
            user.UnstakeGetNear = BigInt.fromU64(0)
            user.UnstakeLinear = BigInt.fromU64(0)
            user.FeesPayed = BigInt.fromU64(0)
            user.Earned1 = BigInt.fromU64(0)
            user.Earned2 = BigInt.fromU64(0)
            user.save()
          }
        }
      }
    }
  }


// EVENT_JSON:{"standard":"linear","version":"1.0.0","event":"liquidity_pool_swap_fee","data":[{"account_id":"dravte.testnet","stake_shares_in":"19735500000000000000000000","requested_amount":"20000003738785215223896334","received_amount":"19402003626995537288701834","fee_amount":"598000111789677935194500","fee_stake_shares":"590091449999999999999999","treasury_fee_stake_shares":"177027434999999999999999","pool_fee_stake_shares":"413064015000000000000000","total_fee_shares":"3831354640400000000000000"}]}
// EVENT_JSON:{"standard":"linear","version":"1.0.0","event":"instant_unstake","data":[{"account_id":"dravte.testnet","unstaked_amount":"19402003626995537288701834","swapped_stake_shares":"19735500000000000000000000","new_unstaked_balance":"2","new_stake_shares":"3400378077868412936","fee_amount":"598000111789677935194500"}]}
// EVENT_JSON:{"standard":"nep141","version":"1.0.0","event":"ft_transfer","data":[{"old_owner_id":"dravte.testnet","new_owner_id":"treasury.linear-protocol.testnet","amount":"177027434999999999999999","memo":"instant unstake treasury fee"},{"old_owner_id":"dravte.testnet","new_owner_id":"linear-protocol.testnet","amount":"19558472565000000000000001","memo":"instant unstake swapped into pool"}]}
  if (methodName == 'instant_unstake' ) {
    for (let logIndex = 0; logIndex < outcome.logs.length; logIndex++) {
      let outcomeLog = outcome.logs[logIndex].toString();
      if (outcomeLog.includes('EVENT_JSON:')){
        log.info('start ',['instant unstake'])
        outcomeLog = outcomeLog.replace('EVENT_JSON:','')
        const jsonData = json.try_fromString(outcomeLog)
        const jsonObject = jsonData.value.toObject()
        const event = jsonObject.get('event')!
        if (event.toString() == "instant_unstake"){
          const data = jsonObject.get('data')!
          const dataObj = data.toObject()
          const account = dataObj.get('account_id')!.toString()
          const unstakeAmount = dataObj.get('"unstaked_amount')!.toU64()
          const unstakeLinearAmount = dataObj.get('swapped_stake_shares')!.toU64()
          const feesPayed = dataObj.get('fee_amount')!.toU64()
          let user = Account.load(account)!
          log.info('find ',['user'])
          user.UnstakeGetNear += BigInt.fromU64(unstakeAmount)
          user.UnstakeLinear += BigInt.fromU64(unstakeLinearAmount)
          user.FeesPayed += BigInt.fromU64(feesPayed)
          user.save()
        }

        if (event.toString() == "liquidity_pool_swap_fee") {
          const data = jsonObject.get('data')!
          const dataObj = data.toObject()
          const poolFees = dataObj.get('"total_fee_shares')!.toU64()
          log.info('create ',['lpapy'])
          let lpapy = new LpApy(blockHeight.toString())
          lpapy.feesPayed = BigInt.fromU64(poolFees)
          lpapy.timeStamp = timeStamp.toString()
          lpapy.save()
        }
      }
    }
  }
}