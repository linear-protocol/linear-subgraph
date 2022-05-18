import { BigDecimal, BigInt, log } from '@graphprotocol/graph-ts';
import { Price, User, Status } from '../../generated/schema';

export function getOrInitUser(accountId: string): User {
  let user = User.load(accountId);
  if (!user) {
    log.info('create user {}', [accountId]);
    user = new User(accountId);
    user.firstStakingTime = BigInt.zero();
    user.mintedLinear = BigInt.zero();
    user.stakedNear = BigInt.zero();
    user.unstakeReceivedNear = BigInt.zero();
    user.unstakedLinear = BigInt.zero();
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
    log.info('create price {}', [priceID]);
    const TEN_NEAR = BigDecimal.fromString('10000000000000000000000000');
    price = new Price(priceID);
    price.timestamp = BigInt.zero();
    price.deltaLinearAmount = BigDecimal.zero();
    price.deltaNearAmount = BigDecimal.zero();
    // init with 10 near and 10 linear
    price.totalLinearAmount = TEN_NEAR;
    price.totalNearAmount = TEN_NEAR;
    price.event = '';
    price.method = '';
    price.price = BigDecimal.zero();
    price.receiptHash = '';
    price.save();
  }
  return price as Price;
}

export function getOrInitStatus(): Status {
  let status = Status.load('status');
  if (!status) {
    status = new Status('status');
    status.priceVersion = BigInt.zero();
    status.price = BigDecimal.zero();
    status.save();
  }
  return status as Status;
}
