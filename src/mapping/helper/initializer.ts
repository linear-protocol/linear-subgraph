
import { BigInt, log } from "@graphprotocol/graph-ts";
import { User } from "../../../generated/schema";

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
        user.feesPaid = BigInt.zero();
        user.save();
    }
    return user as User;
}
