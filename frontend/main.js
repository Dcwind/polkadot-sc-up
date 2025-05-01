import { ApiPromise, WsProvider } from '@polkadot/api';
import { web3Enable, web3Accounts, web3FromSource } from '@polkadot/extension-dapp';
import { ContractPromise } from '@polkadot/api-contract';
import { CONTRACT_ADDRESS } from './config/contract-address';

let api;
let contract;
let currentAccount;
let contractMetadata;
let minDeposit = 10_000_000_000; // Fallback value
let supportedAssets = [];

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
        provider.on('error', (err) => debugLog("WebSocket provider error", err));
        provider.on('connected', () => debugLog("WebSocket provider connected"));
        provider.on('disconnected', () => debugLog("WebSocket provider disconnected"));

        api = await ApiPromise.create({ provider });
        debugLog("API Connection successful", {
            chainName: await api.rpc.system.chain(),
            version: await api.rpc.system.version()
        });

        debugLog("Checking for injected extensions");
        const extensions = await web3Enable('Governance Tracker');
        debugLog("Extensions detected", extensions.length);

        if (extensions.length === 0) {
            debugLog("No extensions found", "Please install Polkadot{.js} extension");
            document.getElementById('connection-status').textContent = "No Polkadot extension detected";
            return;
        }

        const accounts = await web3Accounts();
        debugLog("Accounts found", accounts.length);

        if (accounts.length === 0) {
            debugLog("No accounts found", "Please create or import an account");
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

        const fetchedMinDeposit = await getMinDeposit();
        if (fetchedMinDeposit) {
            minDeposit = Number(fetchedMinDeposit);
            debugLog("Contract min_deposit", minDeposit.toString());
        } else {
            debugLog("Failed to fetch min_deposit, using fallback", minDeposit);
            alert("Warning: Could not fetch min_deposit. Using fallback value: " + minDeposit);
        }

        const assetsResult = await contract.query.getSupportedAssets(currentAccount.address, { gasLimit: api.registry.createType('WeightV2', { refTime: 50_000_000_000, proofSize: 500_000 }) });
        if (assetsResult.result.isOk) {
            supportedAssets = assetsResult.output.asOk.toJSON();
            debugLog("Supported assets", supportedAssets);
        } else {
            debugLog("Failed to fetch supported assets", assetsResult.result.toHuman());
            alert("Warning: Could not fetch supported assets.");
        }
    } catch (err) {
        debugLog("Connection process failed", err.message || err);
        document.getElementById('connection-status').textContent = `Connection failed: ${err.message || err}`;
    }
}

async function getMinDeposit() {
    try {
        const gasLimit = api.registry.createType('WeightV2', {
            refTime: 50_000_000_000,
            proofSize: 500_000
        });
        const result = await contract.query.getMinDeposit(currentAccount.address, { gasLimit });
        if (result.result.isOk) {
            debugLog("getMinDeposit result", result.output.toHuman());
            return result.output.asOk.toBigInt();
        }
        debugLog("Failed to query min_deposit", result.result.toHuman());
        return null;
    } catch (err) {
        debugLog("Error querying min_deposit", err.message || err);
        return null;
    }
}

async function getOwner() {
    try {
        const gasLimit = api.registry.createType('WeightV2', {
            refTime: 50_000_000_000,
            proofSize: 500_000
        });
        const result = await contract.query.getOwner(currentAccount.address, { gasLimit });
        if (result.result.isOk) {
            debugLog("getOwner result", result.output.toHuman());
            return result.output.asOk.toHuman();
        }
        debugLog("Failed to query owner", result.result.toHuman());
        return null;
    } catch (err) {
        debugLog("Error querying owner", err.message || err);
        return null;
    }
}

function getStakeAmount(id) {
    const stakeInput = document.getElementById(`stakeAmount-${id}`);
    if (!stakeInput || !stakeInput.value) {
        debugLog("No valid stake input found for proposal", { id, fallback: minDeposit });
        return minDeposit;
    }
    const stakeValue = parseFloat(stakeInput.value) * 1_000_000_000_000; // Convert UNIT to Planck
    if (isNaN(stakeValue) || stakeValue < minDeposit) {
        debugLog("Invalid stake amount for proposal", { id, value: stakeInput.value, fallback: minDeposit });
        return minDeposit;
    }
    return BigInt(stakeValue);
}

