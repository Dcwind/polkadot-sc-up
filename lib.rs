#![cfg_attr(not(feature = "std"), no_std, no_main)]

#[ink::contract]
mod governance_tracker {
    use ink::storage::Mapping;
    use ink::prelude::string::String;

    #[derive(Debug, PartialEq, Eq, scale::Encode, scale::Decode)]
    #[cfg_attr(feature = "std", derive(scale_info::TypeInfo, ink::storage::traits::StorageLayout))]
    pub struct Proposal {
        title: String,
        description: String,
        votes: Balance,
        creator: AccountId,
        supporter_count: u32,
    }

    #[ink(storage)]
    pub struct GovernanceTracker {
        proposals: Mapping<u32, Proposal>,
        proposal_count: u32,
        min_vote_amount: Balance,
        owner: AccountId,
        voters: Mapping<(u32, AccountId), ()>,
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
        TitleTooLong,
        DescriptionTooLong,
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
                voters: Mapping::default(),
            }
        }

        #[ink(message)]
        pub fn submit_proposal(&mut self, title: String, description: String) -> Result<u32> {
            if title.as_bytes().len() > 32 {
                return Err(Error::TitleTooLong);
            }
            if description.as_bytes().len() > 128 {
                return Err(Error::DescriptionTooLong);
            }

            let creator = self.env().caller();
            let proposal_id = self.proposal_count;

            let proposal = Proposal {
                title,
                description,
                votes: 0,
                creator,
                supporter_count: 0,
            };

            self.proposals.insert(proposal_id, &proposal);
            self.proposal_count += 1;

            self.env().emit_event(ProposalCreated {
                proposal_id,
                creator,
                title: proposal.title.clone(),
            });
            self.env().emit_event(ProposalCreated {
                proposal_id,
                creator,
                title: String::from("Stored"),
            });

            Ok(proposal_id)
        }

        #[ink(message, payable)]
        pub fn vote(&mut self, proposal_id: u32) -> Result<()> {
            let caller = self.env().caller();
            let vote_amount = self.env().transferred_value();

            if vote_amount < self.min_vote_amount {
                return Err(Error::InsufficientVoteAmount);
            }

            let mut proposal = self.proposals.get(proposal_id).ok_or(Error::ProposalNotFound)?;

            if self.voters.get((proposal_id, caller)).is_some() {
                return Err(Error::AlreadyVoted);
            }

            proposal.votes += vote_amount;
            proposal.supporter_count += 1;
            self.proposals.insert(proposal_id, &proposal);

            self.voters.insert((proposal_id, caller), &());

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
                String::from("Test"),
                String::from("Test desc"),
            ).unwrap();
            
            assert_eq!(proposal_id, 0);
            assert_eq!(tracker.get_proposal_count(), 1);
            
            let proposal = tracker.get_proposal(0).unwrap();
            assert_eq!(proposal.title, String::from("Test"));
            assert_eq!(proposal.description, String::from("Test desc"));
            assert_eq!(proposal.votes, 0);
            assert_eq!(proposal.supporter_count, 0);
        }

        #[ink::test]
        fn test_vote_on_proposal() {
            let accounts = test::default_accounts::<DefaultEnvironment>();
            let mut tracker = GovernanceTracker::new(1000);
            
            let proposal_id = tracker.submit_proposal(
                String::from("Test"),
                String::from("Test desc"),
            ).unwrap();
            
            test::set_caller::<DefaultEnvironment>(accounts.bob);
            test::set_value_transferred::<DefaultEnvironment>(2000);
            
            assert!(tracker.vote(proposal_id).is_ok());
            
            let proposal = tracker.get_proposal(proposal_id).unwrap();
            assert_eq!(proposal.votes, 2000);
            assert_eq!(proposal.supporter_count, 1);
        }

        #[ink::test]
        fn test_insufficient_vote_amount() {
            let accounts = test::default_accounts::<DefaultEnvironment>();
            let mut tracker = GovernanceTracker::new(1000);
            
            let proposal_id = tracker.submit_proposal(
                String::from("Test"),
                String::from("Test desc"),
            ).unwrap();
            
            test::set_caller::<DefaultEnvironment>(accounts.bob);
            test::set_value_transferred::<DefaultEnvironment>(500);
            
            assert_eq!(tracker.vote(proposal_id), Err(Error::InsufficientVoteAmount));
        }

        #[ink::test]
        fn test_title_too_long() {
            let mut tracker = GovernanceTracker::new(1000);
            let long_title = String::from_utf8(vec![b'a'; 33]).unwrap();
            let result = tracker.submit_proposal(
                long_title,
                String::from("Test desc"),
            );
            assert_eq!(result, Err(Error::TitleTooLong));
        }
    }
}