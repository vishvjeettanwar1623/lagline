use std::path::PathBuf;
use walkdir::WalkDir;

/// Scans a root path recursively for directories containing a `.git` subdirectory.
/// If a `.git` subdirectory is found, it records the directory path and skips
/// descending further into it.
pub fn scan_directories(root: &str) -> Vec<PathBuf> {
    let mut repos = Vec::new();
    let mut it = WalkDir::new(root).into_iter();

    loop {
        let entry = match it.next() {
            None => break,
            Some(Err(_)) => continue,
            Some(Ok(entry)) => entry,
        };

        let path = entry.path();
        if path.is_dir() {
            let git_dir = path.join(".git");
            if git_dir.exists() && git_dir.is_dir() {
                repos.push(path.to_path_buf());
                it.skip_current_dir();
            }
        }
    }

    repos
}