function getSelectedAsset(id) {
    const assetSelect = document.getElementById(`assetSelect-${id}`);
    return assetSelect ? parseInt(assetSelect.value) : supportedAssets[0] || 0;
}

async function estimateGasForSubmitProposal(title, description) {
    try {
        const { gasRequired } = await contract.query.submitProposal(
            currentAccount.address,
            { value: minDeposit, gasLimit: api.registry.createType('WeightV2', { refTime: 10_000_000_000_000, proofSize: 10_000_000 }) },
            title,
            description
        );
        debugLog("Estimated gas for submitProposal", gasRequired.toHuman());
        return gasRequired;
    } catch (err) {
        debugLog("Gas estimation failed", err.message || err);
        return null;
    }
}

async function submitProposal() {
    try {
        const title = document.getElementById('title').value;
        const description = document.getElementById('description').value;
        if (!title || !description) {
            alert("Title and description are required.");
            return;
        }
        const gasLimit = await estimateGasForSubmitProposal(title, description);
        if (!gasLimit) {
            debugLog("Submission aborted", "Gas estimation failed");
            alert("Failed to estimate gas. Check debug logs.");
            return;
        }
        const { partialFee } = await contract.tx
            .submitProposal({ value: minDeposit, gasLimit, storageDepositLimit: 10_000_000_000_000 }, title, description)
            .paymentInfo(currentAccount.address);
        debugLog("Estimated fee", partialFee.toHuman());
        debugLog("Submitting proposal with", { title, description, value: minDeposit });
        const injector = await web3FromSource(currentAccount.meta.source);
        await contract.tx
            .submitProposal({ value: minDeposit, gasLimit, storageDepositLimit: 10_000_000_000_000 }, title, description)
            .signAndSend(currentAccount.address, { signer: injector.signer }, (result) => {
                if (result.status.isInBlock) {
                    debugLog("Transaction in block", result.status.asInBlock.toHex());
                }
                if (result.status.isFinalized) {
                    debugLog("Transaction finalized", result.status.asFinalized.toHex());
                    let hasError = false;
                    let contractEmitted = false;
                    let proposalCreated = false;
                    let submissionFailedError = null;
                    result.events.forEach(({ event }) => {
                        debugLog("Event", `${event.section}:${event.method}::${event.data}`);
                        if (event.section === 'system' && event.method === 'ExtrinsicFailed') {
                            hasError = true;
                            const errorData = event.data.toHuman();
                            errorMessage = JSON.stringify(errorData);
                            debugLog("Vote transaction failed", errorData);
                        }
                        if (event.section === 'contracts' && event.method === 'ContractEmitted') {
                            contractEmitted = true;
                        }
                        if (event.section === 'system' && event.method === 'ExtrinsicSuccess') {
                            proposalCreated = contractEmitted && true;
                        }
                    });
                    if (hasError) {
                        const errorMsg = submissionFailedError ? `Failed to submit proposal: ${submissionFailedError}` : "Failed to submit proposal: Transaction reverted.";
                        alert(errorMsg + " Check debug logs.");
                    } else if (!proposalCreated) {
                        alert("Proposal submission may have failed: No ProposalCreated event detected.");
                    } else {
                        debugLog("Proposal submitted successfully");
                        document.getElementById('title').value = '';
                        document.getElementById('description').value = '';
                        loadProposals();
                    }
                }
            });
    } catch (err) {
        debugLog("Proposal submission failed", err.message || err);
        alert("Error submitting proposal: " + (err.message || err));
    }
}

