#![cfg_attr(not(feature = "std"), no_std, no_main)]

#[ink::contract]
mod governance_tracker {
    use ink::storage::Mapping;
    use ink::prelude::string::String;
    use ink::prelude::vec::Vec;

    #[derive(Debug, PartialEq, Eq, scale::Encode, scale::Decode)]
    #[cfg_attr(feature = "std", derive(scale_info::TypeInfo, ink::storage::traits::StorageLayout))]
    pub struct Proposal {
        title: String,
        description: String,
        votes: Balance,
        creator: AccountId,
        supporters: Vec<AccountId>,
    }

    #[ink(storage)]
    pub struct GovernanceTracker {
        proposals: Mapping<u32, Proposal>,
        proposal_count: u32,
        min_vote_amount: Balance,
        owner: AccountId,
    }

    #[ink(event)]
    pub struct ProposalCreated {
        #[ink(topic)]
        proposal_id: u32,
        #[ink(topic)]
        creator: AccountId,
        title: String,
    }

    #[ink(event)]
    pub struct VoteCast {
        #[ink(topic)]
        proposal_id: u32,
        #[ink(topic)]
        voter: AccountId,
        amount: Balance,
    }

    #[derive(Debug, PartialEq, Eq, scale::Encode, scale::Decode)]
    #[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
    pub enum Error {
        ProposalNotFound,
        InsufficientVoteAmount,
        AlreadyVoted,
    }

    pub type Result<T> = core::result::Result<T, Error>;

    impl GovernanceTracker {
        #[ink(constructor)]
        pub fn new(min_vote_amount: Balance) -> Self {
            Self {
                proposals: Mapping::default(),
                proposal_count: 0,
                min_vote_amount,
                owner: Self::env().caller(),
            }
        }

        #[ink(message)]
        pub fn submit_proposal(&mut self, title: String, description: String) -> u32 {
            let creator = self.env().caller();
            let proposal_id = self.proposal_count;

            let proposal = Proposal {
                title: title.clone(),
                description,
                votes: 0,
                creator,
                supporters: Vec::new(),
            };

            self.proposals.insert(proposal_id, &proposal);
            self.proposal_count += 1;

            self.env().emit_event(ProposalCreated {
                proposal_id,
                creator,
                title,
            });

            proposal_id
        }

        #[ink(message, payable)]
        pub fn vote(&mut self, proposal_id: u32) -> Result<()> {
            let caller = self.env().caller();
            let vote_amount = self.env().transferred_value();

            if vote_amount < self.min_vote_amount {
                return Err(Error::InsufficientVoteAmount);
            }

            let mut proposal = self.proposals.get(proposal_id).ok_or(Error::ProposalNotFound)?;
            
            // Check if user already voted
            if proposal.supporters.contains(&caller) {
                return Err(Error::AlreadyVoted);
            }

            // Update proposal
            proposal.votes += vote_amount;
            proposal.supporters.push(caller);
            self.proposals.insert(proposal_id, &proposal);

            self.env().emit_event(VoteCast {
                proposal_id,
                voter: caller,
                amount: vote_amount,
            });

            Ok(())
        }

        #[ink(message)]
        pub fn get_proposal(&self, proposal_id: u32) -> Option<Proposal> {
            self.proposals.get(proposal_id)
        }

        #[ink(message)]
        pub fn get_proposal_count(&self) -> u32 {
            self.proposal_count
        }

        #[ink(message)]
        pub fn update_min_vote_amount(&mut self, new_amount: Balance) {
            assert_eq!(self.env().caller(), self.owner, "Only owner can update");
            self.min_vote_amount = new_amount;
        }
    }

    #[cfg(test)]
    mod tests {
        use super::*;
        use ink::env::{test, DefaultEnvironment};

        #[ink::test]
        fn test_create_proposal() {
            let mut tracker = GovernanceTracker::new(1000);
            let proposal_id = tracker.submit_proposal(
                String::from("Test Proposal"),
                String::from("This is a test proposal"),
            );
            
            assert_eq!(proposal_id, 0);
            assert_eq!(tracker.get_proposal_count(), 1);
            
            let proposal = tracker.get_proposal(0).unwrap();
            assert_eq!(proposal.title, String::from("Test Proposal"));
            assert_eq!(proposal.description, String::from("This is a test proposal"));
            assert_eq!(proposal.votes, 0);
        }

        #[ink::test]
        fn test_vote_on_proposal() {
            let accounts = test::default_accounts::<DefaultEnvironment>();
            let mut tracker = GovernanceTracker::new(1000);
            
            // Create a proposal
            let proposal_id = tracker.submit_proposal(
                String::from("Test Proposal"),
                String::from("This is a test proposal"),
            );
            
            // Vote on the proposal
            test::set_caller::<DefaultEnvironment>(accounts.bob);
            test::set_value_transferred::<DefaultEnvironment>(2000);
            
            assert!(tracker.vote(proposal_id).is_ok());
            
            let proposal = tracker.get_proposal(proposal_id).unwrap();
            assert_eq!(proposal.votes, 2000);
            assert_eq!(proposal.supporters.len(), 1);
        }

        #[ink::test]
        fn test_insufficient_vote_amount() {
            let accounts = test::default_accounts::<DefaultEnvironment>();
            let mut tracker = GovernanceTracker::new(1000);
            
            let proposal_id = tracker.submit_proposal(
                String::from("Test Proposal"),
                String::from("This is a test proposal"),
            );
            
            test::set_caller::<DefaultEnvironment>(accounts.bob);
            test::set_value_transferred::<DefaultEnvironment>(500); // Less than min amount
            
            assert_eq!(tracker.vote(proposal_id), Err(Error::InsufficientVoteAmount));
        }
    }
}