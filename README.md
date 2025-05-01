# Polkadot Governance Tracker

This project is a decentralized governance smart contract built with ink! for the Polkadot ecosystem, designed for the Polkadot and Smart Contracts sub-track bounty. The contract enables users to submit proposals, vote using multiple assets (including the native UNIT/ROC token), and simulate integration with the Polkadot Democracy pallet. It also supports cross-chain awareness by emitting events for other parachains. A JavaScript frontend (`main.js`) provides a user interface to interact with the contract, deployed on a local `substrate-contracts-node` or the Rococo testnet.

## Features
- **Proposal Management**: Users can submit, vote on, close, or cancel governance proposals.
- **Multi-Asset Voting**: Supports voting with multiple assets (e.g., native UNIT/ROC as `asset_id: 0`, and placeholder assets `1`, `2`).
- **Democracy Pallet Integration**: Simulates submitting passing proposals to the Democracy pallet by assigning a `referendum_index`.
- **Cross-Chain Awareness**: Emits `CrossChainMessage` events to notify other parachains about proposal creation and referendum submission.
- **Frontend Interface**: A web-based UI (`main.js`) allows users to interact with the contract, displaying proposal details, votes, and referendum status.
- **RISC-V Compatibility**: Built with ink! for deployment on Polkadot’s Virtual Machine (PVM).

## Prerequisites
This project requires a Linux environment (e.g., Ubuntu 20.04 or later). Below are the dependencies and tools needed.

### Dependencies
- **Rust Toolchain**:
  - `rustc` (nightly, e.g., `1.81.0-nightly` or compatible).
  - `cargo-contract` (version `4.1.0` or later).
- **Substrate Contracts Node**:
  - `substrate-contracts-node` (latest version for local testing).
- **Node.js and npm**:
  - Node.js (version `18.x` or later, required for Vite-based frontend).
  - npm (included with Node.js).
- **Nginx**:
  - For serving the frontend on `http://localhost:8080`.
- **Netcat**:
  - For checking node availability.
- **Polkadot.js Apps** (optional):
  - For manual testing or Rococo deployment.
- **Contract Dependencies** (specified in `Cargo.toml`):
  - `ink` (version `4.3`).
  - `parity-scale-codec` (version `3`, with `derive` feature).
  - `scale-info` (version `2.9`, with `derive` feature).

### System Requirements
- Linux OS (tested on Ubuntu 20.04/22.04).
- At least 4GB RAM and 20GB free disk space.
- Internet connection for installing dependencies and fetching Rococo testnet tokens.

## Environment Setup (Linux)

Follow these steps to set up the environment on a Linux system (e.g., Ubuntu).

1. **Install System Dependencies**:
   ```bash
   sudo apt-get update
   sudo apt-get install -y build-essential curl wget git netcat-openbsd nginx
   ```

2. **Install Rust Toolchain**:
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   source $HOME/.cargo/env
   rustup update
   rustup toolchain install nightly
   rustup target add wasm32-unknown-unknown --toolchain nightly
   ```

3. **Install `cargo-contract`**:
   ```bash
   cargo install cargo-contract --version 4.1.0 --force
   cargo contract --version
   ```

4. **Install `substrate-contracts-node`**:
   ```bash
   wget https://github.com/paritytech/substrate-contracts-node/releases/download/v0.31.0/substrate-contracts-node-linux-v0.31.0.tar.gz
   tar -xzf substrate-contracts-node-linux-v0.31.0.tar.gz
   sudo mv substrate-contracts-node /usr/local/bin/
   substrate-contracts-node --version
   ```

5. **Install Node.js and npm**:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   node --version
   npm --version
   ```

6. **Clone the Repository**:
   ```bash
   git clone <your-repository-url> polkadot-governance-tracker
   cd polkadot-governance-tracker
   ```

7. **Verify Directory Structure**:
   Ensure the following files are present:
   - `lib.rs`: The ink! smart contract.
   - `Cargo.toml`: Contract dependencies and configuration.
   - `start.sh`: Script to build, deploy, and start the local node.
   - `frontend.sh`: Script to build and serve the frontend.
   - `frontend/main.js`: Frontend JavaScript code.
   - `frontend/package.json`: Frontend dependencies (created during `npm install`).

