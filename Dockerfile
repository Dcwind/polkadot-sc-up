FROM rust:1.81

# Install dependencies for contract development
RUN apt-get update && \
    apt-get install -y curl git build-essential clang libclang-dev pkg-config libssl-dev && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install Rust tools and cargo-contract
RUN rustup component add rust-src && \
    rustup component add clippy && \
    rustup target add wasm32-unknown-unknown && \
    cargo install cargo-contract --version 3.2.0 --locked

# Create working directory
WORKDIR /contract

# Copy files individually to ensure they exist
COPY Cargo.toml ./ 
COPY lib.rs ./

# Set the CMD to build directly into the mounted volume directory
CMD bash -c "\
    cargo contract build --release --target-dir /contract/target/ink && \
    echo '✅ Contract built successfully into /contract/target/ink!'"
