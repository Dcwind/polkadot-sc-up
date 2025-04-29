import { ApiPromise, WsProvider } from '@polkadot/api';
import { web3Enable, web3Accounts, web3FromSource } from '@polkadot/extension-dapp';
import { ContractPromise } from '@polkadot/api-contract';

let CONTRACT_ADDRESS = "5Gq5uHMM7PMYTC29z8LS3XRY2nYUyDT6bSTGJvPCrBeZjdxV";
let api;
let contract;
let currentAccount;
let contractMetadata;

function debugLog(message, data) {
  const debugInfo = document.getElementById('debug-info');
  const logEntry = document.createElement('div');
  logEntry.style.marginBottom = '10px';
  const dataStr = data !== undefined ? (typeof data === 'object' ? JSON.stringify(data, null, 2) : data) : '';
  logEntry.innerHTML = `<strong>${message}</strong>: ${dataStr}`;
  debugInfo.appendChild(logEntry);
  console.log(message, data);
}

document.getElementById('contract-address').textContent = CONTRACT_ADDRESS;

async function connect() {
    try {
        debugLog("Starting connection process");
        document.getElementById('connection-status').textContent = "Connecting...";

        debugLog("Attempting to connect to WebSocket", 'ws://localhost:9944');
        const provider = new WsProvider('ws://localhost:9944');
        provider.on('error', (err) => debugLog("WebSocket provider error", err.message));
        provider.on('connected', () => debugLog("WebSocket provider connected"));
        provider.on('disconnected', () => debugLog("WebSocket provider disconnected"));

        api = await ApiPromise.create({ provider }).catch(err => {
            throw new Error(`Failed to create API: ${err.message}`);
        });
        debugLog("API Connection successful", {
            chainName: await api.rpc.system.chain(),
            version: await api.rpc.system.version()
        });

        debugLog("Checking for injected extensions");
        debugLog("Available injectedWeb3", window.injectedWeb3);
        const extensions = await web3Enable('Governance Tracker').catch(err => {
            throw new Error(`web3Enable failed: ${err.message}`);
        });
        debugLog("Extensions detected", extensions.length);

        if (extensions.length === 0) {
            debugLog("No extensions found", "Please install Polkadot{.js} extension or check if it's enabled");
            document.getElementById('connection-status').textContent = "No Polkadot extension detected";
            return;
        }

        const accounts = await web3Accounts().catch(err => {
            throw new Error(`web3Accounts failed: ${err.message}`);
        });
        debugLog("Accounts found", accounts.length);

        if (accounts.length === 0) {
            debugLog("No accounts found", "Please create or import an account in Polkadot{.js} extension");
            document.getElementById('connection-status').textContent = "No accounts in extension";
            return;
        }

        currentAccount = accounts[0];
        document.getElementById('accountAddress').textContent = currentAccount.address;
        document.getElementById('accountInfo').style.display = 'block';
        document.getElementById('connection-status').textContent = "Connected";
        document.getElementById('app').style.display = 'block';

        debugLog("Fetching contract metadata");
        const response = await fetch('/target/ink/governance_tracker.json');
        if (!response.ok) {
            throw new Error(`Failed to fetch metadata: ${response.statusText}`);
        }
        contractMetadata = await response.json();
        debugLog("Metadata loaded", { 
            spec_name: contractMetadata.spec.name,
            constructors: contractMetadata.spec.constructors.length
        });

        contract = new ContractPromise(api, contractMetadata, CONTRACT_ADDRESS);
        debugLog("Contract instance created");
    } catch (err) {
        debugLog("Connection process failed", err.message);
        document.getElementById('connection-status').textContent = `Connection failed: ${err.message}`;
    }
}

async function estimateGasForSubmitProposal(title, description) {
    try {
        const { gasRequired } = await contract.query.submitProposal(
            currentAccount.address,
            { value: 0, gasLimit: api.registry.createType('WeightV2', { refTime: 100_000_000_000, proofSize: 1_000_000 }) },
            title,
            description
        );
        debugLog("Estimated gas for submitProposal", gasRequired.toHuman());
        return gasRequired;
    } catch (err) {
        debugLog("Gas estimation failed", err.message);
        return null;
    }
}

async function submitProposal() {
  try {
      const title = document.getElementById('title').value;
      const description = document.getElementById('description').value;
      const gasLimit = await estimateGasForSubmitProposal(title, description);
      if (!gasLimit) {
          debugLog("Submission aborted", "Gas estimation failed");
          return;
      }
      const { partialFee } = await contract.tx
          .submitProposal({ value: 0, gasLimit, storageDepositLimit: 1000000000000 }, title, description)
          .paymentInfo(currentAccount.address);
      debugLog("Estimated fee", partialFee.toHuman());
      const injector = await web3FromSource(currentAccount.meta.source);
      await contract.tx
          .submitProposal({ value: 0, gasLimit, storageDepositLimit: 1000000000000 }, title, description)
          .signAndSend(currentAccount.address, { signer: injector.signer }, (result) => {
              if (result.status.isFinalized) {
                  debugLog("Transaction finalized", result.status.asFinalized.toHex());
                  document.getElementById('title').value = '';
                  document.getElementById('description').value = '';
                  loadProposals();
              }
          });
  } catch (err) {
      debugLog("Proposal submission failed", err.message);
      if (err.message.includes("TitleTooLong")) {
          alert("Title must be 32 bytes or less.");
      } else if (err.message.includes("DescriptionTooLong")) {
          alert("Description must be 128 bytes or less.");
      }
  }
}

