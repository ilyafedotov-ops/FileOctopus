#[test]
fn init_is_repeatable() {
    telemetry::init().unwrap();
    telemetry::init().unwrap();
}
