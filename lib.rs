#![cfg_attr(not(feature = "std"), no_std, no_main)]

#[ink::contract]
#[allow(unexpected_cfgs)]
mod governance_tracker {
    use ink::prelude::{string::String, vec::Vec};
    use ink::storage::Mapping;
    extern crate alloc;
    use alloc::{format, string::ToString};

    /// Proposal struct
    #[derive(scale::Decode, scale::Encode)]
    #[cfg_attr(
        feature = "std",
        derive(scale_info::TypeInfo, ink::storage::traits::StorageLayout)
    )]
    pub struct Proposal {
        title: String,
        description: String,
        creator: AccountId,
        supporter_count: u32,        // Number of vote instances for
        supporter_count_against: u32,// Number of vote instances against
        closed: bool,
        result: Option<String>,      // "In Favor", "Against", or "Indecision" when closed
        deadline: BlockNumber,       // Voting deadline
        for_voters: Vec<AccountId>,  // List of voters in favor
        against_voters: Vec<AccountId>, // List of voters against
        referendum_index: Option<u32>, // Index of submitted referendum (if any)
    }

    #[ink(storage)]
    pub struct GovernanceTracker {
        proposals: Mapping<u32, Proposal>,
        proposal_count: u32,
        min_deposit: Balance,        // Minimum deposit for voting (native token)
        voting_period: BlockNumber,  // Voting duration
        owner: AccountId,            // Contract owner
        voter_stakes: Mapping<(u32, AccountId, bool, u32), Balance>, // (proposal_id, voter, in_favor, asset_id) -> stake
        supported_assets: Vec<u32>,  // List of supported asset IDs
    }

    #[derive(scale::Decode, scale::Encode)]
    #[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
    pub enum Error {
        ProposalNotFound,
        ProposalClosed,
        InsufficientDeposit,
        NotCreator,
        NotOwner,
        VotingPeriodEnded,
        AlreadyClosed,
        InvalidAsset,
        ReferendumSubmissionFailed,
    }

    /// Events
    #[ink(event)]
    pub struct ProposalCreated {
        #[ink(topic)]
        proposal_id: u32,
        creator: AccountId,
        title: String,
    }

    #[ink(event)]
    pub struct Voted {
        #[ink(topic)]
        proposal_id: u32,
        voter: AccountId,
        in_favor: bool,
        amount: Balance,
        asset_id: u32,
    }

    #[ink(event)]
    pub struct ProposalClosed {
        #[ink(topic)]
        proposal_id: u32,
        result: Option<String>,
        referendum_index: Option<u32>,
    }

    #[ink(event)]
    pub struct ProposalCancelled {
        #[ink(topic)]
        proposal_id: u32,
    }

    #[ink(event)]
    pub struct ProposalSubmissionFailed {
        #[ink(topic)]
        proposal_id: u32,
        error: Error,
    }

    #[ink(event)]
    pub struct CrossChainMessage {
        #[ink(topic)]
        proposal_id: u32,
        target_chain: u32, // Parachain ID
        message: String,
    }

    impl GovernanceTracker {
        /// Constructor
        #[ink(constructor)]
        pub fn new(min_deposit: Balance, voting_period: BlockNumber, supported_assets: Vec<u32>) -> Self {
            let caller = Self::env().caller();
            Self {
                proposals: Mapping::default(),
                proposal_count: 0,
                min_deposit,
                voting_period,
                owner: caller,
                voter_stakes: Mapping::default(),
                supported_assets,
            }
        }

        /// Get minimum deposit
        #[ink(message)]
        pub fn get_min_deposit(&self) -> Balance {
            self.min_deposit
        }

        /// Get owner
        #[ink(message)]
        pub fn get_owner(&self) -> AccountId {
            self.owner
        }

        /// Get supported assets
        #[ink(message)]
        pub fn get_supported_assets(&self) -> Vec<u32> {
            self.supported_assets.clone()
        }

        /// Submit a new proposal
        #[ink(message, payable)]
        pub fn submit_proposal(&mut self, title: String, description: String) -> Result<(), Error> {
            let caller = self.env().caller();
            let value = self.env().transferred_value();
            if value < self.min_deposit {
                self.env().emit_event(ProposalSubmissionFailed {
                    proposal_id: self.proposal_count,
                    error: Error::InsufficientDeposit,
                });
                return Err(Error::InsufficientDeposit);
            }
            let current_block = self.env().block_number();
            let proposal = Proposal {
                title: title.clone(), // Clone title to avoid moving it
                description,
                creator: caller,
                supporter_count: 0,
                supporter_count_against: 0,
                closed: false,
                result: None,
                deadline: current_block + self.voting_period,
                for_voters: Vec::new(),
                against_voters: Vec::new(),
                referendum_index: None,
            };
            let proposal_id = self.proposal_count;
            self.proposals.insert(proposal_id, &proposal);
            self.proposal_count += 1;
            self.env().emit_event(ProposalCreated {
                proposal_id,
                creator: caller,
                title: title.clone(), // Clone title for the event
            });
            // Emit cross-chain message for other parachains
            self.env().emit_event(CrossChainMessage {
                proposal_id,
                target_chain: 1000, // Example parachain ID
                message: format!("New proposal {} created: {}", proposal_id, title),
            });
            Ok(())
        }

        /// Vote in favor with a specific asset
        #[ink(message, payable)]
        pub fn vote_for(&mut self, proposal_id: u32, asset_id: u32) -> Result<(), Error> {
            if !self.supported_assets.contains(&asset_id) {
                return Err(Error::InvalidAsset);
            }
            let mut proposal = self
                .proposals
                .get(proposal_id)
                .ok_or(Error::ProposalNotFound)?;
            if proposal.closed {
                return Err(Error::ProposalClosed);
            }
            if self.env().block_number() > proposal.deadline {
                return Err(Error::VotingPeriodEnded);
            }
            let caller = self.env().caller();
            let value = self.env().transferred_value();
            if value < self.min_deposit {
                return Err(Error::InsufficientDeposit);
            }
            proposal.supporter_count += 1;
            let key = (proposal_id, caller, true, asset_id);
            let current_stake = self.voter_stakes.get(&key).unwrap_or(0);
            self.voter_stakes.insert(&key, &(current_stake + value));
            if !proposal.for_voters.contains(&caller) {
                proposal.for_voters.push(caller);
            }
            self.proposals.insert(proposal_id, &proposal);
            self.env().emit_event(Voted {
                proposal_id,
                voter: caller,
                in_favor: true,
                amount: value,
                asset_id,
            });
            Ok(())
        }

        /// Vote against with a specific asset
        #[ink(message, payable)]
        pub fn vote_against(&mut self, proposal_id: u32, asset_id: u32) -> Result<(), Error> {
            if !self.supported_assets.contains(&asset_id) {
                return Err(Error::InvalidAsset);
            }
            let mut proposal = self
                .proposals
                .get(proposal_id)
                .ok_or(Error::ProposalNotFound)?;
            if proposal.closed {
                return Err(Error::ProposalClosed);
            }
            if self.env().block_number() > proposal.deadline {
                return Err(Error::VotingPeriodEnded);
            }
            let caller = self.env().caller();
            let value = self.env().transferred_value();
            if value < self.min_deposit {
                return Err(Error::InsufficientDeposit);
            }
            proposal.supporter_count_against += 1;
            let key = (proposal_id, caller, false, asset_id);
            let current_stake = self.voter_stakes.get(&key).unwrap_or(0);
            self.voter_stakes.insert(&key, &(current_stake + value));
            if !proposal.against_voters.contains(&caller) {
                proposal.against_voters.push(caller);
            }
            self.proposals.insert(proposal_id, &proposal);
            self.env().emit_event(Voted {
                proposal_id,
                voter: caller,
                in_favor: false,
                amount: value,
                asset_id,
            });
            Ok(())
        }

        /// Close a proposal and submit to Democracy pallet if in favor
        #[ink(message)]
        pub fn close_vote(&mut self, proposal_id: u32) -> Result<(), Error> {
            let mut proposal = self
                .proposals
                .get(proposal_id)
                .ok_or(Error::ProposalNotFound)?;
            if proposal.closed {
                return Err(Error::AlreadyClosed);
            }
            let caller = self.env().caller();
            if caller != proposal.creator && caller != self.owner {
                return Err(Error::NotCreator);
            }
            proposal.closed = true;
            // Aggregate votes from voter_stakes
            let mut total_votes_for: Balance = 0;
            let mut total_votes_against: Balance = 0;
            for asset_id in &self.supported_assets {
                for voter in &proposal.for_voters {
                    let key = (proposal_id, *voter, true, *asset_id);
                    total_votes_for += self.voter_stakes.get(&key).unwrap_or(0);
                }
                for voter in &proposal.against_voters {
                    let key = (proposal_id, *voter, false, *asset_id);
                    total_votes_against += self.voter_stakes.get(&key).unwrap_or(0);
                }
            }
            let result = if total_votes_for > total_votes_against {
                "In Favor"
            } else if total_votes_against > total_votes_for {
                "Against"
            } else {
                "Indecision"
            };
            proposal.result = Some(result.to_string());
            let referendum_index = if result == "In Favor" {
                // Simulate submitting to Democracy pallet (actual call requires chain extension)
                Some(self.proposal_count) // Placeholder: real implementation would call pallet
            } else {
                None
            };
            proposal.referendum_index = referendum_index;
            self.proposals.insert(proposal_id, &proposal);
            self.env().emit_event(ProposalClosed {
                proposal_id,
                result: proposal.result.clone(),
                referendum_index,
            });
            // Emit cross-chain message if referendum submitted
            if let Some(index) = referendum_index {
                self.env().emit_event(CrossChainMessage {
                    proposal_id,
                    target_chain: 1000, // Example parachain ID
                    message: format!("Proposal {} passed, referendum {} submitted", proposal_id, index),
                });
            }
            Ok(())
        }

        /// Cancel a proposal
        #[ink(message)]
        pub fn cancel_proposal(&mut self, proposal_id: u32) -> Result<(), Error> {
            let mut proposal = self
                .proposals
                .get(proposal_id)
                .ok_or(Error::ProposalNotFound)?;
            if proposal.closed {
                return Err(Error::AlreadyClosed);
            }
            let caller = self.env().caller();
            if caller != proposal.creator && caller != self.owner {
                return Err(Error::NotCreator);
            }
            proposal.closed = true;
            proposal.result = None;
            self.proposals.insert(proposal_id, &proposal);
            self.env().emit_event(ProposalCancelled { proposal_id });
            Ok(())
        }

        /// Get a proposal
        #[ink(message)]
        pub fn get_proposal(&self, proposal_id: u32) -> Option<Proposal> {
            self.proposals.get(proposal_id)
        }

        /// Get proposal count
        #[ink(message)]
        pub fn get_proposal_count(&self) -> u32 {
            self.proposal_count
        }

        /// Get voting period
        #[ink(message)]
        pub fn get_voting_period(&self) -> BlockNumber {
            self.voting_period
        }

        /// Get voter stakes for a proposal and asset
        #[ink(message)]
        pub fn get_voter_stakes(&self, proposal_id: u32, voter: AccountId, asset_id: u32) -> (Balance, Balance) {
            let for_key = (proposal_id, voter, true, asset_id);
            let against_key = (proposal_id, voter, false, asset_id);
            (
                self.voter_stakes.get(&for_key).unwrap_or(0),
                self.voter_stakes.get(&against_key).unwrap_or(0),
            )
        }

        /// Get voters for a proposal
        #[ink(message)]
        pub fn get_voters(&self, proposal_id: u32) -> (Vec<AccountId>, Vec<AccountId>) {
            let proposal = self.proposals.get(proposal_id);
            match proposal {
                Some(p) => (p.for_voters.clone(), p.against_voters.clone()),
                None => (Vec::new(), Vec::new()),
            }
        }
    }
}