import { near, BigInt, log,json, TypedMap, JSONValue, Value, bigInt, BigDecimal, bigDecimal  } from "@graphprotocol/graph-ts";
import { Price,Account,LpApy,LpApyFlag} from "../generated/schema";


export function handleReceipt(
  receipt: near.ReceiptWithOutcome
): void {
  const actions = receipt.receipt.actions;
  const sender_id = receipt.receipt.signerId.toString()
  const contract_id = receipt.receipt.predecessorId.toString()
  const receiver_id = receipt.receipt.receiverId.toString()
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
  const timeStamp = receiptWithOutcome.block.header.timestampNanosec
  const blockHeight = receiptWithOutcome.block.header.height
  const epochId = receiptWithOutcome.block.header.epochId
  const outcome = receiptWithOutcome.outcome;
  const functionCall = action.toFunctionCall()
  const methodName = functionCall.methodName
  if (methodName == 'deposit') {
    for (let logIndex = 0; logIndex < outcome.logs.length; logIndex++) {
      let outcomeLog = outcome.logs[logIndex].toString();
      if (outcomeLog.includes('EVENT_JSON:')){
        outcomeLog = outcomeLog.replace('EVENT_JSON:','')
        const jsonData = json.try_fromString(outcomeLog)
        const jsonObject = jsonData.value.toObject()
        const event = jsonObject.get('event')!
        if (event.toString() == "deposit"){
          const data = jsonObject.get('data')!
          const dataArr = data.toArray()!
          
          const dataObj = dataArr[0]!.toObject()
          const depositAccount = dataObj.get('account_id')!.toString()
          const depoositAmount = dataObj.get('amount')!.toString()
          const unstakedBalance = dataObj.get('new_unstaked_balance')!.toString()
          let user = Account.load(depositAccount)
          if (user) {
            user.UnstakeBalance = BigInt.fromString(unstakedBalance)
            user.DepositedNEAR += BigInt.fromString(depoositAmount)
            user.save()
          }else{
            log.info('create user {}',[depositAccount])
            user = new Account(depositAccount)
            user.StartTime = timeStamp.toString()
            user.height = BigInt.fromU64(blockHeight)
            user.MintedLinear = BigInt.fromU64(0)
            user.StakedNEAR = BigInt.fromU64(0)
            user.DepositedNEAR += BigInt.fromString(depoositAmount)
            user.UnstakeBalance = BigInt.fromString(unstakedBalance)
            user.UnstakeGetNear = BigInt.fromU64(0)
            user.LinearBalance  = BigInt.fromU64(0)
            user.UnstakeLinear = BigInt.fromU64(0)
            user.FeesPayed = BigInt.fromU64(0)
            user.WithDrawedNEAR = BigInt.fromU64(0)
            user.TransferedIn = BigInt.fromU64(0)
            user.TransferedOut = BigInt.fromU64(0)
            user.Earned1 = BigInt.fromU64(0)
            user.Earned2 = BigInt.fromU64(0)
            user.save()
          }
        }
      }
    }
  }
  if (methodName == 'stake' || methodName == 'deposit_and_stake' || methodName == 'stake_all' ) {
    for (let logIndex = 0; logIndex < outcome.logs.length; logIndex++) {
      
      let outcomeLog = outcome.logs[logIndex].toString();
      if (outcomeLog.includes('EVENT_JSON:')){
        outcomeLog = outcomeLog.replace('EVENT_JSON:','')
        const jsonData = json.try_fromString(outcomeLog)
        const jsonObject = jsonData.value.toObject()
        const event = jsonObject.get('event')!
        
        if (event.toString() == "stake"){
          const data = jsonObject.get('data')!
          const dataArr = data.toArray()!
          const dataObj = dataArr[0]!.toObject()
          const account = dataObj.get('account_id')!.toString()
          const stakeAmountStr = dataObj.get('staked_amount')!.toString()
          const mintedSharesStr = dataObj.get('minted_stake_shares')!.toString()
          const stakeAmount = BigInt.fromString(stakeAmountStr)
          const minted_shares = BigInt.fromString(mintedSharesStr)
          let user = Account.load(account)
  
          // update user
          if (!user){
            log.info('create user {}',[account])
            user = new Account(account)
            user.StartTime = timeStamp.toString()
            user.height = BigInt.fromU64(blockHeight)
            user.MintedLinear = minted_shares
            user.StakedNEAR = stakeAmount
            user.UnstakeGetNear = BigInt.fromU64(0)
            user.UnstakeLinear = BigInt.fromU64(0)
            user.FeesPayed = BigInt.fromU64(0)
            user.Earned1 = BigInt.fromU64(0)
            user.Earned2 = BigInt.fromU64(0)
            user.LinearBalance = minted_shares
            user.TransferedOut = BigInt.fromU64(0)
            user.TransferedIn = BigInt.fromU64(0)
            user.DepositedNEAR = stakeAmount
            user.UnstakeBalance = BigInt.fromU64(0)
            user.WithDrawedNEAR = BigInt.fromU64(0)
            user.save()
          }else {
            log.info('update user {}',[account])
            user.StakedNEAR += stakeAmount
            user.MintedLinear += minted_shares
            user.LinearBalance += minted_shares
            user.DepositedNEAR += stakeAmount
            user.save()
          }
          // update price
          log.info('start handle {}',['price'])
          let price = new Price(blockHeight.toString())
          let minted_sharesFloat = BigDecimal.fromString(mintedSharesStr)
          let stakeAmountFloat = BigDecimal.fromString(stakeAmountStr)
          price.LinearNum =  minted_sharesFloat
          price.NEARNum = stakeAmountFloat
          price.timeStamp = timeStamp.toString()
          price.price = stakeAmountFloat.div(minted_sharesFloat)
          price.save()
        }

      }
    }   
  }
  if (methodName == 'unstake' ) {
    for (let logIndex = 0; logIndex < outcome.logs.length; logIndex++) {
      let outcomeLog = outcome.logs[logIndex].toString();
      if (outcomeLog.includes('EVENT_JSON:')){
        outcomeLog = outcomeLog.replace('EVENT_JSON:','')
        const jsonData = json.try_fromString(outcomeLog)
        const jsonObject = jsonData.value.toObject()
        const event = jsonObject.get('event')!
        if (event.toString() == "unstake"){
          log.info('start handle {}',['unstake'])
          const data = jsonObject.get('data')!
          const dataArr = data.toArray()!
          const dataObj = dataArr[0]!.toObject()
          const account = dataObj.get('account_id')!.toString()
          const unstakeAmountStr = dataObj.get('unstaked_amount')!.toString()
          const burnedSharesStr = dataObj.get('burnt_stake_shares')!.toString()
          const unstakeAmount = BigInt.fromString(unstakeAmountStr)
          const burnedShares = BigInt.fromString(burnedSharesStr)
          let user = Account.load(account)!
          log.info('find {}',['user'])
          user.UnstakeGetNear += unstakeAmount
          user.UnstakeLinear += burnedShares
          user.save()
          // update price
          log.info('start handle {}',['price'])
          let price = new Price(blockHeight.toString())
          let burnedSharesFloat = BigDecimal.fromString(burnedSharesStr)
          let unstakeSharesFloat = BigDecimal.fromString(unstakeAmountStr)
          price.NEARNum = unstakeSharesFloat
          price.LinearNum = burnedSharesFloat
          price.timeStamp = timeStamp.toString()
          price.price =  unstakeSharesFloat.div(burnedSharesFloat)
          price.save()
        }
      }
    }
  }
  if (methodName == 'add_liquidity' || methodName == 'remove_liquidity' ) {
    for (let logIndex = 0; logIndex < outcome.logs.length; logIndex++) {
      let outcomeLog = outcome.logs[logIndex].toString();
      if (outcomeLog.includes('EVENT_JSON:')){

        outcomeLog = outcomeLog.replace('EVENT_JSON:','')
        const jsonData = json.try_fromString(outcomeLog)
        const jsonObject = jsonData.value.toObject()
        const event = jsonObject.get('event')!
        if (event.toString() == "add_liquidity" || event.toString() == "remove_liquidity" ){
          log.info('start handle {}',['liquidity'])
          const data = jsonObject.get('data')!
          const dataArr = data.toArray()!
          const dataObj = dataArr[0]!.toObject()
          const account = dataObj.get('account_id')!.toString()
          let user = Account.load(account)
          log.info('create {}',['user'])
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
            user.DepositedNEAR = BigInt.fromU64(0)
            user.LinearBalance = BigInt.fromU64(0)
            user.TransferedIn = BigInt.fromU64(0)
            user.TransferedOut = BigInt.fromU64(0)
            user.UnstakeBalance = BigInt.fromU64(0)
            user.WithDrawedNEAR = BigInt.fromU64(0)
            user.save()
          }
        }
      }
    }
  }
  if (methodName == 'ft_transfer' || methodName == 'ft_transfer_call') {
    for (let logIndex = 0; logIndex < outcome.logs.length; logIndex++) {
      let outcomeLog = outcome.logs[logIndex].toString()
      if (outcomeLog.includes('EVENT_JSON:')){
        outcomeLog = outcomeLog.replace('EVENT_JSON:','')
        let jsonData = json.try_fromString(outcomeLog)
        let jsonObject = jsonData.value.toObject()
        let event = jsonObject.get('event')!
        log.info('get ft transer event {}',[event.toString()])
        if (event.toString() == "ft_transfer"){
          log.info('start handle {}',['ft transer'])
          let data = jsonObject.get('data')!
          let dataArr = data.toArray()!
          let dataObj = dataArr[0]!.toObject()
          let fromAccount = dataObj.get('old_owner_id')!.toString()
          let toAccount = dataObj.get('new_owner_id')!.toString()
          let amount = dataObj.get('amount')!.toString()
          let amountInt = BigInt.fromString(amount)
          let fromUser = Account.load(fromAccount)
          let toUser = Account.load(toAccount)
          if (fromUser){
            fromUser.TransferedOut += amountInt
            fromUser.save()
          }else{
            fromUser = new Account(fromAccount)
            fromUser.StartTime = timeStamp.toString()
            fromUser.height = BigInt.fromU64(blockHeight)
            fromUser.MintedLinear = BigInt.fromU32(0)
            fromUser.StakedNEAR = BigInt.fromU32(0)
            fromUser.UnstakeGetNear = BigInt.fromU64(0)
            fromUser.UnstakeLinear = BigInt.fromU64(0)
            fromUser.FeesPayed = BigInt.fromU64(0)
            fromUser.Earned1 = BigInt.fromU64(0)
            fromUser.Earned2 = BigInt.fromU64(0)
            fromUser.LinearBalance = BigInt.fromU64(0)
            fromUser.TransferedOut = amountInt
            fromUser.TransferedIn = BigInt.fromU64(0)
            fromUser.DepositedNEAR = BigInt.fromU64(0)
            fromUser.UnstakeBalance = BigInt.fromU64(0)
            fromUser.WithDrawedNEAR = BigInt.fromU64(0)
            fromUser.save()
          }
          if (toUser){
            toUser.TransferedIn += amountInt
            toUser.save()
          }else{
            toUser = new Account(toAccount)
            toUser.StartTime = timeStamp.toString()
            toUser.height = BigInt.fromU64(blockHeight)
            toUser.MintedLinear = BigInt.fromU32(0)
            toUser.StakedNEAR = BigInt.fromU32(0)
            toUser.UnstakeGetNear = BigInt.fromU64(0)
            toUser.UnstakeLinear = BigInt.fromU64(0)
            toUser.FeesPayed = BigInt.fromU64(0)
            toUser.Earned1 = BigInt.fromU64(0)
            toUser.Earned2 = BigInt.fromU64(0)
            toUser.LinearBalance = BigInt.fromU64(0)
            toUser.TransferedOut = BigInt.fromU64(0)
            toUser.TransferedIn = amountInt
            toUser.DepositedNEAR = BigInt.fromU64(0)
            toUser.UnstakeBalance = BigInt.fromU64(0)
            toUser.WithDrawedNEAR = BigInt.fromU64(0)
            toUser.save()
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
      let outcomeLog = outcome.logs[logIndex].toString()
      if (outcomeLog.includes('EVENT_JSON:')){
        log.info('into {}',['instant unstake'])
        outcomeLog = outcomeLog.replace('EVENT_JSON:','')
        let jsonData = json.try_fromString(outcomeLog)
        let jsonObject = jsonData.value.toObject()
        let event = jsonObject.get('event')!
        log.info('get instant unstake {}',[event.toString()])
        if (event.toString() == "instant_unstake"){
          log.info('start handle {}',['instant unstake'])
          let data = jsonObject.get('data')!
          log.info('get instant unstake {}',['data'])
          let dataArr = data.toArray()!
          let dataObj = dataArr[0]!.toObject()
          let account = dataObj.get('account_id')!.toString()
          log.info('get instant unstake {}',['account'])
          let unstakeAmountStr = dataObj.get('unstaked_amount')!.toString()
          log.info('get instant unstake {}',['unstakeAmountStr'])
          let unstakeLinearAmountStr = dataObj.get('swapped_stake_shares')!.toString()
          log.info('get instant unstake {}',['unstakeLinearAmountStr'])
          let unstakeAmount = BigInt.fromString(unstakeAmountStr)
          let unstakeLinearAmount = BigInt.fromString(unstakeLinearAmountStr)
          let feesPayedStr = dataObj.get('fee_amount')!.toString()
          log.info('get instant unstake {}',['fee_amount'])
          let feesPayed = BigInt.fromString(feesPayedStr)
          let user = Account.load(account)!
          log.info('find {}',['user'])
          if (!user) {
            user = new Account(account)
            user.StartTime = timeStamp.toString()
            user.height = BigInt.fromU64(blockHeight)
            user.MintedLinear = BigInt.fromU64(0)
            user.StakedNEAR = BigInt.fromU64(0)
            user.UnstakeGetNear = unstakeAmount
            user.UnstakeLinear = unstakeLinearAmount
            user.FeesPayed = feesPayed
            user.Earned1 = BigInt.fromU64(0)
            user.Earned2 = BigInt.fromU64(0)
            user.TransferedOut = BigInt.fromU64(0)
            user.TransferedIn = BigInt.fromU64(0)
            user.WithDrawedNEAR = BigInt.fromU64(0)
            user.UnstakeBalance = BigInt.fromU64(0)
            user.LinearBalance = BigInt.fromU64(0)
            user.DepositedNEAR = BigInt.fromU64(0)
            user.save()
          }else{
            user.UnstakeGetNear +=  unstakeAmount
            user.UnstakeLinear += unstakeLinearAmount
            user.FeesPayed += feesPayed
            user.save()
          }
        }

        if (event.toString() == "liquidity_pool_swap_fee") {
          log.info('into {}',['liquidity_pool_swap_fee'])
          if (!jsonObject) {
            log.info('jsonobject {}',['null'])
            return
          }
          let data = jsonObject.get('data')
          if (!data) {
            log.info('data {}',['null'])
            return
          }
          let dataArr = data.toArray()
          if (!dataArr) {
            log.info('dataArr {}',['null'])
            return
          }
          let dataObj = dataArr[0].toObject()
          if (!dataObj) {
            log.info('dataObj {}',['null'])
            return
          }
          let poolFeesObj = dataObj.get('pool_fee_stake_shares')
          if (!poolFeesObj) {
            log.info('poolFeesObj {}',['null'])
            return
          }
          let lpFlag = LpApyFlag.load("flag".toString()) 
          if (lpFlag) {
            const lastLpFlag = lpFlag.LastApyId
            const lastLpApy = LpApy.load(lastLpFlag.toString())!
            lpFlag.LastApyId += 1
            lpFlag.save() 
            const lastFees = lastLpApy.feesPayed

            const newLpApyId = lastLpFlag + 1
            let newLpApy = new LpApy(newLpApyId.toString())
            newLpApy.timeStamp = timeStamp.toString()
            newLpApy.feesPayed = lastFees + BigInt.fromString(poolFeesObj.toString())
            newLpApy.save()
            log.info('finish to save {}',["lp apy fee"])
          }else {
            lpFlag  = new LpApyFlag("flag".toString())
            lpFlag.LastApyId = 0
            lpFlag.save()
            let newLpApy = new LpApy("0".toString())
            newLpApy.timeStamp = timeStamp.toString()
            newLpApy.feesPayed =  BigInt.fromString(poolFeesObj.toString())
            newLpApy.save()
            log.info('finish to save {}',["lp apy fee"])
          }
          
        }
      }
    }
  }
}