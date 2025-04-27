#[cfg(test)]
mod tests {
    use super::*;
    use ink_lang as ink;

    #[ink::test]
    fn test_flipper() {
        // Testing the constructor with a true value
        let mut flipper = Flipper::new(true);

        // The initial value should be true
        assert_eq!(flipper.get(), true);

        // Flip the value
        flipper.flip();

        // After flipping, the value should be false
        assert_eq!(flipper.get(), false);

        // Flip again
        flipper.flip();

        // After another flip, the value should be true
        assert_eq!(flipper.get(), true);
    }

    #[ink::test]
    fn test_default_constructor() {
        // Testing the default constructor which should set the value to false
        let flipper = Flipper::default();
        
        // The initial value should be false
        assert_eq!(flipper.get(), false);
    }
}
