use platform::{SecretStore, SecretStoreError};
use uuid::Uuid;

#[test]
fn secret_store_roundtrip() {
    let store = SecretStore::new();
    let key = format!("test/{}", Uuid::new_v4());
    let value = format!("secret-{}", Uuid::new_v4());

    let set_result = store.set(&key, &value);
    if matches!(set_result, Err(SecretStoreError::Unavailable(_))) {
        eprintln!("skipping secret_store_roundtrip: OS keychain unavailable");
        return;
    }
    set_result.expect("set secret");
    let loaded = store.get(&key).expect("get secret");
    assert_eq!(loaded, value);

    store.delete(&key).expect("delete secret");
    assert!(store.get(&key).is_err());
}
