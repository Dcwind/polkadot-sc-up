FROM rust:1.81

# Install required system dependencies including protobuf compiler
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    git \
    clang \
    cmake \
    libssl-dev \
    pkg-config \
    dos2unix \
    protobuf-compiler \
    && rm -rf /var/lib/apt/lists/*

# Install required Rust components
RUN rustup default 1.81 && \
    rustup component add rust-src && \
    rustup target add wasm32-unknown-unknown && \
    cargo install cargo-contract --version ^3.0.0

# Download and install substrate-contracts-node binary
RUN curl -L https://github.com/paritytech/substrate-contracts-node/releases/download/v0.42.0/substrate-contracts-node-linux.tar.gz -o substrate-contracts-node-linux.tar.gz && \
    tar -xvzf substrate-contracts-node-linux.tar.gz && \
    mv substrate-contracts-node-linux/substrate-contracts-node /usr/local/bin/ && \
    chmod +x /usr/local/bin/substrate-contracts-node && \ 
    rm substrate-contracts-node-linux.tar.gz && \
    rm -rf substrate-contracts-node-linux

WORKDIR /app

# Copy the entire project
COPY . .

# Build the contract with verbose output to debug
RUN echo $(date) && cargo contract build --release --verbose

# Copy the deployment script
COPY deploy-and-start.sh /app/
RUN dos2unix /app/deploy-and-start.sh && chmod +x /app/deploy-and-start.sh

# List artifacts directory to verify files
RUN ls -la /app/target/ink/ || echo "No artifacts directory found"
RUN find /app/target -name "*.contract" || echo "No contract files found"

# Start node, deploy contract, and copy artifacts
RUN substrate-contracts-node --dev --rpc-cors=all --rpc-methods=unsafe --rpc-external & \
    sleep 8 && \
    CONTRACT_FILE="/app/target/ink/governance_tracker.contract" && \
    if [ ! -f "$CONTRACT_FILE" ]; then \
        echo "Error: Contract file $CONTRACT_FILE not found"; \
        ls -lR /app/target/ink; \
        exit 1; \
    fi && \
    DEPLOYMENT_OUTPUT=$(cargo contract instantiate --suri //Alice --constructor new --args 1000000000000 3 100800 --url ws://localhost:9944 --execute 2>&1) && \
    echo "$DEPLOYMENT_OUTPUT" && \
    CONTRACT_ADDRESS=$(echo "$DEPLOYMENT_OUTPUT" | grep -oP '(?<=Contract )[a-zA-Z0-9]+' || echo "") && \
    echo "Contract address: $CONTRACT_ADDRESS" && \
    if [ -z "$CONTRACT_ADDRESS" ]; then \
        echo "Contract deployment failed"; \
        exit 1; \
    fi && \
    mkdir -p /app/frontend/config /app/frontend/public/target/ink && \
    echo "export const CONTRACT_ADDRESS = \"$CONTRACT_ADDRESS\";" > /app/frontend/config/contract-address.js && \
    cp /app/target/ink/governance_tracker.json /app/frontend/public/target/ink/ && \
    echo "Artifacts copied to /app/frontend"

EXPOSE 9944
CMD ["substrate-contracts-node", "--dev", "--rpc-cors=all", "--rpc-methods=unsafe", "--rpc-external"]
