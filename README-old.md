# Polkadot Governance Tracker

This is a repository that contains a submission for 2025 Polkadot Scalability Hackathon. The project is a decentralized governance smart contract built with ink! for the Polkadot ecosystem, designed for the Polkadot and Smart Contracts sub-track hackathon. The contract enables users to submit proposals, vote using multiple assets (including the native UNIT token), and simulate integration with the Polkadot Democracy pallet. It also supports cross-chain awareness by emitting events for other parachains. A JavaScript frontend (`main.js`) provides a user interface to interact with the contract, deployed on a local `substrate-contracts-node` dev testnet.

## Project Description
The Polkadot Governance Tracker is a proof-of-concept smart contract showcasing Polkadot’s capabilities in governance, multi-asset systems, and cross-chain interoperability. Built using ink! `4.3`, the contract allows users to:
- **Submit Proposals**: Create governance proposals with a title, description, and minimum deposit (1 UNIT).
- **Vote with Multiple Assets**: Support voting with the native UNIT token (`asset_id: 0`) and placeholder assets (`1`, `2`), demonstrating Polkadot’s multi-asset potential.
- **Simulate Democracy Pallet Integration**: Assign a `referendum_index` to passing proposals, mimicking submission to the Democracy pallet.
- **Emit Cross-Chain Events**: Broadcast `CrossChainMessage` events to other parachains (e.g., `target_chain: 1000`) for proposal creation and referendum submission.
- **Interact via Frontend**: A Vite-based JavaScript frontend (`main.js`) enables users to manage proposals, vote, and view referendum status through a web interface served on `http://localhost:8080`.

The contract is deployed using `substrate-contracts-node` for local testing on a development testnet, leveraging Polkadot’s RISC-V-compatible Virtual Machine (PVM). The project addresses the hackathon’s goals by integrating governance, multi-asset voting, and cross-chain awareness, with a user-friendly frontend to enhance accessibility.

