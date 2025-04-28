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

# Copy only Cargo.toml and Cargo.lock first to cache dependencies
COPY Cargo.toml Cargo.lock* ./

# Create dummy src directory with minimal content to satisfy cargo build
RUN mkdir -p src && \
    echo "fn main() {}" > src/lib.rs && \
    cargo contract build --release || true

# Now copy the actual source code
COPY . .

# Build the contract
RUN cargo contract build --release

EXPOSE 9944

# Default command to run a development node
CMD ["/usr/local/bin/substrate-contracts-node", "--dev", "--rpc-cors=all", "--rpc-methods=unsafe", "--rpc-external"]