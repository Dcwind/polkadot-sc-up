# ink! Token Staking Smart Contract

This repository contains a Dockerized ink! smart contract for token staking on Polkadot. The contract allows users to stake tokens, earn rewards over time, and withdraw their stake along with accumulated rewards.

## Features

- Token staking with time-based rewards
- Configurable reward rate and minimum staking period
- Ability to claim rewards without unstaking
- Owner-controlled parameters
- Comprehensive test coverage

## Prerequisites

- Docker and Docker Compose
- For local development without Docker: Rust and the ink! toolchain

## Getting Started

### Using Docker (Recommended)

1. Clone this repository
2. Build and run the Docker container:

```bash
docker-compose up
```

This will build the contract and output the .contract file in the `target` directory.

### Local Development

1. Install Rust:
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

2. Install the ink! toolchain:
```bash
rustup component add rust-src
cargo install cargo-contract --force
```

3. Build the contract:
```bash
cargo contract build --release
```

## Contract Interface

The contract provides the following functions:

- `stake()`: Stake tokens (payable function)
- `unstake(amount)`: Unstake tokens and claim rewards
- `claim_rewards()`: Claim rewards without unstaking
- `get_stake_info(account)`: Get information about an account's stake
- `get_total_staked()`: Get the total amount staked
- `update_reward_rate(new_rate)`: Update the reward rate (owner only)
- `update_min_stake_period(new_period)`: Update the minimum staking period (owner only)

## Testing

The contract includes comprehensive tests. Run them with:

```bash
cargo test
```

Or with Docker:

```bash
docker-compose run contract cargo test
```

## Deploying to Westend or Kusama

1. Build the contract first using Docker or locally
2. Use the Polkadot.js Apps UI to deploy the contract:
    - Go to https://polkadot.js.org/apps/
    - Connect to Westend (or Kusama when available)
    - Navigate to Developer -> Contracts
    - Click "Upload & Deploy Code"
    - Select the .contract file from the target directory
    - Set the constructor parameters:
      - reward_rate: The reward rate in basis points (e.g., 10 = 0.1%)
      - min_stake_period: Minimum staking period in blocks

## Comparative Analysis

This contract is designed to be deployed on Polkadot's PolkaVM. For performance comparison with EVM-based contracts:

1. Gas costs will differ between PolkaVM and EVM
2. State access patterns are optimized for Polkadot's storage model
3. The reward mechanism uses block-based calculation suitable for Polkadot's consensus

## License

MIT License