## Demo Video incl. Screenshots
[Please find the demo video here on YouTube.](https://youtu.be/7j9jQTNGkIY)

## Features
- **Proposal Management**: Users can submit, vote on, close, or cancel governance proposals.
- **Multi-Asset Voting**: Supports voting with multiple assets (e.g., native UNIT as `asset_id: 0`, and placeholder assets `1`, `2`).
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
- **Polkadot.js Wallet Extension**:
  - For simulating interactions with the smart contract.
- **Contract Dependencies** (specified in `Cargo.toml`):
  - `ink` (version `4.3`).
  - `parity-scale-codec` (version `3`, with `derive` feature).
  - `scale-info` (version `2.9`, with `derive` feature).

### System Requirements
- Linux OS (tested on Ubuntu 20.04/22.04).
- At least 4GB RAM and 20GB free disk space.
- Internet connection for installing dependencies.

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
       - `min_deposit`: `1000000000000` Planck (1 UNIT).
       - `voting_period`: `100800` blocks (~7 days at 6 seconds/block).
       - `supported_assets`: `[0, 1, 2]` (native UNIT as `0`, placeholders `1`, `2`).
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

3. **Access the Frontend**:
   - Open `http://localhost:8080` in a browser (e.g., Chrome).
   - Open RPC tracker at `https://polkadot.js.org/apps/?rpc=ws://localhost:9944#/accounts` in a separate tab to move funds to simulate the governance tracker system.

## Usage

### Frontend Interface
1. **Open the Frontend**:
   - Navigate to `http://localhost:8080`.
2. **Connect Wallet**:
   - Use Polkadot.js Extension to connect with an account.
3. **Fund Wallet**:
   - In the first run, the wallet is empty.
   - To fund the wallet, open `https://polkadot.js.org/apps/?rpc=ws://localhost:9944#/accounts`.
   - Click "Send" on any default dev account.
   - In the "send to address" field, enter the wallet’s address.
   - In the "amount" field, enter the desired amount to fund (ideally 1,000,000).
   - Click "Make Transfer" then "Sign and Submit".
   - The wallet is ready to interact with the contract.
4. **Test Features**:
   - **Submit Proposal**: Enter a title and description, submit with 1 UNIT deposit.
   - **Vote For/Against**: Select `Asset 0` (UNIT) or placeholders `1`, `2`, and stake ≥1 UNIT and vote for or against the proposal. A wallet can vote as many times as possible, given each stake is more than 1 UNIT and its balance suffices.
   - **Close Vote**: As the creator or owner, close the proposal to tally votes.
   - **Cancel Proposal**: Cancel an open proposal as the creator or owner.
   - **View Details**: Check proposal status, vote totals (e.g., `Asset 0: 1.00 UNIT`), and referendum index (referendum index not implemented). Possible proposal statuses are as follows:
     - Open: proposal is open to votes.
     - Closed (in favor): proposal is finalized and accepted by consensus.
     - Closed (against): proposal is finalized and rejected by consensus.
     - Closed (indecision): proposal is closed and did not reach consensus.
5. **Test Interaction with Other Wallets**:
   - Create other wallets to simulate multiple parties' votes to the proposal.

### Manual Testing (Polkadot.js Apps)
1. **Connect to Node**:
   - Open [Polkadot.js Apps](https://polkadot.js.org/apps/) and connect to `ws://localhost:9944`.
2. **Upload Contract**:
   - Go to “Contracts” > “Upload & deploy code”.
   - Upload `target/ink/governance_tracker.wasm` and `governance_tracker.json`.
3. **Call Messages**:
   - Query `get_supported_assets` (should return `[0, 1, 2]`).
   - Submit a proposal with `submit_proposal`.
   - Vote with `vote_for` or `vote_against` using `asset_id: 0` (UNIT).
   - Check `CrossChainMessage` events in the chain’s event log.

## Project Structure
- `lib.rs`: ink! smart contract implementing governance logic.
- `Cargo.toml`: Contract dependencies and configuration.
- `start.sh`: Script to build, deploy, and start the local node.
- `frontend.sh`: Script to build and serve the frontend.
- `frontend/main.js`: Frontend logic for interacting with the contract.
- `frontend/config/contract-address.js`: Stores the deployed contract address.
- `frontend/public/target/ink/governance_tracker.json`: Contract metadata for frontend (automatically generated).

## Hackathon Submission Details

### Source Code
- Repository: [https://github.com/Dcwind/polkadot-sc-up](https://github.com/Dcwind/polkadot-sc-up)
- Key Files:
  - Contract: `lib.rs`
  - Scripts: `start.sh`, `frontend.sh`
  - Frontend: `frontend/main.js`

### AI Tools Used
- **Claude AI Sonnet 3.7**: for template generation.
- **Grok 3**: for debugging, content, and scripts generation.
- **ChatGPT-4-turbo**: for proofreading and optimization.

### References and Citations
- **ink! Documentation**:
  - [ink! Official Documentation](https://use.ink/) for contract development, storage, and event handling.
  - [ink! Examples](https://github.com/paritytech/ink-examples) for reference on `Mapping` and events.
- **Polkadot/Substrate Documentation**:
  - [Polkadot Wiki - Smart Contracts](https://wiki.polkadot.network/docs/learn-smart-contracts) for PVM and ink! basics.
  - [Substrate Contracts Node](https://github.com/paritytech/substrate-contracts-node) for local node setup.
  - [Polkadot.js API](https://polkadot.js.org/docs/api) for frontend integration with `@polkadot/api` and `@polkadot/extension-dapp`.
- **Multi-Asset and Governance**:
  - [Pallets](https://docs.substrate.io/reference/frame-pallets/) for multi-asset concepts and governance simulation.

### Code Attribution
- No external code was directly reused from other sources.
- The contract (`lib.rs`) was built from scratch, inspired by ink! examples (e.g., storage mappings, events) but customized for governance and multi-asset voting.
- The frontend (`main.js`) uses `@polkadot/api` and `@polkadot/extension-dapp` libraries, with logic adapted from Polkadot.js documentation examples.
- Scripts (`start.sh`, `frontend.sh`) were generated with AI assistance (Grok 3) tailored to the project’s requirements.

### Developer Experience (DevEx) on Polkadot Smart Contracts
- **Strengths**:
  - **ink! Ergonomics**: The Rust-based DSL simplifies contract development with macros (`#[ink::contract]`) and abstractions like `Mapping` and events, making it approachable for Rust developers. Its verbosity seems to bring benefit in terms of code and logic correctness.
  - **Polkadot.js Ecosystem**: The `@polkadot/api` and `@polkadot/extension-dapp` libraries enabled seamless frontend integration, particularly for wallet connections and contract interactions.
  - **Local Development**: `substrate-contracts-node --dev` provided a fast, pre-funded environment (e.g., `//Alice`, `//Bob`) for testing, reducing setup friction.
  - **Community Resources**: The Polkadot Wiki and ink! documentation offered clear starting points for contract structure and deployment.
- **Middle Ground**:
  - **Debugging Tooling**: Error messages in `cargo-contract` are often clear and very structured (shown by the error codes), yet sometimes obscure. For example, an error like `Invalid metadata: expected type InkEvent, found Enum` during contract compilation was precise about the issue (mismatched event metadata) but lacked context on how to resolve it (e.g., checking `#[ink(event)]` annotations). This required cross-referencing forums and GitHub issues.
- **Challenges**:
  - **PAPI (polkadot-api) learning curve**: the project was supposed to use pure PAPI rather than the currently implemented server in Vite, due to the Polkadot API having many special concepts unfamiliar to non-Polkadot developers.
  - **Slow compilation time**: Compiling and building projects, as apparent in Rust development, are slower than Solidity.
  - **Chain Extension Limitations**: Simulating Democracy pallet integration was constrained without chain extensions, which are complex and underdocumented.
  - **Polkadot.{js}** browser extension shows no details about the wallet (multi-asset balance), list of transactions, etc.
  - **Access to Wallet Information**: the project was supposed to have a function that pulls information about a wallet (balance, transactions), but it was rather difficult to find out how to perform such an action.
  - **Non-UNIX support**: developing on Windows-based machines require WSL integration due to some library prerequisites relying on UNIX-only commands. The discrepancy between Windows and WSL file systems sometimes broke development pipeline.
- **Overall**: ink! and Polkadot provide a powerful platform for smart contracts, but the DevEx would benefit from more beginner-friendly tools and documentation to broaden adoption.

### Suggestions for Polkadot Tooling and Documentation
- **Tooling Improvements**:
  - **Clearer Error Messages**: Enhance `cargo-contract` to provide descriptive errors (e.g., for encoding issues like `UInt cannot be encoded as an array`) with suggested fixes. It is also beneficial to develop a `cargo-contract` debug mode to trace contract execution and storage changes.
  - **Gas Estimation Tool**: Add a `cargo-contract` feature to estimate gas limits for deployment and calls, minimizing manual tuning.
  - **Frontend Templates**: Offer official Vite/React templates for Polkadot.js-based frontends to simplify UI development.
  - **Polkadot.{js} Extension**: provide users with more detailed information regarding accounts, for example, multi-asset wallet balance, list of transactions, and more seamless integration with dApps. Compare Metamask.
- **Documentation Enhancements**:
  - **Comprehensive Tutorials**: Create end-to-end guides covering prerequisite installation both in UNIX-based system and Windows (Docker, etc.), contract development, frontend integration, and local testing in a single workflow. A guide to integrate PAPI with frontend would also help onboarding newcomers to implementing PAPI in projects that require backend and frontend.
  - **Chain Extension Examples**: Provide detailed tutorials on building chain extensions for pallets like `pallet_democracy` and `pallet-assets`.
  - **Error Troubleshooting**: Add a dedicated section in the ink! docs for common errors (e.g., Rust ownership, metadata issues).
  - **Multi-Asset Integration**: Include ink! examples for interacting with `pallet-assets` to support real tokens beyond UNIT.

## Bounty Alignment (Polkadot and Smart Contracts Sub-Track)
- **Multi-Asset Voting**:
  - Simulated in `vote_for` and `vote_against` (`lib.rs`, lines 183–257), supporting `asset_id: 0` (UNIT) and placeholders `1`, `2`.
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
- **Real Assets**: Integrate with `pallet-assets` for non-native tokens.
- **More Balanced Staking System**: refundable staking instead of 'paying to vote' and never get the staked fund back.
- **Enhanced Frontend**: Add event listeners for `CrossChainMessage` and improve UX.

## License
MIT License. See `LICENSE` for details.

## Contact
For questions or contributions, contact Damian Satya at [umumlar5@gmail.com].