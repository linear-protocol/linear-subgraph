# Building Production-Ready Subgraphs on NEAR

If you're building your DApps on [NEAR](https://near.org/) and are interested to adopt [The Graph](https://thegraph.com/) technology to empower the frontend and analytics of your project, this tutorial is exactly for you.

Let's get started!!! :rocket:

  * [Background](#background)
  * [1. Introduction to Events on NEAR](#1-introduction-to-events-on-near)
    + [NEP-297 Event Standard](#nep-297-event-standard)
    + [Event Standards for FT and NFT](#event-standards-for-ft-and-nft)
  * [2. Implement Events in NEAR Smart Contracts](#2-implement-events-in-near-smart-contracts)
    + [Events in NEAR Standard Contracts](#events-in-near-standard-contracts)
    + [Define Events for Your Contract](#define-events-for-your-contract)
    + [Emit Events in Your Contract](#emit-events-in-your-contract)
    + [Now the Events Data are Ready for Indexing](#now-the-events-data-are-ready-for-indexing)
  * [3. Create Subgraphs with The Graph](#3-create-subgraphs-with-the-graph)
    + [Set your Objectives](#set-your-objectives)
    + [Create Manifest (`subgraph.yaml`)](#create-manifest---subgraphyaml--)
    + [Design Schema (`schema.graphql`)](#design-schema---schemagraphql--)
    + [Handle Events with AssemblyScript Mappings](#handle-events-with-assemblyscript-mappings)
    + [Deploy the Subgraph](#deploy-the-subgraph)
  * [4. Querying Subgraphs](#4-querying-subgraphs)
    + [Query with Playground](#query-with-playground)
    + [Query with GraphQL Client in Code](#query-with-graphql-client-in-code)
  * [It's time to BUIDL now!!!](#its-time-to-buidl-now)
  * [About](#about)
    + [About LiNEAR](#about-linear)
    + [About The Graph](#about-the-graph)

## Background

As the [first non-EVM blockchain](https://thegraph.com/blog/graph-near) supported by The Graph, NEAR blockchain allows developers to index data from events, actions, receipts and logs in NEAR smart contracts, and make best use of the data in their applications and analytics using The Graph. NEAR and The Graph integration utilizes StreamingFast’s Firehose interface which is a fast and scalable solution for layer one blockchain indexing.

There're already some good tutorials about building subgraphs on NEAR, such as [Building an NFT API on NEAR with The Graph](https://github.com/dabit3/near-subgraph-workshop) by Nader, but no one has clearly described how to define and emit events in NEAR smart contracts, and how to process the events in The Graph properly in details.

[LiNEAR](https://linearprotocol.org/), a liquid staking protocol built on NEAR, is the first top tier projects on NEAR that has integrated The Graph in production and does benefit from the flexibility and power of subgraphs to improve statistics and analytics for its users and operations.

The integration makes it possible for the important metrics on LiNEAR, such as staking APY, liquidity pool APY, and users' staking rewards, to be  queried from The Graph based on [NEAR Event Standard](https://nomicon.io/Standards/EventsFormat), which replaces our previous less flexible and inefficient solution based on NEAR Indexer.

Here we'd like to share how LiNEAR has used events and subgraphs in the protocol, and hope that helps more developers to learn and build great projects with NEAR and The Graph.

In this tutorial, you'll learn about:

1. Introduction to Events on NEAR
2. Implement Events in Smart Contracts
3. Create Subgraphs with The Graph
4. Querying Subgraphs 


![](https://i.imgur.com/gitBMeB.png)


## 1. Introduction to Events on NEAR

If you're familiar with the practices of building with The Graph in Ethereum, it's a common practice to handle the events from smart contracts using subgraphs. We're following the same practice on NEAR.

### NEP-297 Event Standard

Here we'll first introduce the [Event Standard NEP-297](https://nomicon.io/Standards/EventsFormat) of NEAR. 

The event format NEP-297 is a standard interface for tracking contract activity, using the standard logs capability of NEAR. Events are log entries that start with the `EVENT_JSON:` prefix followed by a single valid JSON string, which has the following interface:

```typescript
// Interface to capture data about an event
// 
// Arguments
// * `standard`: name of standard, e.g. nep171
// * `version`: e.g. 1.0.0
// * `event`: type of the event, e.g. nft_mint
// * `data`: associate event data. Strictly typed for each set {
// standard, version, event} inside corresponding NEP
interface EventLogData {
    standard: string,
    version: string,
    event: string,
    data?: unknown,
}
```

In the event object, the `standard`, `version` and `event` fields are required, and the `data` field is optional. 

1. The `standard` field represents the standard the event follows, such as `nep141` for fungible token, and `nep171` for non-fungible token, or your application specific standard, such as `linear`.
2. The `version` field is the current version of your event definition. If you've modified the data schema of some events, it's recommended to update the version so the subgraph could process events accordingly. 
3. The `event` field is the event name, e.g. `ft_transfer`, `ft_mint`, `ft_burn` for fungible tokens, usually in snake case.
4. The `data` field includes the details of the event data. Take fungile token for example, if the event is `ft_transfer`, the data could be `[{"old_owner_id":"alice","new_owner_id":"bob","amount":"1000000000000000000"}]`, which means Alice has transferred 1 token (with 18 decimals) to Bob.

### Event Standards for FT and NFT

The Fungible Token (NEP-141) and Non-Fungible Token (NEP-171) standards have defined their own standard interfaces for NEP-297 event format.

For example, a FT transfer event may look as below, when Alice transfers tokens to both Bob and Charlie in a batch.

```json
EVENT_JSON:{
  "standard": "nep141",
  "version": "1.0.0",
  "event": "ft_transfer",
  "data": [
    {
      "old_owner_id": "alice.near",
      "new_owner_id": "bob.near",
      "amount": "250",
      "memo": "tip"
    },
    {
      "old_owner_id": "alice.near",
      "new_owner_id": "charlie.near",
      "amount": "750"
    }
  ]
}
```

An NFT mint event example is as below, when two NFTs are minted for Dave. 

```json
EVENT_JSON:{
  "standard": "nep171",
  "version": "1.0.0",
  "event": "nft_mint",
  "data": [
    {
      "owner_id": "dave.near",
      "token_ids": [
        "superman",
        "batman"
      ]
    }
  ]
}
```

For more details about the FT and NFT standard events, please check out the [FT Events](https://nomicon.io/Standards/Tokens/FungibleToken/Event) and [NFT Events](https://nomicon.io/Standards/Tokens/NonFungibleToken/Event) docs.

You're also allowed to define your own events which we'll talk about next. 

## 2. Implement Events in NEAR Smart Contracts

Now let's implement events in your NEAR smart contract. In this tutorial, we're building the smart contracts in Rust using [NEAR Rust SDK](https://github.com/near/near-sdk-rs).

### Events in NEAR Standard Contracts

If you have built your contracts based on [`near-contract-standards`](https://github.com/near/near-sdk-rs/tree/master/near-contract-standards) crate, such as [fungible token](https://examples.near.org/FT) and [non-fungible token](https://examples.near.org/NFT), you already have the built-in events implementation in your contract. So you can use that in subgraphs directly.

The implementation of fungible token events (`FtMint`, `FtBurn`, `FtTransfer`) can be found [here](https://github.com/near/near-sdk-rs/blob/master/near-contract-standards/src/fungible_token/events.rs). Take `FtTransfer` for example, the event data schema and `emit` methods need to be implemented. 

```rust
/// Data to log for an FT transfer event. To log this event,
/// call [`.emit()`](FtTransfer::emit).
#[must_use]
#[derive(Serialize, Debug, Clone)]
pub struct FtTransfer<'a> {
    pub old_owner_id: &'a AccountId,
    pub new_owner_id: &'a AccountId,
    pub amount: &'a U128,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub memo: Option<&'a str>,
}

impl FtTransfer<'_> {
    /// Logs the event to the host. This is required to ensure that the event is triggered
    /// and to consume the event.
    pub fn emit(self) {
        Self::emit_many(&[self])
    }

    /// Emits an FT transfer event, through [`env::log_str`](near_sdk::env::log_str),
    /// where each [`FtTransfer`] represents the data of each transfer.
    pub fn emit_many(data: &[FtTransfer<'_>]) {
        new_141_v1(Nep141EventKind::FtTransfer(data)).emit()
    }
}
```

The defined `FtTransfer` event is emitted in [`internal_transfer`](https://github.com/near/near-sdk-rs/blob/8a2b2e19b27a764abf43df05bd0e530c3ad91d6c/near-contract-standards/src/fungible_token/core_impl.rs#L91-L109).

```rust
pub fn internal_transfer(
    &mut self,
    sender_id: &AccountId,
    receiver_id: &AccountId,
    amount: Balance,
    memo: Option<String>,
) {
    require!(sender_id != receiver_id, "Sender and receiver should be different");
    require!(amount > 0, "The amount should be a positive number");
    self.internal_withdraw(sender_id, amount);
    self.internal_deposit(receiver_id, amount);
    FtTransfer {
        old_owner_id: sender_id,
        new_owner_id: receiver_id,
        amount: &U128(amount),
        memo: memo.as_deref(),
    }
    .emit();
}
```


### Define Events for Your Contract

It's quite common define you own events in your contract.

Here we'll implement the events in LiNEAR as an example. LiNEAR is an liquid staking protocol that you could stake $NEAR and receive liquid $LiNEAR tokens while still earning staking rewards. We will create events for all the main activities. If you're not familiar with LiNEAR's features such as `Stake` and `Unstake`, we recommend that you spend 1 minute to [have a try](https://app.linearprotocol.org/).

We'll define the events for LiNEAR under [`events.rs`](https://github.com/linear-protocol/LiNEAR/blob/main/contracts/linear/src/events.rs) in the contract project.

(1) First, we can define the `standard` and `version` in EVENT_JSON as constants.  

```rust
const EVENT_STANDARD: &str = "linear";
const EVENT_STANDARD_VERSION: &str = "1.0.0";
```

(2) We'll define `enum Event` with all the event data schemas as enums.

For example, the user operations such as `deposit`, `withdraw`, `stake` and `unstake` will emit events with the necessary data. The name of the event (e.g. `Deposit`) will be turned into `event` field in EVENT_JSON, and the content of the enum (`account_id`, `amount` and `new_unstaked_balance`) will be transformed into `data` field in EVENT_JSON. 

```rust
#[derive(Serialize, Debug, Clone)]
#[serde(crate = "near_sdk::serde")]
#[serde(tag = "event", content = "data")]
#[serde(rename_all = "snake_case")]
pub enum Event<'a> {
    // ...
    // Staking Pool Interface
    Deposit {
        account_id: &'a AccountId,
        amount: &'a U128,
        new_unstaked_balance: &'a U128,
    },
    Withdraw {
        account_id: &'a AccountId,
        amount: &'a U128,
        new_unstaked_balance: &'a U128,
    },
    Stake {
        account_id: &'a AccountId,
        staked_amount: &'a U128,
        minted_stake_shares: &'a U128,
        new_unstaked_balance: &'a U128,
        new_stake_shares: &'a U128,
    },
    Unstake {
        account_id: &'a AccountId,
        unstaked_amount: &'a U128,
        burnt_stake_shares: &'a U128,
        new_unstaked_balance: &'a U128,
        new_stake_shares: &'a U128,
        unstaked_available_epoch_height: u64,
    },
    // ...
```

Events in LiNEAR have various types: user operation events, epoch actions events that can be triggered every epoch by anyone, and validator management events that are emitted when validators are added/removed in the pool. 

(3) Add `emit()` method for your events, which will serialize your event data and log event JSON following NEP-297 standard.

```rust
impl Event<'_> {
    pub fn emit(&self) {
        emit_event(&self);
    }
}

// Emit event that follows NEP-297 standard: https://nomicon.io/Standards/EventsFormat
// Arguments
// * `standard`: name of standard, e.g. nep171
// * `version`: e.g. 1.0.0
// * `event`: type of the event, e.g. nft_mint
// * `data`: associate event data. Strictly typed for each set {standard, version, event} inside corresponding NEP
pub(crate) fn emit_event<T: ?Sized + Serialize>(data: &T) {
    let result = json!(data);
    let event_json = json!({
        "standard": EVENT_STANDARD,
        "version": EVENT_STANDARD_VERSION,
        "event": result["event"],
        "data": [result["data"]]
    })
    .to_string();
    log!(format!("EVENT_JSON:{}", event_json));
}
```
 
(4) If your contract contains a bunch of different events, we suggest you create unit tests for your events to make sure the generated EVENT_JSON logs look exactly as you think. Running `Event::Stake{...}.emit()` will output the EVENT JSON log.

```rust
#[test]
fn stake() {
    let account_id = &alice();
    let staked_amount = &U128(100);
    let minted_stake_shares = &U128(99);
    let new_unstaked_balance = &U128(10);
    let new_stake_shares = &U128(199);
    Event::Stake {
        account_id,
        staked_amount,
        minted_stake_shares,
        new_unstaked_balance,
        new_stake_shares,
    }
    .emit();
    assert_eq!(
        test_utils::get_logs()[0],
        r#"EVENT_JSON:{"standard":"linear","version":"1.0.0","event":"stake","data":[{"account_id":"alice","staked_amount":"100","minted_stake_shares":"99","new_unstaked_balance":"10","new_stake_shares":"199"}]}"#
    );
}
```

You can find the complete example of defining events in [`events.rs`](https://github.com/linear-protocol/LiNEAR/blob/main/contracts/linear/src/events.rs).

### Emit Events in Your Contract

Now we have defined events for the contract, let's emit events in the right places. 

We'll illustrate how to emit events for `stake`, `unstake` and `epoch stake` actions in LiNEAR.

(1) `Stake` event is emitted in [`internal_stake()`](https://github.com/linear-protocol/LiNEAR/blob/2c78f26084bc8e999cea9643c0f7bf3c6aef06f5/contracts/linear/src/internal.rs#L102-L121) which is called by all stake functions. The account ID, balances, staked $NEAR amount, and minted $LiNEAR are recorded in the event. Also, one standard `FtMint` event is emitted since $LiNEAR is minted for the user after staking. 

```rust
pub(crate) fn internal_stake(&mut self, amount: Balance) {
    
    // ...
    
    self.total_staked_near_amount += stake_amount;
    self.total_share_amount += num_shares;

    // Increase requested stake amount within the current epoch
    self.epoch_requested_stake_amount += stake_amount;

    Event::Stake {
        account_id: &account_id,
        staked_amount: &U128(charge_amount),
        minted_stake_shares: &U128(num_shares),
        new_unstaked_balance: &U128(account.unstaked),
        new_stake_shares: &U128(account.stake_shares),
    }
    .emit();
    FtMint {
        owner_id: &account_id,
        amount: &U128(num_shares),
        memo: Some("stake"),
    }
    .emit();
    
    // ...
}
```


(2) `Unstake` event is emitted in [`internal_unstake()`](https://github.com/linear-protocol/LiNEAR/blob/2c78f26084bc8e999cea9643c0f7bf3c6aef06f5/contracts/linear/src/internal.rs#L180-L200)  which is called by all (delayed) unstake functions. The account ID, balances, burnt $LiNEAR, received $NEAR amount, and unstake available epoch height are recorded in the event. Also, one standard `FtBurn` event is emitted since $LiNEAR is burnt when the user is unstaking.

```rust
pub(crate) fn internal_unstake(&mut self, amount: u128) {

    // ...
    
    self.total_staked_near_amount -= unstake_amount;
    self.total_share_amount -= num_shares;

    // Increase requested unstake amount within the current epoch
    self.epoch_requested_unstake_amount += unstake_amount;

    Event::Unstake {
        account_id: &account_id,
        unstaked_amount: &U128(receive_amount),
        burnt_stake_shares: &U128(num_shares),
        new_unstaked_balance: &U128(account.unstaked),
        new_stake_shares: &U128(account.stake_shares),
        unstaked_available_epoch_height: account.unstaked_available_epoch_height,
    }
    .emit();
    FtBurn {
        owner_id: &account_id,
        amount: &U128(num_shares),
        memo: Some("unstake"),
    }
    .emit();
    
    // ...
}
```


(3) One thing needs to pay attention to in NEAR is that, because the cross-contract call is asynchronous in NEAR's sharding design, to make sure the events are emitted in the expected status (e.g. entire transaction has been executed successfully), the events should be emitted in the appropriate functions or callbacks. 

Let's take a look at `EpochStakeAttempt`, `EpochStakeSuccess` and `EpochStakeFailed` as examples.

The `EpochStakeAttemp` event is emitted whenever the [`epoch_stake` function](https://github.com/linear-protocol/LiNEAR/blob/2c78f26084bc8e999cea9643c0f7bf3c6aef06f5/contracts/linear/src/epoch_actions.rs#L54-L58) is called.

```rust
pub fn epoch_stake(&mut self) -> bool {
    // ...

    // update internal state
    self.stake_amount_to_settle -= amount_to_stake;

    Event::EpochStakeAttempt {
        validator_id: &candidate.account_id,
        amount: &U128(amount_to_stake),
    }
    .emit();

    // ...
}
```

Then we emit the epoch stake result events in the callback function -- [`validator_staked_callback()`](https://github.com/linear-protocol/LiNEAR/blob/2c78f26084bc8e999cea9643c0f7bf3c6aef06f5/contracts/linear/src/epoch_actions.rs#L360-L383). 

The `EpochStakeSuccess` and `EpochStakeFailed` events are emitted only when the `epoch_stake` execution succeeded or failed, but `EpochStakeAttempt` is emitted as long as the `epoch_stake` function is executed.

```rust
pub fn validator_staked_callback(&mut self, validator_id: AccountId, amount: Balance) {
    if is_promise_success() {
        let mut validator = self
            .validator_pool
            .get_validator(&validator_id)
            .unwrap_or_else(|| panic!("{}: {}", ERR_VALIDATOR_NOT_EXIST, &validator_id));
        validator.on_stake_success(&mut self.validator_pool, amount);

        Event::EpochStakeSuccess {
            validator_id: &validator_id,
            amount: &U128(amount),
        }
        .emit();
    } else {
        // stake failed, revert
        self.stake_amount_to_settle += amount;

        Event::EpochStakeFailed {
            validator_id: &validator_id,
            amount: &U128(amount),
        }
        .emit();
    }
}
```

### Now the Events Data are Ready for Indexing

Using events in contract is quite straightforward. All you need to do is to define the events for the actions and emit them in the corresponding functions. 

With the on-chain events data, you can now process the data through indexing technologies, such as [The Graph](https://thegraph.com), [NEAR Indexer](https://near-indexers.io/docs/projects/near-indexer-framework) and [NEAR Lake](https://near-indexers.io/docs/projects/near-lake-framework). 

We recommend building your data solution with The Graph because it's the most flexible, powerful and cost effective solution for DApps, while NEAR Indexer and NEAR Lake have their own best use cases that we're not going to cover in this tutorial. 


## 3. Create Subgraphs with The Graph

With the event implemented in our contract, now we can develop and deploy subgraphs to capture and handle the events. 

The general steps about how to develop a subgraph on NEAR can be found in [the tutorial by The Graph team](https://thegraph.com/docs/en/supported-networks/near/). We recommend you go through it quickly if you haven't.

In this tutorial, we'll share the details about how to handle events, and how it works in production in the LiNEAR Protocol.

As mentioned in the [Building a NEAR Subgraph](https://thegraph.com/docs/en/supported-networks/near/#building-a-near-subgraph) tutorial, there are three aspects of subgraph definition:

- `subgraph.yaml`: the subgraph manifest, defining the data sources, and how they should be processed.
- `schema.graphql`: a schema file that defines what data is stored for your subgraph, and how to query it via GraphQL.
- AssemblyScript Mappings: [AssemblyScript code](https://thegraph.com/docs/en/developer/assemblyscript-api/) that translates from the event data to the entities defined in your schema. 

Next, we'll talk about all the three aspects with linear-subgraph project as the example: https://github.com/linear-protocol/linear-subgraph

But before that, let's ensure we understand our objectives before we start.

### Set your Objectives

Before we start developing subgraphs, we should know what kind of info, stats, insights or stories we want to get out of the event data.

Some of the data could be queried via RPC from the smart contracts, but some statistics and analytics are easier to be queried from subgraph. We will need subgraphs for such cases. 

For LiNEAR, we care about the staking APY, liquidity pool APY, and staking rewards of users, and would like to show the information in the [LiNEAR web UI](https://app.linearprotocol.org/). We also care about analytics of users, validators, liquidity, etc., which could help us to improve the protocol.

In this tutorial, we'll briefly talk about how to calculate the **staking APY of LiNEAR Protocol**, which is based on the growth of $LiNEAR price in the past 30 days. In order to reach this goal, we need to get the $LiNEAR price at any timestamp with The Graph. 


### Create Manifest (`subgraph.yaml`)

The subgraph manifest (`subgraph.yaml`) contains the below definitions: 

1. *blockchain*: set data source `kind` to `near`
2. *network*: `near-mainnet` or `near-testnet`
3. *source account*: your contract account, e.g. `linear-protocol.near`
4. *start block*: usually the block when your contract was deployed
5. *mapping file*: `./src/mapping/index.ts`
6. *entities*: the entities defined in the schema file
7. *handler*: the handler function in your mapping file (`handleReceipt`). we use the `receiptHandlers` since the functions and events are processed at receipt level in NEAR

See below for the manifest of the LiNEAR subgraph.

```yaml
specVersion: 0.0.4
description: LiNEAR Protocol subgraph
repository: https://github.com/linear-protocol/linear-subgraph
schema:
  file: ./schema.graphql
dataSources:
  - kind: near
    name: receipts
    network: {{network}}
    source:
      account: "{{contract}}"
      startBlock: {{startBlock}}
    mapping:
      apiVersion: 0.0.5
      language: wasm/assemblyscript
      file: ./src/mapping/index.ts
      entities:
        - User
        - Price
        - TotalSwapFee
        - Status
        - FtTransfer
      receiptHandlers:
        - handler: handleReceipt

```

The placeholders `{{network}}`, `{{contract}}`, `{{startBlock}}` are populated with different configurations for mainnet and testnet, which are defined in `./config/mainnet.json` and `./config/testnet.json`.


*./config/mainnet.json*

```json
{
    "network": "near-mainnet",
    "contract": "linear-protocol.near",
    "startBlock": 61147683
}
```


### Design Schema (`schema.graphql`)

Schema describes the structure of the resulting subgraph database and the relationships between entities. Please notice that the entities are not necessary to be the same as the events we defined in our smart contracts.

The recommended way is to define the schema based on your data queries and analytics objectives, and the data models in your application. In the case of LiNEAR, we have defined:

- **User**: tracks the latest states of each user such as first staking time, transferred amount in total, accumulated minted LiNEAR amount in total, etc. which are not available in contract's states. You probably also need the *User* entity in your application as long as you have users.
- **Price**: the $LiNEAR price at the timestamp when the total staked NEAR or total supply of $LiNEAR changes. At any given timestamp, `$LiNEAR price = total staked NEAR plus its staking rewards / total supply of LiNEAR`
- **TotalSwapFee**: records the total paid swap fees to the liquidity pool at any timestamp when there're new fees paid
- **Status**: records global status such as latest version IDs of prices and total swap fees.


The [built-in scalar types](https://thegraph.com/docs/en/developing/creating-a-subgraph/#built-in-scalar-types) in The Graph's GraphQL API are helpful for defining the schema . 

![](https://i.imgur.com/kc68mnt.png)

Below lists the schema for **User** and **Price** in LiNEAR.

```graphql
type User @entity{
   id: ID!
   mintedLinear: BigInt!
   unstakedLinear: BigInt!
   stakedNear: BigInt!
   unstakeReceivedNear: BigInt!
   firstStakingTime: BigInt!
   transferedInValue: BigDecimal!
   transferedOutValue: BigDecimal!
   transferedInShares: BigInt!
   transferedOutShares: BigInt!
   feesPaid: BigInt!
}

type Price @entity{
   id: ID!
   timestamp: BigInt!
   method: String!
   event: String!
   receiptHash: String!
   deltaLinearAmount: BigDecimal!
   deltaNearAmount: BigDecimal!
   totalLinearAmount: BigDecimal!
   totalNearAmount: BigDecimal!
   price: BigDecimal!
}
```

Now we can run `yarn codegen` in the LiNEAR subgraph project to generate the schema definitions to `./generated/schema.ts` that can be used in the mapping files.


### Handle Events with AssemblyScript Mappings

In general, The Graph works by traversing all or some of the blocks of the blockchain, and processing the data (e.g. events) in the block with the handlers designed by developers. 

There are currently two types of handlers supported for NEAR subgraphs:

- block handlers: run on every new block
- receipt handlers: run every time some actions are executed at a specified account

As mentioned when defining `subgraph.yaml`, we use the receipt handler in LiNEAR. As long as your application is relying on one or several smart contracts, you should probably also use the receipt handler. 

```yaml
receiptHandlers:
  - handler: handleReceipt
```

In the AssemblyScript mapping file `./src/mapping/index.ts`, firstly we process the logs in the current receipt, and extract the event data from the logs, and pass them to `handleEvent`.

```typescript
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
```

As one of our goals is to calculate the $LiNEAR price, we need to track all the actions that might impact the total staked NEAR plus its rewards, and the total supply of LiNEAR. 

To avoid delving into too many details, here we illustrate how to process the `EpochUpdateRewards` event when the staking rewards are fetched from validators every epoch, which increases the $LiNEAR price.

By looking at [the contract code](https://github.com/linear-protocol/LiNEAR/blob/2c78f26084bc8e999cea9643c0f7bf3c6aef06f5/contracts/linear/src/epoch_actions.rs#L456-L462), we know `epoch_update_rewards()` function and its callback `validator_get_balance_callback()` will trigger the `EpochUpdateRewards`, we filter the condition by method name and event name, and then call the corresponding event handler `handleEpochUpdateRewards`. (Note: `method == 'epoch_update_rewards'` is actually not needed and can be removed, because the event is only emitted in the callback `validator_get_balance_callback`.)

```typescript
function handleEvent(
  method: string,
  event: string,
  data: TypedMap<string, JSONValue>,
  receipt: near.ReceiptWithOutcome
): void {
  
  // ...
    
  } else if (
    method == 'epoch_update_rewards' ||
    method == 'validator_get_balance_callback'
  ) {
    if (event == 'epoch_update_rewards') {
      handleEpochUpdateRewards(method, event, data, receipt);
    } else if (event == 'ft_mint') {
      handleFtMint(method, event, data, receipt);
    }
  }

  // ...

}
```

In `./src/mapping/epoch-action.ts`, we have implemented the event handler for `EpochUpdateRewards`, which will update the $LiNEAR price based on the received staking rewards. 

```typescript
export function handleEpochUpdateRewards(
  method: string,
  event: string,
  data: TypedMap<string, JSONValue>,
  receipt: near.ReceiptWithOutcome
): void {
  const rewards = BigDecimal.fromString(data.get('rewards')!.toString());
  updatePrice(event, method, receipt, rewards, BigDecimal.zero());
}
```

It's also necessary to handle `FtMint` when updating staking rewards because around `1%` commission fee is charged and sent to the treasury in the form of $LiNEAR. 

In `./src/mappping/fungible-token.ts`,

```typescript
export function handleFtMint(
  method: string,
  event: string,
  data: TypedMap<string, JSONValue>,
  receipt: near.ReceiptWithOutcome
): void {
  const amount = BigDecimal.fromString(data.get('amount')!.toString());
  updatePrice(event, method, receipt, BigDecimal.zero(), amount);
}
```

We can also take a look how `updatePrice()` works in [`./src/helper/price.ts`](https://github.com/linear-protocol/linear-subgraph/blob/b13779eee7c233932b1ed58090c553b75464bdb6/src/helper/price.ts#L5-L36):

1. The last `Price` object will be read from the `Price` entities by using the last price version ID saved in `Status` entity, which is a global state that tracks the latest versions of price, total swap fees, etc.;
2. A new `Price` entity will be created with delta $NEAR / $LiNEAR amount, the updated total $NEAR / $LiNEAR amount, current $LiNEAR price, and other relevant info such as event name, method name, timestamp, etc., and saved into the database;
3. Increment the latest Price version ID, and update the latest price value in the global `Status` record, which will be used in next `updatePrice()` call.

```typescript
export function updatePrice(
  event: string,
  method: string,
  receipt: near.ReceiptWithOutcome,
  deltaNear: BigDecimal,
  deltaLinear: BigDecimal
): void {
  const timestamp = receipt.block.header.timestampNanosec;
  const receiptHash = receipt.receipt.id.toBase58();

  let status = getOrInitStatus();
  let lastPrice = getOrInitPrice(status.priceVersion.toString());

  // create new price
  const nextVersion = status.priceVersion.plus(BigInt.fromU32(1));
  let nextPrice = new Price(nextVersion.toString());
  nextPrice.deltaNearAmount = deltaNear;
  nextPrice.deltaLinearAmount = deltaLinear;
  nextPrice.totalNearAmount = lastPrice.totalNearAmount.plus(deltaNear);
  nextPrice.totalLinearAmount = lastPrice.totalLinearAmount.plus(deltaLinear);
  nextPrice.price = nextPrice.totalNearAmount.div(nextPrice.totalLinearAmount);
  nextPrice.timestamp = BigInt.fromU64(timestamp);
  nextPrice.event = event;
  nextPrice.receiptHash = receiptHash;
  nextPrice.method = method;
  nextPrice.save();

  // update status
  status.priceVersion = nextVersion;
  status.price = nextPrice.price;
  status.save();
}
```

Now that we have all the versioned prices in history, it would be easy to calculate the staking APY which is reflected by the growth of $LiNEAR price. 


### Deploy the Subgraph

Now we have built the subgraph. It's the time to deploy it to [The Graph's Subgraph Studio](https://thegraph.com/docs/en/deploying/deploying-a-subgraph-to-studio/) for indexing. 

First, you need to create your subgraph in the [Subgraph Studio dashboard](https://thegraph.com/studio/) by clicking "Create a Subgraph" button, or just visit [this link](https://thegraph.com/studio/?show=Create). Enter the name for the subgraph will be good enough.

![](https://i.imgur.com/wp2hswQ.png)



Next, you can follow the steps in [README](https://github.com/linear-protocol/linear-subgraph/blob/main/README.md#development) to deploy LiNEAR subgraph to either testnet or mainnet. Don't forget to replace the `SLUG` and `ACCESS_TOKEN` in `.env` with yours.

```bash
# copy env and adjust its content
# you can get an access token from https://thegraph.com/explorer/dashboard
cp .env.example .env
# install project dependencies
yarn
# prepare subgraph.yaml
yarn prepare:mainnet
# run codegen
yarn codegen
# now you're able to deploy to thegraph via
yarn deploy
```

After waiting a while (minutes to even hours, depending on how complex your mapping handler is and how long your project exists), your subgraph should be synchronized. You can always check the latest status of your subgraph in the Subgraph Studio site

![](https://i.imgur.com/jYfcRhp.png)



## 4. Querying Subgraphs 

Thanks for staying so long with us. :muscle: Now it's time to query our subgraph!!!

You'll need to [learn a bit about **GraphQL**](https://graphql.org/learn/) and [The Graph's GraphQL API](https://thegraph.com/docs/en/developer/graphql-api/) if you didn't use it before.

We have at least two ways to query data:

1. using the playground of your subgraph
2. using the GraphQL client in your code


### Query with Playground

After deploying your subgraph and the sync is done, you'll be able to query with the playground.

![](https://i.imgur.com/DwT6lIf.png)

In the playground, you can edit, save and execute your GraphQL queries. 

In the above screenshot, we have queried 100 users with the fields we're interested in. 

```graphql
{
  users(first: 100) {
    id
    mintedLinear
    unstakedLinear
    stakedNear
  }
}

```


### Query with GraphQL Client in Code

Usually we'll query subgraph in our application frontend and analytics/statistics tools. We can use any GraphQL client such as Apollo Client or URQL as suggested by [The Graph's docs](https://thegraph.com/docs/en/developer/querying-from-your-app/). 

Here we use `urql` library as an example.

(1) Get the GraphQL endpoint for our subgraph: `https://api.studio.thegraph.com/query/<number>/<name>/<version>`

(2) Create the URQL client. 

```javascript
const { createClient } = require('urql');

const client = createClient({
  url: config.subgraph.apiUrl,
})
```

(3) Query the subgraph with the URQL client. 

Here we'd like to query the $LiNEAR price 30 days ago, so we can calculate the staking APY with it. You can find more query examples in the [`./test` folder](https://github.com/linear-protocol/linear-subgraph/blob/b13779eee7c233932b1ed58090c553b75464bdb6/test/price.js#L4-L23). 

```javascript
async function queryPriceBefore(timestamp) {
  const query = `
      query {
        prices (first: 1, orderBy: timestamp, orderDirection: desc,
          where: {timestamp_lte: "${timestamp.toString()}"} )
        {
          id
          timestamp
          price
        }
      }`;
  const { data } = await client.query(query).toPromise();
  if (data == null) {
    throw new Error('Failed to query price');
  }
  return data.prices[0];
}
```

We can also get the latest $LiNEAR price from contract, and we already have queried the $LiNEAR price 30 days before now, we'll be able to calculate the staking rewards with the formula `(price (now) - price (30 days ago)) / 30 * 365`. We finally make it!!!

*P.S.* At LiNEAR Protocol, we have built a SDK based on the subgraph queries, which is used in our frontend and analytics. Please feel free to [check out](https://github.com/linear-protocol/linear-sdk) if you're intersted to build your own SDKs.


## It's time to BUIDL now!!!

Congratulations, my friend! :birthday: 

You have learnt about the details of building subgraphs on NEAR with events, from implementing and emitting the events in your smart contract, to building, deploying and querying the subgraphs that process your events.

Besides this tutorial, there are other excellent guides that will help you learn more about using The Graph on NEAR.

- [Building Subgraphs on NEAR](https://thegraph.com/docs/en/supported-networks/near/)
- [Building an NFT API on NEAR with The Graph](https://github.com/dabit3/near-subgraph-workshop)
- [Example NEAR Receipts Subgraph: Good Morning NEAR](https://github.com/graphprotocol/example-subgraph/tree/near-receipts-example)
- [Quick Start Guide of The Graph](https://thegraph.com/docs/en/developer/quick-start/)


Now it's your time to start building and hacking. If you have any questions, please feel free to [discuss with us in the `linear-protocol/linear-subgraph` repo](https://github.com/linear-protocol/linear-subgraph/discussions). Good luck!


## About

### About LiNEAR

LiNEAR Protocol is a liquid staking solution built on the NEAR Protocol. LiNEAR unlocks liquidity of the staked NEAR by creating a staking derivative to be engaged with various DeFi protocols on NEAR and Aurora, while also enjoying over 10% APY staking rewards of the underlying base tokens. LiNEAR is the cornerstone of the NEAR-Aurora DeFi ecosystem.

### About The Graph

The Graph is the indexing and query layer of web3. Developers build and publish open APIs, called subgraphs, that applications can query using GraphQL. The Graph currently supports indexing data from 31 different networks including Ethereum, NEAR, Arbitrium, Optimism, Polygon, Avalanche, Celo, Fantom, Moonbeam, IPFS, and PoA with more networks coming soon. Developers build and publish open APIs, called subgraphs, that applications can query using GraphQL.

![](https://i.imgur.com/yZSgnsT.png)
