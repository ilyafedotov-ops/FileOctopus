pub fn is_network_enabled() -> bool {
    match std::env::var("FILEOCTOPUS_ENABLE_NETWORK")
        .ok()
        .as_deref()
        .map(str::trim)
    {
        Some("1") | Some("true") | Some("yes") | Some("on") => true,
        Some("0") | Some("false") | Some("no") | Some("off") => false,
        _ => !cfg!(debug_assertions),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn network_enabled_honors_explicit_env_values() {
        let previous = std::env::var("FILEOCTOPUS_ENABLE_NETWORK").ok();

        std::env::set_var("FILEOCTOPUS_ENABLE_NETWORK", "1");
        assert!(is_network_enabled());
        std::env::set_var("FILEOCTOPUS_ENABLE_NETWORK", "0");
        assert!(!is_network_enabled());

        if let Some(value) = previous {
            std::env::set_var("FILEOCTOPUS_ENABLE_NETWORK", value);
        } else {
            std::env::remove_var("FILEOCTOPUS_ENABLE_NETWORK");
        }
    }
}
