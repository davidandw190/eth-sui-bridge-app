module ibt_bridge::ibt_token {
    use sui::object::{Self, UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::coin::{Self, Coin, TreasuryCap};
    use std::option;
    use sui::event;

    // Define event structures for bridge operations
    struct TokensBridged has copy, drop {
        amount: u64,
        recipient: address,
        ethereum_tx_hash: vector<u8>
    }

    struct TokensUnbridged has copy, drop {
        amount: u64,
        ethereum_address: vector<u8>
    }

    // Define the one-time witness for module initialization
    struct IBT_TOKEN has drop {}

    // Admin capability for managing the bridge
    struct BridgeAdmin has key, store {
        id: UID,
        treasury_cap: TreasuryCap<IBT_TOKEN>
    }

    // Error codes
    const E_ZERO_AMOUNT: u64 = 0;
    const E_UNAUTHORIZED: u64 = 1;

    // Initialize the token and bridge admin
    fun init(witness: IBT_TOKEN, ctx: &mut TxContext) {
        let (treasury, metadata) = coin::create_currency(
            witness,
            9, // Decimals to match Ethereum's standard
            b"IBT",
            b"Inter-Blockchain Token",
            b"Bridge Token",
            option::none(),
            ctx
        );

        // Create and transfer the admin capability
        transfer::transfer(
            BridgeAdmin {
                id: object::new(ctx),
                treasury_cap: treasury
            },
            tx_context::sender(ctx)
        );

        // Make metadata immutable and public
        transfer::public_freeze_object(metadata);
    }

    // Mint tokens when they're bridged from Ethereum
    public entry fun mint_bridged_tokens(
        admin: &mut BridgeAdmin,
        amount: u64,
        recipient: address,
        ethereum_tx_hash: vector<u8>,
        ctx: &mut TxContext
    ) {
        assert!(amount > 0, E_ZERO_AMOUNT);

        // Mint new tokens
        let coins = coin::mint(&mut admin.treasury_cap, amount, ctx);

        // Transfer to recipient
        transfer::public_transfer(coins, recipient);

        // Emit event for tracking
        event::emit(TokensBridged {
            amount,
            recipient,
            ethereum_tx_hash
        });
    }

    // Burn tokens when bridging back to Ethereum
    public entry fun burn_for_bridge(
        admin: &mut BridgeAdmin,
        coins: Coin<IBT_TOKEN>,
        ethereum_address: vector<u8>,
        ctx: &mut TxContext
    ) {
        let amount = coin::value(&coins);
        assert!(amount > 0, E_ZERO_AMOUNT);

        // Burn the tokens
        coin::burn(&mut admin.treasury_cap, coins);

        // Emit event for tracking
        event::emit(TokensUnbridged {
            amount,
            ethereum_address
        });
    }

    // Utility function to check coin balance
    public fun balance(coin: &Coin<IBT_TOKEN>): u64 {
        coin::value(coin)
    }
}