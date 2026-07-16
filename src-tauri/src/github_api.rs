use crate::git_ops::{RepoInfo, AheadCommit};
use reqwest::header::{HeaderMap, HeaderValue, USER_AGENT, AUTHORIZATION, ACCEPT};
use serde_json::Value;

/// Parses a GitHub URL (HTTPS or SSH) to extract the owner and repository name.
fn parse_github_url(url: &str) -> Option<(String, String)> {
    if !url.contains("github.com") {
        return None;
    }

    // SSH format: git@github.com:owner/repo.git
    if url.starts_with("git@") {
        let parts: Vec<&str> = url.split(':').collect();
        if parts.len() >= 2 {
            let path = parts[1].trim_end_matches(".git");
            let path_parts: Vec<&str> = path.split('/').collect();
            if path_parts.len() >= 2 {
                return Some((path_parts[0].to_string(), path_parts[1].to_string()));
            }
        }
    }

    // HTTPS format: https://github.com/owner/repo.git
    if url.starts_with("http") {
        let parts: Vec<&str> = url.split("github.com/").collect();
        if parts.len() >= 2 {
            let path = parts[1].trim_end_matches(".git");
            let path_parts: Vec<&str> = path.split('/').collect();
            if path_parts.len() >= 2 {
                return Some((path_parts[0].to_string(), path_parts[1].to_string()));
            }
        }
    }

    None
}

/// Helper to query GitHub REST API for commits on a branch.
async fn fetch_commits_from_github(
    owner: &str,
    repo_name: &str,
    branch: &str,
    token: &str,
) -> Result<Vec<Value>, String> {
    let url = format!(
        "https://api.github.com/repos/{}/{}/commits?sha={}&per_page=50",
        owner, repo_name, branch
    );

    let mut headers = HeaderMap::new();
    headers.insert(USER_AGENT, HeaderValue::from_static("GitPulse"));
    headers.insert(ACCEPT, HeaderValue::from_static("application/vnd.github.v3+json"));

    if !token.is_empty() {
        let auth_val = format!("token {}", token);
        let mut auth_header = HeaderValue::from_str(&auth_val).map_err(|e| e.to_string())?;
        auth_header.set_sensitive(true);
        headers.insert(AUTHORIZATION, auth_header);
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;

    let response = client
        .get(&url)
        .headers(headers)
        .send()
        .await
        .map_err(|e| format!("Network request failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        
        // Parse error message if available
        let err_msg = if let Ok(json_body) = serde_json::from_str::<Value>(&body) {
            json_body.get("message")
                .and_then(|m| m.as_str())
                .unwrap_or(&body)
                .to_string()
        } else {
            body
        };

        return Err(format!("GitHub API error ({}): {}", status, err_msg));
    }

    let commits: Vec<Value> = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response JSON: {}", e))?;

    Ok(commits)
}

/// Checks if a commit SHA exists in the local repository.
fn commit_exists_locally(repo: &git2::Repository, sha: &str) -> bool {
    if let Ok(oid) = git2::Oid::from_str(sha) {
        repo.find_commit(oid).is_ok()
    } else {
        false
    }
}

/// Compares remote commits against the local database to find behind commits.
fn get_behind_commits(repo: &git2::Repository, remote_commits: &[Value]) -> Vec<AheadCommit> {
    let mut behind = Vec::new();
    for commit_val in remote_commits {
        if let Some(sha) = commit_val.get("sha").and_then(|v| v.as_str()) {
            if !commit_exists_locally(repo, sha) {
                let message = commit_val
                    .get("commit")
                    .and_then(|c| c.get("message"))
                    .and_then(|m| m.as_str())
                    .unwrap_or("")
                    .to_string();

                let timestamp = commit_val
                    .get("commit")
                    .and_then(|c| c.get("author"))
                    .and_then(|a| a.get("date"))
                    .and_then(|d| d.as_str())
                    .unwrap_or("")
                    .to_string();

                let hash = if sha.len() >= 7 { &sha[..7] } else { sha };

                behind.push(AheadCommit {
                    hash: hash.to_string(),
                    message,
                    timestamp,
                });
            }
        }
    }
    behind
}

#[tauri::command]
pub(crate) async fn fetch_remote_status(app: tauri::AppHandle, repo_path: String, token: String) -> Result<RepoInfo, String> {
    crate::validate_path(&app, &repo_path).await?;
    let path = std::path::Path::new(&repo_path);
    let mut info = crate::git_ops::get_repo_info(path)?;

    let url = match &info.remote_url {
        Some(u) => u,
        None => return Ok(info),
    };

    let (owner, repo_name) = match parse_github_url(url) {
        Some(parsed) => parsed,
        None => return Ok(info), // Non-GitHub remote, skip sync
    };

    let repo = git2::Repository::open(path).map_err(|e| e.to_string())?;
    let branch = info.branch.clone();

    // Fetch remote commits from GitHub
    let remote_commits = fetch_commits_from_github(&owner, &repo_name, &branch, &token).await?;

    // Compare with local repository
    let behind_commits = get_behind_commits(&repo, &remote_commits);
    info.behind_count = behind_commits.len();
    info.behind_commits = behind_commits;

    // Recalculate status with remote sync details
    info.status = crate::git_ops::determine_status(
        &info.remote_url,
        info.ahead_count,
        info.behind_count,
        !info.changed_files.is_empty(),
    );

    Ok(info)
}

#[tauri::command]
pub(crate) async fn fetch_all_remotes(
    app: tauri::AppHandle,
    repos: Vec<RepoInfo>,
    token: String,
) -> Result<Vec<RepoInfo>, String> {
    let mut updated_repos = Vec::new();
    for repo in repos {
        if repo.remote_url.is_none() || repo.remote_type.as_deref() != Some("github") {
            updated_repos.push(repo);
            continue;
        }

        match fetch_remote_status(app.clone(), repo.local_path.clone(), token.clone()).await {
            Ok(updated) => updated_repos.push(updated),
            Err(err) => {
                println!("Failed syncing remote for {}: {}", repo.name, err);
                updated_repos.push(repo);
            }
        }
    }
    crate::update_tray_icon(&app, &updated_repos);
    Ok(updated_repos)
}
