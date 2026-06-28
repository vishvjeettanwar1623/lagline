import { create } from 'zustand';
import { RepoInfo, AppConfig } from '../types/repo';

interface RepoState {
  repos: RepoInfo[];
  selectedRepoId: string | null;
  config: AppConfig | null;
  isScanning: boolean;
  isSyncing: boolean;
  totalFolders: number;
  toast: { message: string; type: 'success' | 'error' } | null;
  scanProgress: { current: number; total: number; folderName: string } | null;
  setRepos: (repos: RepoInfo[]) => void;
  selectRepo: (id: string | null) => void;
  setConfig: (config: AppConfig | null) => void;
  updateRepo: (repo: RepoInfo) => void;
  setIsScanning: (isScanning: boolean) => void;
  setIsSyncing: (isSyncing: boolean) => void;
  setTotalFolders: (totalFolders: number) => void;
  showToast: (message: string, type: 'success' | 'error') => void;
  setScanProgress: (progress: { current: number; total: number; folderName: string } | null) => void;
}

export const useRepoStore = create<RepoState>((set) => ({
  repos: [],
  selectedRepoId: null,
  config: null,
  isScanning: false,
  isSyncing: false,
  totalFolders: 0,
  toast: null,
  scanProgress: null,
  setRepos: (repos) => set({ repos }),
  selectRepo: (selectedRepoId) => set({ selectedRepoId }),
  setConfig: (config) => set({ config }),
  updateRepo: (updatedRepo) =>
    set((state) => ({
      repos: state.repos.map((repo) => (repo.id === updatedRepo.id ? updatedRepo : repo)),
    })),
  setIsScanning: (isScanning) => set((state) => ({ 
    isScanning,
    scanProgress: isScanning ? state.scanProgress : null
  })),
  setIsSyncing: (isSyncing) => set({ isSyncing }),
  setTotalFolders: (totalFolders) => set({ totalFolders }),
  showToast: (message, type) => {
    set({ toast: { message, type } });
    setTimeout(() => {
      set((state) => {
        if (state.toast?.message === message) {
          return { toast: null };
        }
        return {};
      });
    }, 3000);
  },
  setScanProgress: (scanProgress) => set({ scanProgress }),
}));