## Project Setup

### 1. Build and Deploy the Contract
The `start.sh` script builds the contract, starts a local `substrate-contracts-node`, and deploys the contract.

1. **Make the Script Executable**:
   ```bash
   chmod +x start.sh
   ```

2. **Run the Script**:
   ```bash
   ./start.sh
   ```
   - **What it does**:
     - Builds the contract (`cargo contract build --release`).
     - Starts `substrate-contracts-node` on `ws://localhost:9944`.
     - Deploys the contract with constructor arguments:
       - `min_deposit`: `1000000000000` Planck (1 ROC/UNIT).
       - `voting_period`: `100800` blocks (~7 days at 6 seconds/block).
       - `supported_assets`: `[0, 1, 2]` (native UNIT/ROC as `0`, placeholders `1`, `2`).
     - Saves the contract address to `frontend/config/contract-address.js`.
     - Copies metadata to `frontend/public/target/ink/governance_tracker.json`.
   - **Output**: Look for `Contract deployed successfully at address: 5XXX...`. The node continues running.

3. **Keep the Terminal Open**:
   - The script keeps the node running. Open a new terminal for the next steps.

### 2. Build and Serve the Frontend
The `frontend.sh` script builds the frontend and serves it via Nginx on `http://localhost:8080`.

1. **Make the Script Executable**:
   ```bash
   chmod +x frontend.sh
   ```

2. **Run the Script**:
   ```bash
   ./frontend.sh
   ```
   - **What it does**:
     - Installs Node.js 18.x if needed.
     - Verifies contract artifacts (`governance_tracker.json`, `contract-address.js`).
     - Installs frontend dependencies (`npm install`).
     - Builds the frontend (`npm run build`).
     - Copies the build to `/var/www/html`.
     - Configures Nginx to serve on port `8080`.
     - Restarts Nginx.
   - **Output**: Look for `Nginx is serving on port 8080` and instructions to open `http://localhost:8080`.

4. **Access the Frontend**:
   - Open `http://localhost:8080` in a browser (e.g., Chrome).
   - Connect with one of the following development accounts defined by Substrate Node using Polkadot.js Extension.
     - `//Alice`:   `bottom drive obey lake curtain smoke basket hold race lonely fit walk`
     - `//Bob`  :   `buyer proud better spawn cage door dragon field question original draft skull`
     - `//Charlie`: `degree tackle suggest window test behind mesh extra shelf nuclear blush`
     - `//Dave`:    `fox panel wisdom purchase plate gorilla pluck state acid limb draft erase`
     - `//Eve`:     `bronze fuel primary one worth crisp where boring base device impact sugar`
     - `//Ferdie`:  `crop vow release combine cancel jazz crisp ranch theory congress force fence`
   - Each wallet contains 1,152,921,504,606,846,976 Plancks (~1.15 million UNITs).

### 3. Deploy on Rococo Testnet (Optional)
To deploy on Rococo instead of a local node:
1. **Get ROC Tokens**:
   - Request testnet tokens for your account from the Rococo faucet (e.g., via Polkadot Discord/matrix).
2. **Modify `start.sh`**:
   - Update the `--url` and `--suri` in the `cargo contract instantiate` command:
     ```bash
     --suri "your-seed-phrase" \
     --url wss://rococo-contracts-rpc.polkadot.io \
     ```
   - Add gas limits:
     ```bash
     --gas 100000000000 --proof-size 1000000
     ```
   - Example command:
     ```bash
     cargo contract instantiate \
       --suri "your-seed-phrase" \
       --constructor new \
       --args 1000000000000 100800 "[0, 1, 2]" \
       --url wss://rococo-contracts-rpc.polkadot.io \
       --execute \
       --verbose \
       --skip-confirm \
       --gas 100000000000 \
       --proof-size 1000000
     ```
3. **Update Frontend**:
   - Manually update `frontend/config/contract-address.js` with the Rococo contract address.
   - Serve the frontend with `frontend.sh` and connect to Rococo via Polkadot.js Extension.

## Usage

### Frontend Interface
1. **Open the Frontend**:
   - Navigate to `http://localhost:8080`.
2. **Connect Wallet**:
   - Use Polkadot.js Extension to connect with `//Alice` or other accounts (or a funded account on Rococo).
