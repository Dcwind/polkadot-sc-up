#![cfg_attr(not(feature = "std"), no_std, no_main)]

#[ink::contract]
mod governance_tracker {
    use ink::prelude::string::String;
    use ink::storage::Mapping;

    /// Proposal struct with new fields: deadline, min_supporters
    #[derive(scale::Decode, scale::Encode)]
    #[cfg_attr(
        feature = "std",
        derive(scale_info::TypeInfo, ink::storage::traits::StorageLayout)
    )]
    pub struct Proposal {
        title: String,
        description: String,
        votes: Balance,              // Total votes for (in tokens)
        votes_against: Balance,      // Total votes against (in tokens)
        creator: AccountId,
        supporter_count: u32,        // Number of supporters for
        supporter_count_against: u32,// Number of supporters against
        closed: bool,
        result: Option<bool>,        // None if cancelled, Some(true) if passed, Some(false) if failed
        deadline: BlockNumber,       // Voting deadline
    }

    #[ink(storage)]
    pub struct GovernanceTracker {
        proposals: Mapping<u32, Proposal>,
        proposal_count: u32,
        min_deposit: Balance,        // Minimum deposit for voting
        min_supporters: u32,         // Minimum supporters required
        voting_period: BlockNumber,  // Voting duration (e.g., 100,800 blocks ≈ 7 days)
    }

    #[derive(scale::Decode, scale::Encode)]
    #[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
    pub enum Error {
        ProposalNotFound,
        ProposalClosed,
        InsufficientDeposit,
        NotCreator,
        VotingPeriodActive,
        InsufficientSupporters,
        AlreadyClosed,
    }

    /// Events for frontend notifications
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
    }

    #[ink(event)]
    pub struct ProposalClosed {
        #[ink(topic)]
        proposal_id: u32,
        result: Option<bool>,
    }

    #[ink(event)]
    pub struct ProposalCancelled {
        #[ink(topic)]
        proposal_id: u32,
    }

    impl GovernanceTracker {
        /// Constructor: Initialize with min_deposit, min_supporters, and voting_period
        #[ink(constructor)]
        pub fn new(min_deposit: Balance, min_supporters: u32, voting_period: BlockNumber) -> Self {
            Self {
                proposals: Mapping::default(),
                proposal_count: 0,
                min_deposit,
                min_supporters,
                voting_period,
            }
        }

        /// Submit a new proposal
        #[ink(message, payable)]
        pub fn submit_proposal(&mut self, title: String, description: String) -> Result<(), Error> {
            let caller = self.env().caller();
            let value = self.env().transferred_value();
            if value < self.min_deposit {
                return Err(Error::InsufficientDeposit);
            }
            let current_block = self.env().block_number();
            let proposal = Proposal {
                title: title.clone(),
                description,
                votes: value,
                votes_against: 0,
                creator: caller,
                supporter_count: 1,
                supporter_count_against: 0,
                closed: false,
                result: None,
                deadline: current_block + self.voting_period,
            };
            let proposal_id = self.proposal_count;
            self.proposals.insert(proposal_id, &proposal);
            self.proposal_count += 1;
            self.env().emit_event(ProposalCreated {
                proposal_id,
                creator: caller,
                title,
            });
            Ok(())
        }

        /// Vote in favor of a proposal
        #[ink(message, payable)]
        pub fn vote_for(&mut self, proposal_id: u32) -> Result<(), Error> {
            let mut proposal = self
                .proposals
                .get(proposal_id)
                .ok_or(Error::ProposalNotFound)?;
            if proposal.closed {
                return Err(Error::ProposalClosed);
            }
            if self.env().block_number() > proposal.deadline {
                return Err(Error::VotingPeriodActive);
            }
            let value = self.env().transferred_value();
            if value < self.min_deposit {
                return Err(Error::InsufficientDeposit);
            }
            proposal.votes += value;
            proposal.supporter_count += 1;
            self.proposals.insert(proposal_id, &proposal);
            self.env().emit_event(Voted {
                proposal_id,
                voter: self.env().caller(),
                in_favor: true,
                amount: value,
            });
            Ok(())
        }

        /// Vote against a proposal
        #[ink(message, payable)]
        pub fn vote_against(&mut self, proposal_id: u32) -> Result<(), Error> {
            let mut proposal = self
                .proposals
                .get(proposal_id)
                .ok_or(Error::ProposalNotFound)?;
            if proposal.closed {
                return Err(Error::ProposalClosed);
            }
            if self.env().block_number() > proposal.deadline {
                return Err(Error::VotingPeriodActive);
            }
            let value = self.env().transferred_value();
            if value < self.min_deposit {
                return Err(Error::InsufficientDeposit);
            }
            proposal.votes_against += value;
            proposal.supporter_count_against += 1;
            self.proposals.insert(proposal_id, &proposal);
            self.env().emit_event(Voted {
                proposal_id,
                voter: self.env().caller(),
                in_favor: false,
                amount: value,
            });
            Ok(())
        }

        /// Close a proposal (after deadline or with sufficient supporters)
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
            if caller != proposal.creator {
                return Err(Error::NotCreator);
            }
            if self.env().block_number() < proposal.deadline {
                return Err(Error::VotingPeriodActive);
            }
            if proposal.supporter_count < self.min_supporters || 
               proposal.supporter_count_against < self.min_supporters {
                return Err(Error::InsufficientSupporters);
            }
            proposal.closed = true;
            proposal.result = Some(proposal.votes > proposal.votes_against);
            self.proposals.insert(proposal_id, &proposal);
            self.env().emit_event(ProposalClosed {
                proposal_id,
                result: proposal.result,
            });
            Ok(())
        }

        /// Cancel a proposal (creator only)
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
            if caller != proposal.creator {
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

        /// Get minimum supporters
        #[ink(message)]
        pub fn get_min_supporters(&self) -> u32 {
            self.min_supporters
        }
    }

    #[cfg(test)]
    mod tests {
        use super::*;
        use ink::env::test::*;

        fn set_caller_and_value(caller: AccountId, value: Balance) {
            ink::env::test::set_caller::<ink::env::DefaultEnvironment>(caller);
            ink::env::test::set_value_transferred::<ink::env::DefaultEnvironment>(value);
        }

        fn advance_block(number: BlockNumber) {
            let current_block = ink::env::block_number::<ink::env::DefaultEnvironment>();
            ink::env::test::advance_block::<ink::env::DefaultEnvironment>();
            ink::env::test::set_block_number::<ink::env::DefaultEnvironment>(current_block + number);
        }

        #[ink::test]
        fn new_works() {
            let contract = GovernanceTracker::new(1_000_000_000_000, 3, 100_800);
            assert_eq!(contract.get_proposal_count(), 0);
            assert_eq!(contract.min_deposit, 1_000_000_000_000);
            assert_eq!(contract.min_supporters, 3);
            assert_eq!(contract.voting_period, 100_800);
        }

        #[ink::test]
        fn submit_proposal_works() {
            let mut contract = GovernanceTracker::new(1_000_000_000_000, 3, 100_800);
            let alice = AccountId::from([0x1; 32]);
            set_caller_and_value(alice, 1_000_000_000_000);
            assert!(contract.submit_proposal("Test".into(), "Description".into()).is_ok());
            assert_eq!(contract.get_proposal_count(), 1);
            let proposal = contract.get_proposal(0).unwrap();
            assert_eq!(proposal.title, "Test");
            assert_eq!(proposal.supporter_count, 1);
            assert_eq!(proposal.votes, 1_000_000_000_000);
            assert_eq!(proposal.deadline, contract.voting_period);
        }

        #[ink::test]
        fn submit_proposal_fails_insufficient_deposit() {
            let mut contract = GovernanceTracker::new(1_000_000_000_000, 3, 100_800);
            let alice = AccountId::from([0x1; 32]);
            set_caller_and_value(alice, 500_000_000_000);
            assert_eq!(
                contract.submit_proposal("Test".into(), "Description".into()),
                Err(Error::InsufficientDeposit)
            );
        }

        #[ink::test]
        fn vote_for_works() {
            let mut contract = GovernanceTracker::new(1_000_000_000_000, 3, 100_800);
            let alice = AccountId::from([0x1; 32]);
            let bob = AccountId::from([0x2; 32]);
            set_caller_and_value(alice, 1_000_000_000_000);
            contract.submit_proposal("Test".into(), "Description".into()).unwrap();
            set_caller_and_value(bob, 2_000_000_000_000);
            assert!(contract.vote_for(0).is_ok());
            let proposal = contract.get_proposal(0).unwrap();
            assert_eq!(proposal.supporter_count, 2);
            assert_eq!(proposal.votes, 3_000_000_000_000);
        }

        #[ink::test]
        fn vote_against_works() {
            let mut contract = GovernanceTracker::new(1_000_000_000_000, 3, 100_800);
            let alice = AccountId::from([0x1; 32]);
            let bob = AccountId::from([0x2; 32]);
            set_caller_and_value(alice, 1_000_000_000_000);
            contract.submit_proposal("Test".into(), "Description".into()).unwrap();
            set_caller_and_value(bob, 1_000_000_000_000);
            assert!(contract.vote_against(0).is_ok());
            let proposal = contract.get_proposal(0).unwrap();
            assert_eq!(proposal.supporter_count_against, 1);
            assert_eq!(proposal.votes_against, 1_000_000_000_000);
        }

        #[ink::test]
        fn vote_fails_after_deadline() {
            let mut contract = GovernanceTracker::new(1_000_000_000_000, 3, 100_800);
            let alice = AccountId::from([0x1; 32]);
            let bob = AccountId::from([0x2; 32]);
            set_caller_and_value(alice, 1_000_000_000_000);
            contract.submit_proposal("Test".into(), "Description".into()).unwrap();
            advance_block(100_801);
            set_caller_and_value(bob, 1_000_000_000_000);
            assert_eq!(contract.vote_for(0), Err(Error::VotingPeriodActive));
            assert_eq!(contract.vote_against(0), Err(Error::VotingPeriodActive));
        }

        #[ink::test]
        fn close_vote_works() {
            let mut contract = GovernanceTracker::new(1_000_000_000_000, 3, 100_800);
            let alice = AccountId::from([0x1; 32]);
            let bob = AccountId::from([0x2; 32]);
            let charlie = AccountId::from([0x3; 32]);
            set_caller_and_value(alice, 1_000_000_000_000);
            contract.submit_proposal("Test".into(), "Description".into()).unwrap();
            set_caller_and_value(bob, 1_000_000_000_000);
            contract.vote_for(0).unwrap();
            set_caller_and_value(charlie, 1_000_000_000_000);
            contract.vote_against(0).unwrap();
            advance_block(100_801);
            set_caller_and_value(alice, 0);
            assert!(contract.close_vote(0).is_ok());
            let proposal = contract.get_proposal(0).unwrap();
            assert!(proposal.closed);
            assert_eq!(proposal.result, Some(true));
        }

        #[ink::test]
        fn close_vote_fails_insufficient_supporters() {
            let mut contract = GovernanceTracker::new(1_000_000_000_000, 3, 100_800);
            let alice = AccountId::from([0x1; 32]);
            set_caller_and_value(alice, 1_000_000_000_000);
            contract.submit_proposal("Test".into(), "Description".into()).unwrap();
            advance_block(100_801);
            set_caller_and_value(alice, 0);
            assert_eq!(contract.close_vote(0), Err(Error::InsufficientSupporters));
        }

        #[ink::test]
        fn cancel_proposal_works() {
            let mut contract = GovernanceTracker::new(1_000_000_000_000, 3, 100_800);
            let alice = AccountId::from([0x1; 32]);
            set_caller_and_value(alice, 1_000_000_000_000);
            contract.submit_proposal("Test".into(), "Description".into()).unwrap();
            set_caller_and_value(alice, 0);
            assert!(contract.cancel_proposal(0).is_ok());
            let proposal = contract.get_proposal(0).unwrap();
            assert!(proposal.closed);
            assert_eq!(proposal.result, None);
        }

        #[ink::test]
        fn cancel_proposal_fails_not_creator() {
            let mut contract = GovernanceTracker::new(1_000_000_000_000, 3, 100_800);
            let alice = AccountId::from([0x1; 32]);
            let bob = AccountId::from([0x2; 32]);
            set_caller_and_value(alice, 1_000_000_000_000);
            contract.submit_proposal("Test".into(), "Description".into()).unwrap();
            set_caller_and_value(bob, 0);
            assert_eq!(contract.cancel_proposal(0), Err(Error::NotCreator));
        }
    }
}