use std::path::Path;
use chrono::{Utc, TimeZone};
use git2::{Repository, BranchType, StatusOptions};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ChangedFile {
    pub path: String,
    pub status: String, // "modified" | "added" | "deleted" | "renamed" | "untracked"
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct AheadCommit {
    pub hash: String,
    pub message: String,
    pub timestamp: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct RepoInfo {
    pub id: String,
    pub name: String,
    pub local_path: String,
    pub branch: String,
    pub remote_url: Option<String>,
    pub status: String, // "clean" | "ahead" | "behind" | "dirty" | "diverged" | "unlinked"
    pub last_commit_time: Option<String>,
    pub ahead_count: usize,
    pub behind_count: usize,
    pub changed_files: Vec<ChangedFile>,
    pub ahead_commits: Vec<AheadCommit>,
    pub behind_commits: Vec<AheadCommit>,
    pub last_scanned: String,
    pub remote_type: Option<String>, // "github" | "other"
    pub project_type: Option<String>,
}

pub fn get_branch_name(repo: &Repository) -> Result<String, String> {
    if repo.head_detached().unwrap_or(false) {
        return Ok("(detached HEAD)".to_string());
    }
    match repo.head() {
        Ok(head) => {
            if head.is_branch() {
                Ok(head.shorthand().unwrap_or("unknown").to_string())
            } else {
                Ok("(detached HEAD)".to_string())
            }
        }
        Err(_) => {
            // Unborn branch or empty repo
            match repo.find_reference("HEAD") {
                Ok(refhead) => {
                    if let Some(target) = refhead.symbolic_target() {
                        Ok(target.strip_prefix("refs/heads/").unwrap_or(target).to_string())
                    } else {
                        Ok("main".to_string())
                    }
                }
                Err(_) => Ok("main".to_string()),
            }
        }
    }
}

pub fn get_last_commit_time(repo: &Repository) -> Option<String> {
    let head = repo.head().ok()?;
    let commit = head.peel_to_commit().ok()?;
    let time = commit.time();
    let seconds = time.seconds();
    let dt = Utc.timestamp_opt(seconds, 0).single()?;
    Some(dt.to_rfc3339())
}

pub fn get_ahead_behind(repo: &Repository) -> Result<(usize, usize), String> {
    let head = match repo.head() {
        Ok(h) => h,
        Err(_) => return Ok((0, 0)),
    };
    
    let local_oid = match head.target() {
        Some(oid) => oid,
        None => return Ok((0, 0)),
    };
    
    let local_branch_name = match head.shorthand() {
        Some(name) => name,
        None => return Ok((0, 0)),
    };
    
    let local_branch = match repo.find_branch(local_branch_name, BranchType::Local) {
        Ok(b) => b,
        Err(_) => return Ok((0, 0)),
    };
    
    let upstream = match local_branch.upstream() {
        Ok(u) => u,
        Err(_) => return Ok((0, 0)),
    };
    
    let upstream_oid = match upstream.get().target() {
        Some(oid) => oid,
        None => return Ok((0, 0)),
    };
    
    let (ahead, behind) = repo.graph_ahead_behind(local_oid, upstream_oid)
        .map_err(|e| e.to_string())?;
        
    Ok((ahead, behind))
}

pub fn get_changed_files(repo: &Repository) -> Result<Vec<ChangedFile>, String> {
    let mut opts = StatusOptions::new();
    opts.include_untracked(true)
        .recurse_untracked_dirs(true);
        
    let statuses = match repo.statuses(Some(&mut opts)) {
        Ok(s) => s,
        Err(e) => return Err(e.to_string()),
    };
    
    let mut files = Vec::new();
    for entry in statuses.iter() {
        let path = entry.path().unwrap_or("unknown").to_string();
        let status_flags = entry.status();
        
        let status = if status_flags.is_index_new() {
            "added"
        } else if status_flags.is_wt_new() {
            "untracked"
        } else if status_flags.is_index_modified() || status_flags.is_wt_modified() {
            "modified"
        } else if status_flags.is_index_deleted() || status_flags.is_wt_deleted() {
            "deleted"
        } else if status_flags.is_index_renamed() || status_flags.is_wt_renamed() {
            "renamed"
        } else {
            continue;
        };
        
        files.push(ChangedFile { path, status: status.to_string() });
    }
    
    Ok(files)
}

pub fn get_remote_info(repo: &Repository) -> (Option<String>, Option<String>) {
    let remotes = match repo.remotes() {
        Ok(r) => r,
        Err(_) => return (None, None),
    };
    
    let remote_name = remotes.get(0).or_else(|| remotes.iter().flatten().next());
    
    if let Some(name) = remote_name {
        if let Ok(remote) = repo.find_remote(name) {
            if let Some(url) = remote.url() {
                let url_str = url.to_string();
                let remote_type = if url_str.contains("github.com") {
                    Some("github".to_string())
                } else {
                    Some("other".to_string())
                };
                return (Some(url_str), remote_type);
            }
        }
    }
    (None, None)
}

pub fn get_ahead_commits(repo: &Repository) -> Result<Vec<AheadCommit>, String> {
    let head = match repo.head() {
        Ok(h) => h,
        Err(_) => return Ok(Vec::new()),
    };
    
    let local_oid = match head.target() {
        Some(oid) => oid,
        None => return Ok(Vec::new()),
    };
    
    let local_branch_name = match head.shorthand() {
        Some(name) => name,
        None => return Ok(Vec::new()),
    };
    
    let local_branch = match repo.find_branch(local_branch_name, BranchType::Local) {
        Ok(b) => b,
        Err(_) => return Ok(Vec::new()),
    };
    
    let upstream = match local_branch.upstream() {
        Ok(u) => u,
        Err(_) => return Ok(Vec::new()),
    };
    
    let upstream_oid = match upstream.get().target() {
        Some(oid) => oid,
        None => return Ok(Vec::new()),
    };
    
    let mut revwalk = repo.revwalk().map_err(|e| e.to_string())?;
    revwalk.push(local_oid).map_err(|e| e.to_string())?;
    revwalk.hide(upstream_oid).map_err(|e| e.to_string())?;
    
    let mut commits = Vec::new();
    for oid_res in revwalk {
        let oid = match oid_res {
            Ok(o) => o,
            Err(_) => continue,
        };
        if let Ok(commit) = repo.find_commit(oid) {
            let hash = oid.to_string()[..7].to_string();
            let message = commit.summary().unwrap_or("").to_string();
            let time = commit.time();
            let dt = Utc.timestamp_opt(time.seconds(), 0).single();
            let timestamp = dt.map(|d| d.to_rfc3339()).unwrap_or_default();
            commits.push(AheadCommit {
                hash,
                message,
                timestamp,
            });
        }
    }
    
    Ok(commits)
}

pub fn determine_status(
    remote_url: &Option<String>,
    ahead_count: usize,
    behind_count: usize,
    has_changes: bool,
) -> String {
    if remote_url.is_none() {
        "unlinked".to_string()
    } else if ahead_count > 0 && behind_count > 0 {
        "diverged".to_string()
    } else if ahead_count > 0 {
        "ahead".to_string()
    } else if behind_count > 0 {
        "behind".to_string()
    } else if has_changes {
        "dirty".to_string()
    } else {
        "clean".to_string()
    }
}

pub fn get_repo_info(path: &Path) -> Result<RepoInfo, String> {
    let repo = Repository::open(path).map_err(|e| e.to_string())?;
    
    let name = path.file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("unknown")
        .to_string();
        
    let local_path = path.to_string_lossy().to_string();
    let branch = get_branch_name(&repo)?;
    let (remote_url, remote_type) = get_remote_info(&repo);
    
    let changed_files = get_changed_files(&repo)?;
    let has_changes = !changed_files.is_empty();
    
    let (ahead_count, behind_count) = get_ahead_behind(&repo).unwrap_or((0, 0));
    let last_commit_time = get_last_commit_time(&repo);
    let ahead_commits = get_ahead_commits(&repo).unwrap_or_default();
    
    let status = determine_status(&remote_url, ahead_count, behind_count, has_changes);
    let last_scanned = Utc::now().to_rfc3339();
    
    let project_type = detect_project_type(path);
    
    Ok(RepoInfo {
        id: local_path.clone(),
        name,
        local_path,
        branch,
        remote_url,
        status,
        last_commit_time,
        ahead_count,
        behind_count,
        changed_files,
        ahead_commits,
        behind_commits: Vec::new(),
        last_scanned,
        remote_type,
        project_type,
    })
}

pub fn detect_project_type(path: &Path) -> Option<String> {
    if path.join("package.json").exists() {
        Some("javascript".to_string())
    } else if path.join("Cargo.toml").exists() {
        Some("rust".to_string())
    } else if path.join("go.mod").exists() {
        Some("go".to_string())
    } else if path.join("requirements.txt").exists() || path.join("pyproject.toml").exists() || path.join("setup.py").exists() {
        Some("python".to_string())
    } else if path.join("pom.xml").exists() || path.join("build.gradle").exists() {
        Some("java".to_string())
    } else if path.join("composer.json").exists() {
        Some("php".to_string())
    } else if path.join("CMakeLists.txt").exists() {
        Some("cpp".to_string())
    } else if path.join("package.swift").exists() {
        Some("swift".to_string())
    } else if path.join("pubspec.yaml").exists() {
        Some("flutter".to_string())
    } else {
        None
    }
}

#[cfg(target_os = "windows")]
pub fn open_explorer(path: &str) -> Result<(), String> {
    std::process::Command::new("explorer.exe")
        .arg(path)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(target_os = "macos")]
pub fn open_explorer(path: &str) -> Result<(), String> {
    std::process::Command::new("open")
        .arg(path)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
pub fn open_explorer(path: &str) -> Result<(), String> {
    std::process::Command::new("xdg-open")
        .arg(path)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(target_os = "windows")]
pub fn open_vscode(path: &str) -> Result<(), String> {
    std::process::Command::new("cmd")
        .args(&["/C", "code", path])
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(not(target_os = "windows"))]
pub fn open_vscode(path: &str) -> Result<(), String> {
    std::process::Command::new("code")
        .arg(path)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}
