#!/bin/bash

# Navigate to project root
cd ~/Documents/polkadot || { echo "Error: Directory ~/Documents/polkadot not found"; exit 1; }

# Verify Node.js version (requires 14.18+, 16+, or 18+ for Vite)
NODE_MAJOR_VERSION=$(node --version 2>/dev/null | cut -d. -f1 | cut -c2-)
if [ -z "$NODE_MAJOR_VERSION" ] || [ "$NODE_MAJOR_VERSION" -lt 16 ]; then
    echo "Installing Node.js 18.x (required for Vite)..."
    sudo apt-get update
    sudo apt-get remove -y nodejs npm
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi
node --version || { echo "Error: Node.js not installed correctly"; exit 1; }
npm --version || { echo "Error: npm not installed correctly"; exit 1; }

# Verify Nginx
if ! command -v nginx &> /dev/null; then
    echo "Installing Nginx..."
    sudo apt-get update && sudo apt-get install -y nginx
fi
nginx -v || { echo "Error: Nginx not installed correctly"; exit 1; }

# Verify contract artifacts
echo "Checking contract artifacts..."
if [ ! -f "frontend/public/target/ink/governance_tracker.json" ] || [ ! -f "frontend/config/contract-address.js" ]; then
    echo "Error: Contract artifacts missing. Run ./start.sh first."
    ls -l frontend/public/target/ink frontend/config 2>/dev/null
    exit 1
fi
echo "Artifacts found:"
ls -l frontend/public/target/ink/governance_tracker.json frontend/config/contract-address.js

# Build frontend
echo "Building frontend..."
cd frontend || { echo "Error: frontend directory not found"; exit 1; }
rm -rf node_modules package-lock.json  # Clean dependencies
npm install || { echo "Error: npm install failed"; exit 1; }
npm run build || { echo "Error: npm run build failed"; exit 1; }
cd ..

# Verify build output
if [ ! -d "frontend/dist" ]; then
    echo "Error: Build output (frontend/dist) not found"
    exit 1
fi
echo "Build output:"
ls -l frontend/dist

# Copy build to Nginx web root
echo "Copying build to /var/www/html..."
sudo rm -rf /var/www/html/* || { echo "Error: Failed to clear /var/www/html"; exit 1; }
sudo cp -r frontend/dist/* /var/www/html/ || { echo "Error: Failed to copy build to /var/www/html"; exit 1; }
echo "Web root contents:"
ls -l /var/www/html

# Configure Nginx to serve on port 8080
NGINX_CONF="/etc/nginx/sites-available/default"
if ! grep -q "listen 8080" "$NGINX_CONF" 2>/dev/null; then
    echo "Configuring Nginx to serve on port 8080..."
    sudo bash -c "cat > $NGINX_CONF" << 'EOF'
server {
    listen 8080;
    server_name localhost;

    root /var/www/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
EOF
    sudo nginx -t || { echo "Error: Nginx configuration test failed"; exit 1; }
fi

# Restart Nginx
echo "Restarting Nginx..."
sudo systemctl restart nginx || { echo "Error: Failed to restart Nginx"; exit 1; }
sudo systemctl status nginx --no-pager | head -n 10

# Verify Nginx is serving
if nc -z localhost 8080 2>/dev/null; then
    echo "Nginx is serving on port 8080"
else
    echo "Error: Nginx not serving on port 8080"
    sudo tail -n 20 /var/log/nginx/error.log
    exit 1
fi

# Instructions
echo "Frontend setup complete!"
echo "1. Ensure substrate-contracts-node is running (run './start.sh' in another terminal if needed)."
echo "2. Open http://localhost:8080 in your browser."
echo "3. Connect with //Alice (fund from //Bob: 10,000,000 UNIT via Polkadot{.js} Apps)."
echo "4. Test: Submit proposal, vote for/against, close vote, cancel proposal."