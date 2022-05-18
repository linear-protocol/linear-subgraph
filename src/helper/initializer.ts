
import { BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";
import { Price, PriceVersion, User } from "../../generated/schema";

export function getOrInitUser(accountId: string): User {
    let user = User.load(accountId);
    if (!user) {
        log.info("create user {}", [accountId]);
        user = new User(accountId);
        user.firstStakingTime = BigInt.zero();
        user.mintedLinear = BigInt.zero();
        user.stakedNear = BigInt.zero();
        user.unstakeReceivedNear = BigInt.zero();
        user.unstakedLinear = BigInt.zero();
        user.transferedIn = [];
        user.transferedOut = [];
        user.transferedInShares = BigInt.zero();
        user.transferedOutShares = BigInt.zero();
        user.transferedOutValue = BigDecimal.zero();
        user.transferedInValue = BigDecimal.zero();
        user.feesPaid = BigInt.zero();
        user.save();
    }
    return user as User;
}
 
export function getOrInitPrice(priceID: string): Price {
    let price = Price.load(priceID);
    if (!price) {
        log.info("create price {}", [priceID]);
        price = new Price(priceID);
        price.timeStamp = BigInt.zero()
        price.deltaLinearAmount = BigDecimal.zero();
        price.deltaNearAmount = BigDecimal.zero();
        // init with 10 near and 10 linear
        price.totalLinearAmount = BigDecimal.zero();
        price.totalNearAmount = BigDecimal.zero();
        price.event = '';
        price.method = '';
        price.price = BigDecimal.zero();
        price.receiptHash = "";
        price.save();
    }
    return price as Price;
}

export function getLatestPrice(): Price | null {
    let priceVersion = PriceVersion.load('price')
    if (priceVersion != null) {
        let price = Price.load(priceVersion.lastPriceID.toString())!;
        return price as Price
    }else {
        return null;
    }
}