async function loadProposals() {
    try {
        const gasLimit = api.registry.createType('WeightV2', {
            refTime: 50_000_000_000,
            proofSize: 500_000
        });

        const contractOwner = await getOwner();
        debugLog("Contract owner", contractOwner);

        const countResult = await contract.query.getProposalCount(
            currentAccount.address,
            { gasLimit }
        );

        if (!countResult.result.isOk) {
            debugLog("getProposalCount failed", countResult.result.toHuman());
            alert("Failed to query proposal count. Check debug logs.");
            return;
        }

        const proposalCount = countResult.output.asOk.toNumber();
        debugLog("Parsed proposalCount", proposalCount);

        const proposalsList = document.getElementById('proposalsList');
        proposalsList.innerHTML = '';

        if (proposalCount === 0) {
            proposalsList.innerHTML = '<p>No proposals found.</p>';
            return;
        }

        for (let i = 0; i < proposalCount; i++) {
            const proposalResult = await contract.query.getProposal(
                currentAccount.address,
                { gasLimit },
                i
            );

            if (proposalResult.result.isOk) {
                const proposal = proposalResult.output.asOk.toJSON();
                debugLog(`Raw proposal JSON`, { id: i, data: proposal });

                // Compute total votes client-side
                const votes = {};
                const votesAgainst = {};
                for (const assetId of supportedAssets) {
                    votes[assetId] = 0;
                    votesAgainst[assetId] = 0;
                }

                const votersResult = await contract.query.getVoters(
                    currentAccount.address,
                    { gasLimit },
                    i
                );
                let forVoters = [];
                let againstVoters = [];
                if (votersResult.result.isOk) {
                    const [forVoterList, againstVoterList] = votersResult.output.asOk.toJSON();
                    for (const wallet of forVoterList) {
                        for (const assetId of supportedAssets) {
                            const stakeResult = await contract.query.getVoterStakes(
                                currentAccount.address,
                                { gasLimit },
                                i,
                                wallet,
                                assetId
                            );
                            if (stakeResult.result.isOk) {
                                const [forStake, _] = stakeResult.output.asOk.toJSON();
                                if (forStake > 0) {
                                    forVoters.push({ wallet, stake: (forStake / 1_000_000_000_000).toFixed(2), assetId });
                                    votes[assetId] += forStake / 1_000_000_000_000;
                                }
                            }
                        }
                    }
                    for (const wallet of againstVoterList) {
                        for (const assetId of supportedAssets) {
                            const stakeResult = await contract.query.getVoterStakes(
                                currentAccount.address,
                                { gasLimit },
                                i,
                                wallet,
                                assetId
                            );
                            if (stakeResult.result.isOk) {
                                const [_, againstStake] = stakeResult.output.asOk.toJSON();
                                if (againstStake > 0) {
                                    againstVoters.push({ wallet, stake: (againstStake / 1_000_000_000_000).toFixed(2), assetId });
                                    votesAgainst[assetId] += againstStake / 1_000_000_000_000;
                                }
                            }
                        }
                    }
                }

                debugLog(`Voter stakes`, { id: i, forVoters, againstVoters });

                const isCreator = proposal.creator === currentAccount.address;
                const isOwner = contractOwner === currentAccount.address;
                const isClosed = proposal.closed;

                const forVotersText = forVoters.length > 0
                    ? forVoters.map(v => `${v.wallet}: ${v.stake} UNIT (Asset ${v.assetId})`).join('<br>')
                    : 'None';
                const againstVotersText = againstVoters.length > 0
                    ? againstVoters.map(v => `${v.wallet}: ${v.stake} UNIT (Asset ${v.assetId})`).join('<br>')
                    : 'None';
                const votesText = supportedAssets.map(id => `Asset ${id}: ${votes[id].toFixed(2)} UNIT`).join('<br>');
                const votesAgainstText = supportedAssets.map(id => `Asset ${id}: ${votesAgainst[id].toFixed(2)} UNIT`).join('<br>');

                const referendumText = proposal.referendumIndex
                    ? `Referendum Submitted: Index ${proposal.referendumIndex}`
                    : 'No Referendum Submitted';

                const proposalElement = document.createElement('div');
                proposalElement.className = 'proposal';
                proposalElement.innerHTML = `
                    <h3>${proposal.title}</h3>
                    <p>${proposal.description}</p>
                    <p><strong>Votes For:</strong><br>${votesText}</p>
                    <p><strong>Votes Against:</strong><br>${votesAgainstText}</p>
                    <p><strong>Creator:</strong> ${proposal.creator}</p>
                    <p><strong>Supporters For:</strong><br>${forVotersText}</p>
                    <p><strong>Supporters Against:</strong><br>${againstVotersText}</p>
                    <p><strong>Status:</strong> ${isClosed ? `Closed (${proposal.result || 'Cancelled'})` : 'Open'}</p>
                    <p><strong>Deadline:</strong> Block ${proposal.deadline}</p>
                    <p><strong>Referendum:</strong> ${referendumText}</p>
                    ${isClosed ? '' : `
                        <select id="assetSelect-${i}">
                            ${supportedAssets.map(id => `<option value="${id}">Asset ${id}</option>`).join('')}
                        </select>
                        <input type="number" id="stakeAmount-${i}" placeholder="Stake amount" step="0.1" min="${minDeposit / 1_000_000_000_000}">
                        <button class="vote-for-button" data-id="${i}">Vote For</button>
                        <button class="vote-against-button" data-id="${i}">Vote Against</button>
                        ${(isCreator || isOwner) ? `<button class="close-vote-button" data-id="${i}">Close Vote</button>` : ''}
                    `}
                `;
                proposalsList.appendChild(proposalElement);

                if (!isClosed) {
                    proposalElement.querySelector('.vote-for-button').addEventListener('click', () => {
                        voteOnProposal(i, true);
                    });
                    proposalElement.querySelector('.vote-against-button').addEventListener('click', () => {
                        voteOnProposal(i, false);
                    });
                    if (isCreator || isOwner) {
                        proposalElement.querySelector('.close-vote-button').addEventListener('click', () => {
                            closeVote(i);
                        });
                    }
                }
            } else {
                debugLog(`Failed to load proposal`, { id: i, error: proposalResult.result.toHuman() });
                alert(`Failed to load proposal ${i}. Check debug logs.`);
            }
        }
    } catch (err) {
        debugLog("Loading proposals failed", err.message || err);
        alert("Error loading proposals: " + (err.message || err));
    }
}

