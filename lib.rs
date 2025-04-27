#![cfg_attr(not(feature = "std"), no_std, no_main)]

#[ink::contract]
mod flipper {
    #[ink(storage)]
    pub struct Flipper {
        value: bool,
    }

    impl Flipper {
        /// Constructor that initializes the `bool` value.
        #[ink(constructor)]
        pub fn new(init_value: bool) -> Self {
            Self { value: init_value }
        }

        /// Default constructor setting `false`.
        #[ink(constructor)]
        pub fn default() -> Self {
            Self { value: false }
        }

        /// Flips the current value.
        #[ink(message)]
        pub fn flip(&mut self) {
            self.value = !self.value;
        }

        /// Returns the current value.
        #[ink(message)]
        pub fn get(&self) -> bool {
            self.value
        }
    }
}
