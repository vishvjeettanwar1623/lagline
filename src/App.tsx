import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useRepoStore } from './store/useRepoStore';
import SetupScreen from './components/Setup/SetupScreen';
import GrainOverlay from './components/shared/GrainOverlay';
import RepoList from './components/Sidebar/RepoList';
import RepoDetail from './components/Detail/RepoDetail';
import Settings from './components/Settings/Settings';
import { RefreshCw, Settings as SettingsIcon, GitBranch } from 'lucide-react';

export const App: React.FC = () => {
  const {
    config,
    setConfig,
    repos,
    setRepos,
    selectedRepoId,
    selectRepo,
    isScanning,
    setIsScanning,
    setTotalFolders,
    isSyncing,
    setIsSyncing,
  } = useRepoStore();
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRescan = async () => {
    if (!config?.rootPath || isScanning) return;
    setIsScanning(true);
    const { setScanProgress, showToast } = useRepoStore.getState();
    setScanProgress({ current: 0, total: 100, folderName: 'Starting scan...' });
    try {
      const [scannedRepos, total]: any = await Promise.all([
        invoke('scan_repos', { rootPath: config.rootPath }),
        invoke('get_total_folders', { rootPath: config.rootPath }),
      ]);
      setRepos(scannedRepos);
      setTotalFolders(total);
      showToast('Scan complete', 'success');
    } catch (err: any) {
      console.error('Error scanning repos:', err);
      showToast(err?.message || err?.toString() || 'Rescan failed', 'error');
    } finally {
      setIsScanning(false);
      setScanProgress(null);
    }
  };

  const handleCompare = async () => {
    if (!config?.githubToken || isSyncing) return;
    setIsSyncing(true);
    const { showToast } = useRepoStore.getState();
    try {
      const syncedRepos: any = await invoke('fetch_all_remotes', {
        repos,
        token: config.githubToken,
      });
      setRepos(syncedRepos);
      showToast('GitHub comparison complete', 'success');
    } catch (err: any) {
      console.error('Error comparing with remote:', err);
      showToast(err?.message || err?.toString() || 'Comparison failed', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const [sidebarWidth, setSidebarWidth] = useState(270);
  const [isResizing, setIsResizing] = useState(false);

  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = Math.max(200, Math.min(500, e.clientX));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // App initialization
  useEffect(() => {
    const initApp = async () => {
      try {
        const loadedConfig: any = await invoke('load_config');
        setConfig(loadedConfig);
        
        if (loadedConfig?.rootPath) {
          setIsScanning(true);
          const [scannedRepos, total]: any = await Promise.all([
            invoke('scan_repos', { rootPath: loadedConfig.rootPath }),
            invoke('get_total_folders', { rootPath: loadedConfig.rootPath }),
          ]);
          setRepos(scannedRepos);
          setTotalFolders(total);
        }
      } catch (err: any) {
        console.error('Failed to load initial config/scan:', err);
        setError(err.toString());
      } finally {
        setLoadingConfig(false);
        setIsScanning(false);
      }
    };

    initApp();
  }, [setConfig, setRepos, setIsScanning, selectRepo, setTotalFolders]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      if (e.key === 'r' || e.key === 'R') {
        if (config?.rootPath && !isScanning) {
          const rescan = async () => {
            setIsScanning(true);
            try {
              const scannedRepos: any = await invoke('scan_repos', { rootPath: config.rootPath });
              setRepos(scannedRepos);
            } catch (err) {
              console.error('Error scanning:', err);
            } finally {
              setIsScanning(false);
            }
          };
          rescan();
        }
      } else if (e.key === 's' || e.key === 'S') {
        setIsSettingsOpen(true);
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (repos.length === 0) return;
        e.preventDefault();
        const currentIndex = repos.findIndex((r) => r.id === selectedRepoId);
        let nextIndex = 0;
        if (e.key === 'ArrowDown') {
          nextIndex = (currentIndex + 1) % repos.length;
        } else {
          nextIndex = currentIndex - 1 < 0 ? repos.length - 1 : currentIndex - 1;
        }
        selectRepo(repos[nextIndex].id);
      } else if (e.key === 'Enter') {
        if (selectedRepoId) {
          invoke('open_in_vscode', { path: selectedRepoId }).catch((err) =>
            console.error('Failed to open VSCode:', err)
          );
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedRepoId, repos, config, selectRepo, isScanning, setRepos, setIsScanning]);

  // Auto rescan interval
  useEffect(() => {
    if (!config?.rootPath || !config.autoRescanInterval || config.autoRescanInterval === 'off') {
      return;
    }

    const value = parseInt(config.autoRescanInterval.slice(0, -1), 10);
    if (isNaN(value)) return;
    
    let ms = value * 60000;

    const timer = setInterval(async () => {
      try {
        const scannedRepos: any = await invoke('scan_repos', { rootPath: config.rootPath });
        
        // If github token exists, we will also sync remotes in Session 3,
        // but for now we just scan local repositories.
        if (config.githubToken) {
          const syncedRepos: any = await invoke('fetch_all_remotes', {
            repos: scannedRepos,
            token: config.githubToken,
          });
          setRepos(syncedRepos);
        } else {
          setRepos(scannedRepos);
        }
      } catch (err) {
        console.error('Auto-rescan failed:', err);
      }
    }, ms);

    return () => clearInterval(timer);
  }, [config, setRepos]);

  // Listen to background rescan events from tray icon
  useEffect(() => {
    let unlistenPromise = listen('repos-scanned', (event: any) => {
      if (Array.isArray(event.payload)) {
        setRepos(event.payload);
        if (event.payload.length > 0 && !selectedRepoId) {
          selectRepo(event.payload[0].id);
        }
      }
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, [setRepos, selectedRepoId, selectRepo]);

  // Listen to scan progress updates
  useEffect(() => {
    const { setScanProgress } = useRepoStore.getState();
    const unlistenPromise = listen('scan-progress', (event: any) => {
      if (event.payload) {
        setScanProgress(event.payload);
      }
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  // Listen to filesystem watcher changes for automatic rescan
  useEffect(() => {
    if (!config?.rootPath) return;

    const unlistenPromise = listen('watcher-rescan', async () => {
      if (isScanning || isSyncing) return;
      setIsScanning(true);
      const { setScanProgress, showToast } = useRepoStore.getState();
      setScanProgress({ current: 0, total: 100, folderName: 'Auto-detecting file changes...' });
      try {
        const [scannedRepos, total]: any = await Promise.all([
          invoke('scan_repos', { rootPath: config.rootPath }),
          invoke('get_total_folders', { rootPath: config.rootPath }),
        ]);
        setRepos(scannedRepos);
        setTotalFolders(total);
        showToast('Auto-updated from disk', 'success');
      } catch (err) {
        console.error('Auto rescan failed:', err);
      } finally {
        setIsScanning(false);
        setScanProgress(null);
      }
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, [config?.rootPath, isScanning, isSyncing, setRepos, setTotalFolders, setIsScanning]);

  if (loadingConfig) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-bg-base text-text-secondary font-mono text-sm">
        Initializing LagLine...
      </div>
    );
  }

  const hasNoRepos = repos.length === 0;

  return (
    <>
      <GrainOverlay />
      {error && (
        <div className="fixed top-4 left-4 z-50 p-3 bg-red-950/50 border border-status-ahead/30 text-status-ahead text-xs rounded">
          Init error: {error}
        </div>
      )}
      {config?.rootPath ? (
        hasNoRepos && !isScanning ? (
          // Empty dashboard state
          <div className="flex flex-col items-center justify-center min-h-screen bg-bg-base text-text-secondary font-sans p-6 text-center select-none animate-fadeIn">
            <h1 className="text-xl font-mono text-text-primary mb-2">No Git repos found</h1>
            <p className="text-sm text-text-ghost max-w-sm mb-6">
              We couldn't find any Git repositories in <code className="text-accent-warm text-xs font-mono">{config.rootPath}</code>.
            </p>
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="text-xs font-mono text-text-primary hover:bg-bg-raised border border-border-subtle bg-bg-wash px-4 py-2 rounded transition-colors duration-150"
            >
              Change root folder
            </button>
            <Settings isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
          </div>
        ) : (
          <div className="flex h-screen bg-bg-base overflow-hidden">
            <RepoList width={sidebarWidth} />
            <div
              onMouseDown={startResizing}
              className={`w-[3px] hover:w-[5px] bg-transparent hover:bg-bg-wash cursor-col-resize transition-all duration-150 shrink-0 h-full ${
                isResizing ? 'bg-bg-wash w-[5px]' : ''
              }`}
            />
            {/* Right panel: persistent top bar + detail content */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Always-visible action pill buttons top bar */}
              <div className="px-6 py-3 border-b border-border-subtle bg-bg-base flex items-center justify-end gap-2 shrink-0 select-none">
                {config?.githubToken && (
                  <button
                    onClick={handleCompare}
                    disabled={isSyncing || isScanning}
                    title="Compare local vs GitHub"
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-mono border transition-all duration-150 ${
                      isSyncing
                        ? 'bg-bg-raised border-border-active text-text-primary animate-pulse'
                        : 'bg-bg-surface border-border-subtle text-text-secondary hover:text-text-primary hover:bg-bg-raised hover:border-border-active'
                    }`}
                  >
                    <GitBranch className="w-3 h-3" />
                    {isSyncing ? 'Comparing…' : 'Compare'}
                  </button>
                )}
                <button
                  onClick={handleRescan}
                  disabled={isScanning || isSyncing || !config?.rootPath}
                  title="Rescan all folders"
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-mono border transition-all duration-150 ${
                    isScanning
                      ? 'bg-bg-raised border-border-active text-text-primary animate-pulse'
                      : 'bg-bg-surface border-border-subtle text-text-secondary hover:text-text-primary hover:bg-bg-raised hover:border-border-active'
                  }`}
                >
                  <RefreshCw className={`w-3 h-3 ${isScanning ? 'animate-spin' : ''}`} />
                  {isScanning ? 'Scanning…' : 'Rescan'}
                </button>
                <button
                  onClick={() => setIsSettingsOpen(true)}
                  title="Settings"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-mono border border-border-subtle bg-bg-surface text-text-secondary hover:text-text-primary hover:bg-bg-raised hover:border-border-active transition-all duration-150"
                >
                  <SettingsIcon className="w-3 h-3" />
                  Settings
                </button>
              </div>
              <RepoDetail />
            </div>
            <Settings isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
          </div>
        )
      ) : (
        <SetupScreen />
      )}
      <ToastComponent />
    </>
  );
};

const ToastComponent: React.FC = () => {
  const toast = useRepoStore((state) => state.toast);
  if (!toast) return null;

  return (
    <div className={`fixed bottom-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded border font-mono text-[11px] shadow-lg animate-fadeIn ${
      toast.type === 'success'
        ? 'bg-status-clean/20 border-status-clean/30 text-text-primary'
        : 'bg-status-ahead/20 border-status-ahead/30 text-text-primary'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${
        toast.type === 'success' ? 'bg-[#5a9a5a]' : 'bg-[#c0392b]'
      }`} />
      {toast.message}
    </div>
  );
};

export default App;