async function voteOnProposal(id, inFavor = true) {
    try {
        debugLog("Preparing to vote on proposal", { id, inFavor });

        if (!contract || !api || !currentAccount) {
            debugLog("Voting failed", "Contract, API, or account not initialized");
            alert("Cannot vote: Contract or account not initialized.");
            return;
        }

        if (!api.isConnected) {
            debugLog("Voting failed", "API is not connected");
            alert("Cannot vote: API is not connected. Please reconnect.");
            return;
        }

        const voteAmount = getStakeAmount(id);
        const assetId = getSelectedAsset(id);
        debugLog(`Voting ${inFavor ? 'in favor of' : 'against'} proposal`, { id, amount: voteAmount.toString(), assetId });

        const gasLimit = api.registry.createType('WeightV2', {
            refTime: 200_000_000_000,
            proofSize: 2_000_000
        });

        const method = inFavor ? 'voteFor' : 'voteAgainst';
        const { partialFee } = await contract.tx[method]({ value: voteAmount, gasLimit }, id, assetId)
            .paymentInfo(currentAccount.address);
        debugLog(`Estimated fee for ${method}`, partialFee.toHuman());

        const injector = await web3FromSource(currentAccount.meta.source);
        await contract.tx[method]({ value: voteAmount, gasLimit }, id, assetId)
            .signAndSend(currentAccount.address, { signer: injector.signer }, (result) => {
                if (result.status.isInBlock) {
                    debugLog("Vote transaction in block", result.status.asInBlock.toHex());
                }
                if (result.status.isFinalized) {
                    debugLog("Vote transaction finalized", result.status.asFinalized.toHex());
                    let hasError = false;
                    let votedEvent = false;
                    let contractEmitted = false;
                    let errorMessage = null;
                    result.events.forEach(({ event }) => {
                        debugLog("Event", `${event.section}:${event.method}::${event.data}`);
                        if (event.section === 'contracts' && event.method === 'ContractEmitted') {
                            contractEmitted = true;
                        }
                        if (event.section === 'system' && event.method === 'ExtrinsicSuccess') {
                            votedEvent = contractEmitted && true;
                        }
                        if (event.section === 'system' && event.method === 'ExtrinsicFailed') {
                            hasError = true;
                            const errorDataHuman = event.data.toHuman();
                            debugLog("Transaction failed", errorDataHuman);
                            const [dispatchError] = event.data;
                            if (dispatchError.isModule) {
                                try {
                                    const metaError = api.registry.findMetaError(dispatchError.asModule);
                                    errorMessage = metaError.name || 'Unknown module error';
                                } catch (err) {
                                    debugLog("Failed to decode module error", err.message || err);
                                    errorMessage = 'Unknown module error';
                                }
                            } else if (dispatchError.isContract) {
                                const contractError = errorDataHuman.dispatchError?.Contract;
                                errorMessage = contractError ? Object.keys(contractError)[0] || 'Unknown contract error' : 'Unknown contract error';
                            } else {
                                const errorKey = Object.keys(errorDataHuman.dispatchError || {})[0];
                                errorMessage = errorKey || 'Unknown error';
                            }
                        }
                    });
                    if (hasError) {
                        alert(`Failed to vote on proposal: ${errorMessage}. Check debug logs for details.`);
                    } else if (!votedEvent) {
                        alert("Vote may have failed: No Voted event detected. Check contract state.");
                    } else {
                        debugLog("Vote submitted successfully");
                        loadProposals();
                    }
                }
            });
    } catch (err) {
        debugLog("Voting failed", err.message || err);
        alert("Error voting on proposal: " + (err.message || err));
    }
}

