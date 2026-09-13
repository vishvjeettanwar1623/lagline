import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useRepoStore } from './store/useRepoStore';
import SetupScreen from './components/Setup/SetupScreen';
import Navbar from './components/Navigation/Navbar';
import CommandPalette from './components/shared/CommandPalette';
import RepoList from './components/Sidebar/RepoList';
import RepoDetail from './components/Detail/RepoDetail';
import Settings from './components/Settings/Settings';

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
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [activeView, setActiveView] = useState<'dashboard' | 'all' | 'attention'>('all');
  const [error, setError] = useState<string | null>(null);

  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [isResizing, setIsResizing] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

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
      showToast('Workspace rescan complete', 'success');
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
      showToast('GitHub remotes comparison complete', 'success');
    } catch (err: any) {
      console.error('Error comparing with remote:', err);
      showToast(err?.message || err?.toString() || 'Comparison failed', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const maxAllowed = Math.min(500, window.innerWidth * 0.45);
      const newWidth = Math.max(180, Math.min(maxAllowed, e.clientX));
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

  // Keyboard navigation & Ctrl+K command palette trigger
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
        return;
      }

      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      if (e.key === 'r' || e.key === 'R') {
        if (config?.rootPath && !isScanning) {
          handleRescan();
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
  }, [selectedRepoId, repos, config, selectRepo, isScanning]);

  // Listen to background rescan events from tray icon
  useEffect(() => {
    const unlistenPromise = listen('repos-scanned', (event: any) => {
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
        showToast('Workspace auto-updated from disk', 'success');
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
      <div className="flex flex-col items-center justify-center min-h-screen bg-[var(--bg-base)] text-[var(--text-secondary)] font-mono text-xs select-none">
        <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full mb-3" />
        <span>Initializing LagLine...</span>
      </div>
    );
  }

  const hasNoRepos = repos.length === 0;

  return (
    <div className="flex flex-col h-screen w-screen bg-[var(--bg-base)] text-[var(--text-primary)] overflow-hidden font-sans select-none transition-colors">
      {error && (
        <div className="fixed top-3 left-3 z-50 p-2.5 bg-[var(--bg-raised)] border border-rose-500/30 text-rose-400 text-xs font-mono rounded shadow-xl">
          Initialization error: {error}
        </div>
      )}

      {config?.rootPath ? (
        hasNoRepos && !isScanning ? (
          <div className="flex flex-col items-center justify-center min-h-screen bg-[#09090b] text-[#f4f4f5] font-sans p-6 text-center select-none animate-fadeIn">
            <h1 className="text-base font-mono font-semibold text-white mb-2">No Git Repositories Found</h1>
            <p className="text-xs text-[#71717a] max-w-sm mb-5 font-sans">
              No Git repositories found in <code className="text-[#a1a1aa] text-xs font-mono bg-[#141418] border border-[#27272a] px-2 py-0.5 rounded">{config.rootPath}</code>.
            </p>
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="text-xs font-mono text-black bg-white hover:bg-[#e4e4e7] px-4 py-2 rounded-md font-semibold transition-colors shadow-xs"
            >
              Change Root Folder
            </button>
            <Settings isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
          </div>
        ) : (
          <>
            {/* Docked Desktop Top Navbar */}
            <Navbar
              onOpenSettings={() => setIsSettingsOpen(true)}
              onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
              activeView={activeView}
              setActiveView={setActiveView}
              handleRescan={handleRescan}
              handleCompare={handleCompare}
              isSidebarOpen={isSidebarOpen}
              onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
            />

            {/* Main Edge-to-Edge Desktop Layout */}
            <div className="flex-1 flex overflow-hidden relative">
              {isSidebarOpen && (
                <>
                  <RepoList width={sidebarWidth} activeView={activeView} />

                  {/* Split Resizer */}
                  <div
                    onMouseDown={startResizing}
                    className={`w-[1px] hover:w-[2px] bg-[var(--border-subtle)] hover:bg-[var(--border-strong)] cursor-col-resize transition-all shrink-0 h-full ${
                      isResizing ? 'bg-[var(--border-strong)] w-[2px]' : ''
                    }`}
                  />
                </>
              )}

              {/* Main Workspace Editor Pane */}
              <RepoDetail />
            </div>

            {/* Slide-over Settings Drawer */}
            <Settings isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

            {/* Command Palette */}
            <CommandPalette
              isOpen={isCommandPaletteOpen}
              onClose={() => setIsCommandPaletteOpen(false)}
              onOpenSettings={() => setIsSettingsOpen(true)}
              onRescan={handleRescan}
              onCompare={handleCompare}
              setActiveView={setActiveView}
            />
          </>
        )
      ) : (
        <SetupScreen />
      )}

      <ToastComponent />
    </div>
  );
};

const ToastComponent: React.FC = () => {
  const toast = useRepoStore((state) => state.toast);
  if (!toast) return null;

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 flex items-center gap-2 px-3 py-2 rounded border font-mono text-xs shadow-xl animate-fadeIn ${
        toast.type === 'success'
          ? 'bg-[#1f1f1f] border-[#89d185]/40 text-[#89d185]'
          : 'bg-[#1f1f1f] border-[#f14c4c]/40 text-[#f14c4c]'
      }`}
    >
      <span
        className={`w-2 h-2 rounded-full ${
          toast.type === 'success' ? 'bg-[#89d185]' : 'bg-[#f14c4c]'
        }`}
      />
      <span>{toast.message}</span>
    </div>
  );
};

export default App;
