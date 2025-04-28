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

# Clone and build substrate-contracts-node from source
RUN git clone https://github.com/paritytech/substrate-contracts-node.git && \
    cd substrate-contracts-node && \
    cargo build --release && \
    cp ./target/release/substrate-contracts-node /usr/local/bin/

WORKDIR /app
COPY . .

# Build the contract
RUN cargo contract build --release

EXPOSE 9944

# Default command to run a development node
CMD ["substrate-contracts-node", "--dev", "--rpc-cors=all", "--rpc-methods=unsafe", "--rpc-external"]