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

        // Subscribe to contract events
        subscribeToEvents();
    } catch (err) {
        debugLog("Connection process failed", err.message);
        document.getElementById('connection-status').textContent = `Connection failed: ${err.message}`;
    }
}

async function estimateGas(method, value, ...args) {
    try {
        const { gasRequired } = await contract.query[method](
            currentAccount.address,
            { value, gasLimit: api.registry.createType('WeightV2', { refTime: 50_000_000_000, proofSize: 500_000 }) },
            ...args
        );
        debugLog(`Estimated gas for ${method}`, gasRequired.toHuman());
        return gasRequired;
    } catch (err) {
        debugLog(`Gas estimation for ${method} failed`, err.message);
        return null;
    }
}

async function submitProposal() {
    try {
        const title = document.getElementById('title').value;
        const description = document.getElementById('description').value;
        const gasLimit = await estimateGas('submitProposal', 1_000_000_000_000, title, description);
        if (!gasLimit) {
            debugLog("Submission aborted", "Gas estimation failed");
            return;
        }
        const { partialFee } = await contract.tx
            .submitProposal({ value: 1_000_000_000_000, gasLimit, storageDepositLimit: 1_000_000_000_000 }, title, description)
            .paymentInfo(currentAccount.address);
        debugLog("Estimated fee", partialFee.toHuman());
        const injector = await web3FromSource(currentAccount.meta.source);
        await contract.tx
            .submitProposal({ value: 1_000_000_000_000, gasLimit, storageDepositLimit: 1_000_000_000_000 }, title, description)
            .signAndSend(currentAccount.address, { signer: injector.signer }, (result) => {
                if (result.status.isFinalized) {
                    debugLog("Proposal submission finalized", result.status.asFinalized.toHex());
                    document.getElementById('title').value = '';
                    document.getElementById('description').value = '';
                    loadProposals();
                }
            });
    } catch (err) {
        debugLog("Proposal submission failed", err.message);
        if (err.message.includes("InsufficientDeposit")) {
            alert("Minimum deposit is 1 UNIT.");
        } else if (err.message.includes("TitleTooLong")) {
            alert("Title must be 32 bytes or less.");
        } else if (err.message.includes("DescriptionTooLong")) {
            alert("Description must be 128 bytes or less.");
        }
    }
}

async function voteFor(proposalId) {
    try {
        debugLog("Preparing to vote for proposal", proposalId);
        const minVoteAmount = 1_000_000_000_000;
        const gasLimit = await estimateGas('voteFor', minVoteAmount, proposalId);
        if (!gasLimit) {
            debugLog("Voting aborted", "Gas estimation failed");
            return;
        }
        const injector = await web3FromSource(currentAccount.meta.source);
        await contract.tx
            .voteFor({ value: minVoteAmount, gasLimit, storageDepositLimit: 1_000_000_000_000 }, proposalId)
            .signAndSend(currentAccount.address, { signer: injector.signer }, (result) => {
                if (result.status.isInBlock) {
                    debugLog("Vote for transaction in block", result.status.asInBlock.toHex());
                } else if (result.status.isFinalized) {
                    debugLog("Vote for transaction finalized", result.status.asFinalized.toHex());
                    loadProposals();
                }
            });
    } catch (err) {
        debugLog("Vote for failed", err.message);
        if (err.message.includes("ProposalClosed")) {
            alert("Proposal is closed.");
        } else if (err.message.includes("VotingPeriodActive")) {
            alert("Voting period has ended.");
        } else if (err.message.includes("InsufficientDeposit")) {
            alert("Minimum vote amount is 1 UNIT.");
        }
    }
}

async function voteAgainst(proposalId) {
    try {
        debugLog("Preparing to vote against proposal", proposalId);
        const minVoteAmount = 1_000_000_000_000;
        const gasLimit = await estimateGas('voteAgainst', minVoteAmount, proposalId);
        if (!gasLimit) {
            debugLog("Voting aborted", "Gas estimation failed");
            return;
        }
        const injector = await web3FromSource(currentAccount.meta.source);
        await contract.tx
            .voteAgainst({ value: minVoteAmount, gasLimit, storageDepositLimit: 1_000_000_000_000 }, proposalId)
            .signAndSend(currentAccount.address, { signer: injector.signer }, (result) => {
                if (result.status.isInBlock) {
                    debugLog("Vote against transaction in block", result.status.asInBlock.toHex());
                } else if (result.status.isFinalized) {
                    debugLog("Vote against transaction finalized", result.status.asFinalized.toHex());
                    loadProposals();
                }
            });
    } catch (err) {
        debugLog("Vote against failed", err.message);
        if (err.message.includes("ProposalClosed")) {
            alert("Proposal is closed.");
        } else if (err.message.includes("VotingPeriodActive")) {
            alert("Voting period has ended.");
        } else if (err.message.includes("InsufficientDeposit")) {
            alert("Minimum vote amount is 1 UNIT.");
        }
    }
}

