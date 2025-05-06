#!/bin/bash

# Set PATH to include Rust toolchain and substrate-contracts-node
export PATH="$PATH:$HOME/.cargo/bin:/usr/local/bin:/usr/bin"

# Verify substrate-contracts-node
if ! command -v substrate-contracts-node &> /dev/null; then
    echo "Error: substrate-contracts-node not found in PATH"
    echo "PATH: $PATH"
    ls -l /usr/local/bin/substrate-contracts-node /usr/local/bin/substrate 2>/dev/null || echo "Binary not found"
    exit 1
fi

# Ensure netcat is installed
if ! command -v nc &> /dev/null; then
    echo "Installing netcat..."
    apt-get update && apt-get install -y netcat-openbsd
fi

# Build the contract to ensure artifacts exist
echo "Building contract..."
cargo contract build --release --verbose
if [ $? -ne 0 ]; then
    echo "Error: Contract build failed"
    exit 1
fi

# Verify artifacts
CONTRACT_FILE="$(pwd)/target/ink/governance_tracker.contract"
echo "Using contract file: $CONTRACT_FILE"
if [ ! -f "$CONTRACT_FILE" ]; then
    echo "Error: Contract file $CONTRACT_FILE not found"
    ls -lR target/ink
    exit 1
fi

# Start the node in the background
echo "Starting substrate-contracts-node..."
substrate-contracts-node --dev --rpc-cors=all --rpc-methods=unsafe --rpc-external &
NODE_PID=$!

# Wait for node to be ready
echo "Waiting for node to be ready..."
for i in {1..30}; do
    if nc -z localhost 9944 2>/dev/null; then
        echo "Node is ready on port 9944"
        break
    fi
    echo "Waiting for node ($i/30)..."
    sleep 2
done
if ! nc -z localhost 9944 2>/dev/null; then
    echo "Error: Node failed to start on port 9944"
    kill $NODE_PID
    exit 1
fi

# Deploy the contract with verbose output and no confirmation prompt
echo "Deploying contract..."
TEMP_OUTPUT=$(mktemp)
cargo contract instantiate \
  --suri //Alice \
  --constructor new \
  --args 1000000000000 100800 "[0, 1, 2]" \
  --url ws://localhost:9944 \
  --execute \
  --verbose \
  --skip-confirm 2>&1 | tee "$TEMP_OUTPUT"
if [ $? -ne 0 ]; then
    echo "Error: Contract deployment failed"
    cat "$TEMP_OUTPUT"
    kill $NODE_PID
    rm -f "$TEMP_OUTPUT"
    exit 1
fi

# Read captured output
DEPLOYMENT_OUTPUT=$(cat "$TEMP_OUTPUT")
rm -f "$TEMP_OUTPUT"
echo "Deployment output:"
echo "$DEPLOYMENT_OUTPUT"

# Extract the contract address
CONTRACT_ADDRESS=$(echo "$DEPLOYMENT_OUTPUT" | grep -oP '(?<=Contract )[a-zA-Z0-9]+' || echo "")
echo "Contract address extraction result: '$CONTRACT_ADDRESS'"

# If deployment successful
if [ ! -z "$CONTRACT_ADDRESS" ]; then
    echo "Contract deployed successfully at address: $CONTRACT_ADDRESS"
    
    # Create directory for frontend to pick up address
    mkdir -p frontend/config
    echo "export const CONTRACT_ADDRESS = \"$CONTRACT_ADDRESS\";" > frontend/config/contract-address.js
    
    # Copy metadata to frontend
    mkdir -p frontend/public/target/ink
    cp target/ink/governance_tracker.json frontend/public/target/ink/
    echo "Copied metadata to frontend/public/target/ink/governance_tracker.json"
    
    # Keep the node running
    wait $NODE_PID
else
    echo "Contract deployment failed - detailed output above"
    kill $NODE_PID
    exit 1
fi