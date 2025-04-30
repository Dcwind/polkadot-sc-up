#!/bin/bash

# Start the node in the background
substrate-contracts-node --dev --rpc-cors=all --rpc-methods=unsafe --rpc-external &
NODE_PID=$!

# Wait for node to start
sleep 8

# Find the contract file
ls /app/
ls /app/target

CONTRACT_FILE=$(find /app/target -name "*.contract" | head -1)
echo "Found contract file: $CONTRACT_FILE"

# Deploy the contract with execution flag to actually deploy it
echo "Deploying contract..."
DEPLOYMENT_OUTPUT=$(cargo contract instantiate --suri //Alice --constructor new --args 1000000000000 --url ws://localhost:9944 $CONTRACT_FILE --execute)
echo "$DEPLOYMENT_OUTPUT"

# Now try to capture the address from the output
CONTRACT_ADDRESS=$(echo "$DEPLOYMENT_OUTPUT" | grep -oP '(?<=contract: )[a-zA-Z0-9]+' || echo "")

echo "Contract address extraction result: '$CONTRACT_ADDRESS'"

# If deployment successful
if [ ! -z "$CONTRACT_ADDRESS" ]; then
    echo "Contract deployed successfully at address: $CONTRACT_ADDRESS"
    
    # Create directory for frontend to pick up address 
    mkdir -p /app/frontend/config
    echo "export const CONTRACT_ADDRESS = \"$CONTRACT_ADDRESS\";" > /app/frontend/config/contract-address.js
    
    # Keep the node running in foreground
    wait $NODE_PID
else
    echo "Contract deployment failed - detailed output above"
    exit 1
fi