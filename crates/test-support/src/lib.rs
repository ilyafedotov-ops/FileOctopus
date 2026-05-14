pub fn crate_name() -> &'static str {
    "test-support"
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn exposes_crate_name() {
        assert_eq!(crate_name(), "test-support");
    }
}