async function closeVote(id) {
    try {
        debugLog("Preparing to close proposal", { id });

        if (!contract || !api || !currentAccount) {
            debugLog("Close vote failed", "Contract, API, or account not initialized");
            alert("Cannot close vote: Contract or account not initialized.");
            return;
        }

        if (!api.isConnected) {
            debugLog("Close vote failed", "API is not connected");
            alert("Cannot close vote: API is not connected. Please reconnect.");
            return;
        }

        const gasLimit = api.registry.createType('WeightV2', {
            refTime: 200_000_000_000,
            proofSize: 2_000_000
        });

        const { partialFee } = await contract.tx.closeVote({ gasLimit }, id)
            .paymentInfo(currentAccount.address);
        debugLog(`Estimated fee for closeVote`, partialFee.toHuman());

        const injector = await web3FromSource(currentAccount.meta.source);
        await contract.tx.closeVote({ gasLimit }, id)
            .signAndSend(currentAccount.address, { signer: injector.signer }, (result) => {
                if (result.status.isInBlock) {
                    debugLog("Close vote transaction in block", result.status.asInBlock.toHex());
                }
                if (result.status.isFinalized) {
                    debugLog("Close vote transaction finalized", result.status.asFinalized.toHex());
                    let hasError = false;
                    let errorMessage = null;
                    result.events.forEach(({ event }) => {
                        debugLog("Event", `${event.section}:${event.method}::${event.data}`);
                        if (event.section === 'system' && event.method === 'ExtrinsicFailed') {
                            hasError = true;
                            const errorData = event.data.toHuman();
                            debugLog("Close vote transaction failed", errorData);
                            if (errorData.dispatchError) {
                                const { dispatchError } = errorData;
                                if (dispatchError.Module) {
                                    const { index, error } = dispatchError.Module;
                                    const metaError = api.registry.findMetaError({
                                        index: parseInt(index),
                                        error: parseInt(error, 16)
                                    });
                                    errorMessage = metaError.name || 'Unknown module error';
                                } else if (dispatchError.Contract) {
                                    const errorType = Object.keys(dispatchError.Contract)[0];
                                    errorMessage = errorType || 'Unknown contract error';
                                } else {
                                    errorMessage = Object.keys(dispatchError)[0] || 'Unknown error';
                                }
                            } else {
                                errorMessage = 'Unknown error';
                            }
                        }
                        if (event.section === 'contracts' && event.method === 'ContractEmitted') {
                            debugLog("ProposalClosed event detected", event.data);
                        }
                    });
                    if (hasError) {
                        alert(`Failed to close proposal: ${errorMessage}. Check debug logs for details.`);
                    } else {
                        debugLog("Close vote submitted successfully");
                        loadProposals();
                    }
                }
            });
    } catch (err) {
        debugLog("Close vote failed", err.message || err);
        alert("Error closing proposal: " + (err.message || err));
    }
}

document.getElementById('connectWallet').addEventListener('click', connect);
document.getElementById('submitProposal').addEventListener('click', submitProposal);
document.getElementById('loadProposals').addEventListener('click', loadProposals);