async function closeVote(proposalId) {
    try {
        debugLog("Preparing to close proposal", proposalId);
        const gasLimit = await estimateGas('closeVote', 0, proposalId);
        if (!gasLimit) {
            debugLog("Close vote aborted", "Gas estimation failed");
            return;
        }
        const injector = await web3FromSource(currentAccount.meta.source);
        await contract.tx
            .closeVote({ value: 0, gasLimit, storageDepositLimit: 1_000_000_000_000 }, proposalId)
            .signAndSend(currentAccount.address, { signer: injector.signer }, (result) => {
                if (result.status.isInBlock) {
                    debugLog("Close vote transaction in block", result.status.asInBlock.toHex());
                } else if (result.status.isFinalized) {
                    debugLog("Close vote transaction finalized", result.status.asFinalized.toHex());
                    loadProposals();
                }
            });
    } catch (err) {
        debugLog("Close vote failed", err.message);
        if (err.message.includes("NotCreator")) {
            alert("Only the proposal creator can close the vote.");
        } else if (err.message.includes("VotingPeriodActive")) {
            alert("Voting period is still active.");
        } else if (err.message.includes("InsufficientSupporters")) {
            alert("Proposal needs at least 3 supporters for and against.");
        } else if (err.message.includes("AlreadyClosed")) {
            alert("Proposal is already closed.");
        }
    }
}

async function cancelProposal(proposalId) {
    try {
        debugLog("Preparing to cancel proposal", proposalId);
        const gasLimit = await estimateGas('cancelProposal', 0, proposalId);
        if (!gasLimit) {
            debugLog("Cancel proposal aborted", "Gas estimation failed");
            return;
        }
        const injector = await web3FromSource(currentAccount.meta.source);
        await contract.tx
            .cancelProposal({ value: 0, gasLimit, storageDepositLimit: 1_000_000_000_000 }, proposalId)
            .signAndSend(currentAccount.address, { signer: injector.signer }, (result) => {
                if (result.status.isInBlock) {
                    debugLog("Cancel proposal transaction in block", result.status.asInBlock.toHex());
                } else if (result.status.isFinalized) {
                    debugLog("Cancel proposal transaction finalized", result.status.asFinalized.toHex());
                    loadProposals();
                }
            });
    } catch (err) {
        debugLog("Cancel proposal failed", err.message);
        if (err.message.includes("NotCreator")) {
            alert("Only the proposal creator can cancel the proposal.");
        } else if (err.message.includes("AlreadyClosed")) {
            alert("Proposal is already closed.");
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
                const scaledVotes = (proposal.votes / 1_000_000_000_000).toFixed(2);
                const scaledVotesAgainst = (proposal.votes_against / 1_000_000_000_000).toFixed(2);
                
                const status = proposal.closed 
                    ? (proposal.result === null ? 'Cancelled' : proposal.result ? 'Passed' : 'Failed') 
                    : 'Open';
                
                const proposalElement = document.createElement('div');
                proposalElement.className = 'proposal';
                proposalElement.innerHTML = `
                    <h3>${proposal.title}</h3>
                    <p>${proposal.description}</p>
                    <p><strong>Votes For:</strong> ${scaledVotes} UNIT</p>
                    <p><strong>Votes Against:</strong> ${scaledVotesAgainst} UNIT</p>
                    <p><strong>Supporters For:</strong> ${proposal.supporter_count}</p>
                    <p><strong>Supporters Against:</strong> ${proposal.supporter_count_against}</p>
                    <p><strong>Creator:</strong> ${proposal.creator}</p>
                    <p><strong>Deadline:</strong> Block ${proposal.deadline}</p>
                    <p><strong>Status:</strong> ${status}</p>
                    <button class="vote-for-button" data-id="${i}">Vote For (1 UNIT)</button>
                    <button class="vote-against-button" data-id="${i}">Vote Against (1 UNIT)</button>
                    <button class="close-vote-button" data-id="${i}">Close Vote</button>
                    <button class="cancel-proposal-button" data-id="${i}">Cancel Proposal</button>
                `;
                proposalsList.appendChild(proposalElement);
                
                proposalElement.querySelector('.vote-for-button').addEventListener('click', () => {
                    voteFor(i);
                });
                proposalElement.querySelector('.vote-against-button').addEventListener('click', () => {
                    voteAgainst(i);
                });
                proposalElement.querySelector('.close-vote-button').addEventListener('click', () => {
                    closeVote(i);
                });
                proposalElement.querySelector('.cancel-proposal-button').addEventListener('click', () => {
                    cancelProposal(i);
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

async function subscribeToEvents() {
    try {
        debugLog("Subscribing to contract events");
        // Note: Polkadot.js API doesn't directly support contract event subscriptions
        // Using polling as a workaround
        setInterval(async () => {
            const countResult = await contract.query.getProposalCount(
                currentAccount.address,
                { gasLimit: api.registry.createType('WeightV2', { refTime: 50_000_000_000, proofSize: 500_000 }) }
            );
            if (countResult.result.isOk) {
                const newCount = countResult.output.asOk.toNumber();
                debugLog("Polling proposal count", newCount);
                if (newCount > 0) {
                    loadProposals();
                }
            }
        }, 10000); // Poll every 10 seconds
    } catch (err) {
        debugLog("Event subscription failed", err.message);
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