async function loadProposals() {
  try {
      debugLog("Loading proposals");
      if (!contract || !api || !currentAccount) {
          debugLog("Loading failed", "Contract, API, or account not available");
          return;
      }
      
      const gasLimit = api.registry.createType('WeightV2', {
          refTime: 50_000_000_000,
          proofSize: 500_000
      });

      debugLog("Querying getProposalCount");
      const countResult = await contract.query.getProposalCount(
          currentAccount.address,
          { gasLimit }
      );
      
      debugLog("Raw countResult", countResult);
      if (!countResult.result.isOk) {
          debugLog("getProposalCount failed", countResult.result.toHuman());
          return;
      }

      const proposalCount = countResult.output.asOk.toNumber();
      debugLog("Parsed proposalCount", proposalCount);
      
      const proposalsList = document.getElementById('proposalsList');
      proposalsList.innerHTML = '';
      
      for (let i = 0; i < proposalCount; i++) {
          debugLog(`Querying getProposal`, { proposalId: i });
          const proposalResult = await contract.query.getProposal(
              currentAccount.address,
              { gasLimit },
              i
          );
          
          debugLog(`Raw proposalResult`, { proposalId: i, result: proposalResult });
          if (proposalResult.result.isOk) {
              const proposal = proposalResult.output.asOk.toJSON();
              debugLog(`Proposal`, { id: i, data: proposal });
              
              // Scale votes to UNIT (divide by 10^12)
              const scaledVotes = (proposal.votes / 1000000000000).toFixed(2);
              
              const proposalElement = document.createElement('div');
              proposalElement.className = 'proposal';
              proposalElement.innerHTML = `
                  <h3>${proposal.title}</h3>
                  <p>${proposal.description}</p>
                  <p><strong>Votes:</strong> ${scaledVotes} UNIT</p>
                  <p><strong>Creator:</strong> ${proposal.creator}</p>
                  <p><strong>Supporters:</strong> ${proposal.supporters}</p>
                  <button class="vote-button" data-id="${i}">Vote</button>
              `;
              proposalsList.appendChild(proposalElement);
              
              proposalElement.querySelector('.vote-button').addEventListener('click', () => {
                  voteOnProposal(i);
              });
          } else {
              debugLog(`Failed to load proposal`, { id: i, error: proposalResult.result.toHuman() });
          }
      }
      
      if (proposalCount === 0) {
          proposalsList.innerHTML = '<p>No proposals found.</p>';
      }
  } catch (err) {
      debugLog("Loading proposals failed", err.message);
  }
}

async function voteOnProposal(id) {
    try {
        debugLog("Preparing to vote on proposal", id);
        if (!contract || !currentAccount) {
            debugLog("Voting failed", "Contract or account not available");
            return;
        }
        
        const minVoteAmount = 1000000000000;
        
        debugLog("Voting on proposal", { id, amount: minVoteAmount });
        const injector = await web3FromSource(currentAccount.meta.source);
        
        const gasLimit = api.registry.createType('WeightV2', {
            refTime: 100_000_000_000,
            proofSize: 1_000_000
        });

        const txResult = await contract.tx
            .vote({ value: minVoteAmount, gasLimit }, id)
            .signAndSend(currentAccount.address, { signer: injector.signer }, (result) => {
                if (result.status.isInBlock) {
                    debugLog("Vote transaction in block", result.status.asInBlock.toHex());
                } else if (result.status.isFinalized) {
                    debugLog("Vote transaction finalized", result.status.asFinalized.toHex());
                    loadProposals();
                }
            });
        
        debugLog("Vote transaction submitted", txResult.toString());
    } catch (err) {
        debugLog("Voting failed", err.message);
    }
}

document.getElementById('connectWallet').addEventListener('click', connect);
document.getElementById('submitProposal').addEventListener('click', submitProposal);
document.getElementById('loadProposals').addEventListener('click', loadProposals);

fetch('/config/contract-address.js')
    .then(response => {
        if (!response.ok) {
            throw new Error("Config file not found");
        }
        return response.text();
    })
    .then(text => {
        const addressMatch = text.match(/CONTRACT_ADDRESS = "([^"]+)"/);
        if (addressMatch && addressMatch[1]) {
            const address = addressMatch[1];
            CONTRACT_ADDRESS = address;
            document.getElementById('contract-address').textContent = address;
            debugLog("Loaded contract address from config", address);
        }
    })
    .catch(err => {
        debugLog("Could not load contract address config", err.message);
    });