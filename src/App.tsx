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
