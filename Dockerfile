FROM rust:1.81

# Install required system dependencies including protobuf compiler
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    git \
    clang \
    cmake \
    libssl-dev \
    pkg-config \
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
RUN cargo contract build --release --verbose

# Copy the deployment script
COPY deploy-and-start.sh /app/
RUN chmod +x /app/deploy-and-start.sh

# List artifacts directory to verify files
RUN ls -la /app/target/ink/ || echo "No artifacts directory found"
RUN find /app/target -name "*.contract" || echo "No contract files found"

EXPOSE 9944

# Use the script as the entrypoint
CMD ["/app/deploy-and-start.sh"]