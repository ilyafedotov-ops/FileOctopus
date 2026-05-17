use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};

use vfs::ResourceUri;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StandardLocation {
    pub id: String,
    pub name: String,
    pub uri: String,
    pub section: String,
}

pub fn standard_locations() -> Vec<StandardLocation> {
    let mut locations = Vec::new();
    let mut seen = HashSet::new();

    if let Some(home) = home_dir() {
        push_location(
            &mut locations,
            &mut seen,
            "home",
            "Home",
            "Favorites",
            home.clone(),
        );

        for (id, name) in [
            ("desktop", "Desktop"),
            ("documents", "Documents"),
            ("downloads", "Downloads"),
            ("pictures", "Pictures"),
            ("music", "Music"),
            ("videos", "Videos"),
        ] {
            push_location(
                &mut locations,
                &mut seen,
                id,
                name,
                "User folders",
                home.join(name),
            );
        }
    }

    for root in platform_roots() {
        let (id, name) = volume_descriptor(&root);
        push_location(
            &mut locations,
            &mut seen,
            &id,
            &name,
            "Devices/Volumes",
            root,
        );
    }

    locations
}

fn push_location(
    locations: &mut Vec<StandardLocation>,
    seen: &mut HashSet<String>,
    id: &str,
    name: &str,
    section: &str,
    path: PathBuf,
) {
    if !path.exists() {
        return;
    }

    if should_skip_volume_path(&path) {
        return;
    }

    let resolved = path.canonicalize().unwrap_or(path);
    let Ok(uri) = ResourceUri::from_local_path(&resolved) else {
        return;
    };

    if seen.insert(uri.as_str().to_string()) {
        locations.push(StandardLocation {
            id: id.to_string(),
            name: name.to_string(),
            uri: uri.as_str().to_string(),
            section: section.to_string(),
        });
    }
}

fn volume_descriptor(path: &Path) -> (String, String) {
    if cfg!(target_os = "macos") && path == Path::new("/") {
        let boot_volume = Path::new("/Volumes/Macintosh HD");
        if boot_volume.exists() {
            return ("macintosh-hd".to_string(), "Macintosh HD".to_string());
        }
    }

    let name = path
        .file_name()
        .and_then(|value| value.to_str())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| path.to_str().unwrap_or("/"))
        .to_string();
    let id = if path == Path::new("/") {
        "root".to_string()
    } else {
        name.to_ascii_lowercase().replace(' ', "-")
    };

    (id, name)
}

fn should_skip_volume_path(path: &Path) -> bool {
    let value = path.to_string_lossy().to_ascii_lowercase();
    value.contains("timemachine")
        || value.contains("com.apple.time_machine")
        || value.ends_with(".timemachine")
}

fn platform_roots() -> Vec<PathBuf> {
    if cfg!(target_os = "windows") {
        return ('A'..='Z')
            .map(|letter| PathBuf::from(format!("{letter}:/")))
            .filter(|path| path.exists())
            .collect();
    }

    let mut roots = vec![PathBuf::from("/")];

    if cfg!(target_os = "macos") {
        roots.extend(read_existing_children(Path::new("/Volumes")));
    } else {
        roots.extend(read_existing_children(Path::new("/mnt")));
        roots.extend(read_existing_children(Path::new("/media")));
    }

    roots
}

fn read_existing_children(path: &Path) -> Vec<PathBuf> {
    fs::read_dir(path)
        .ok()
        .into_iter()
        .flat_map(|items| items.filter_map(Result::ok))
        .map(|entry| entry.path())
        .filter(|path| path.exists() && !should_skip_volume_path(path))
        .collect()
}

fn home_dir() -> Option<PathBuf> {
    std::env::var_os("HOME")
        .map(PathBuf::from)
        .or_else(|| std::env::var_os("USERPROFILE").map(PathBuf::from))
}