3. **Test Features**:
   - **Submit Proposal**: Enter a title and description, submit with 1 UNIT deposit.
   - **Vote For/Against**: Select `Asset 0` (UNIT/ROC) or placeholders `1`, `2`, and stake ≥1 UNIT and vote for or against the proposal.
   - **Close Vote**: As the creator or owner, close the proposal to tally votes and assign a `referendum_index` if it passes.
   - **Cancel Proposal**: Cancel an open proposal as the creator or owner.
   - **View Details**: Check proposal status, vote totals (e.g., `Asset 0: 1.00 UNIT`), and referendum index.

### Manual Testing (Polkadot.js Apps)
1. **Connect to Node**:
   - Open [Polkadot.js Apps](https://polkadot.js.org/apps/) and connect to `ws://localhost:9944` (local) or `wss://rococo-contracts-rpc.polkadot.io` (Rococo).
2. **Upload Contract**:
   - Go to “Contracts” > “Upload & deploy code”.
   - Upload `target/ink/governance_tracker.wasm` and `governance_tracker.json`.
3. **Call Messages**:
   - Query `get_supported_assets` (should return `[0, 1, 2]`).
   - Submit a proposal with `submit_proposal`.
   - Vote with `vote_for` or `vote_against` using `asset_id: 0` (UNIT/ROC).
   - Check `CrossChainMessage` events in the chain’s event log.

## Project Structure
- `lib.rs`: ink! smart contract implementing governance logic.
- `Cargo.toml`: Contract dependencies and configuration.
- `start.sh`: Script to build, deploy, and start the local node.
- `frontend.sh`: Script to build and serve the frontend.
- `frontend/main.js`: Frontend logic for interacting with the contract.
- `frontend/config/contract-address.js`: Stores the deployed contract address.
- `frontend/public/target/ink/governance_tracker.json`: Contract metadata for frontend.

## Bounty Alignment (Polkadot and Smart Contracts Sub-Track)
- **Multi-Asset Voting**:
  - Implemented in `vote_for` and `vote_against` (`lib.rs`, lines 183–257), supporting `asset_id: 0` (UNIT/ROC) and placeholders `1`, `2`.
  - Frontend displays votes per asset (e.g., `Asset 0: 1.00 UNIT`).
- **Democracy Pallet Integration**:
  - Simulated in `close_vote` (`lib.rs`, lines 260–294), assigning `referendum_index` for passing proposals.
  - `ProposalClosed` event (`lib.rs`, lines 64–68) includes `referendum_index`.
  - Frontend shows referendum status (e.g., `Referendum Submitted: Index 1`).
- **Cross-Chain Awareness**:
  - Implemented via `CrossChainMessage` events (`lib.rs`, lines 78–83) in `submit_proposal` (lines 175–179) and `close_vote` (lines 289–294).
  - Signals proposal creation and referendum submission to `target_chain: 1000`.
- **RISC-V Compatibility**:
  - Built with ink! `4.3`, ensuring compatibility with Polkadot’s PVM.

## Troubleshooting
- **Contract Build Fails**:
  - Ensure `rustc nightly` and `cargo-contract` are installed.
  - Run `cargo clean` and `cargo contract build --release`.
- **Deployment Fails**:
  - Check `start.sh` output for errors.
  - Verify `substrate-contracts-node` is running (`ws://localhost:9944`).
  - For Rococo, ensure the account has ROC tokens.
- **Frontend Errors**:
  - Run `frontend.sh` after `start.sh` to ensure artifacts exist.
  - Check browser console for JavaScript errors.
  - Verify Polkadot.js Extension is installed and connected.
- **Nginx Issues**:
  - Check `/var/log/nginx/error.log` if `http://localhost:8080` fails.
  - Ensure port `8080` is free (`sudo netstat -tuln | grep 8080`).

## Future Improvements
- **Full Democracy Pallet Integration**: Add a chain extension to call `pallet_democracy::propose`.
- **XCM Integration**: Implement XCM dispatch for `CrossChainMessage` events.
- **Real Assets**: Integrate with `pallet-assets` for non-native tokens on Rococo.
- **Enhanced Frontend**: Add event listeners for `CrossChainMessage` and improve UX.

## License
MIT License. See `LICENSE` for details.