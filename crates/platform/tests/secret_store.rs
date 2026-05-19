use platform::SecretStore;
use uuid::Uuid;

#[test]
fn secret_store_roundtrip() {
    let store = SecretStore::new();
    let key = format!("test/{}", Uuid::new_v4());
    let value = format!("secret-{}", Uuid::new_v4());

    store.set(&key, &value).expect("set secret");
    let loaded = store.get(&key).expect("get secret");
    assert_eq!(loaded, value);

    store.delete(&key).expect("delete secret");
    assert!(store.get(&key).is_err());
}
