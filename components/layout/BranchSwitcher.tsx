'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { switchActiveBranch } from '@/app/(dashboard)/actions/branch';

type Branch = {
  id: string;
  name: string;
  enabledModules: string[];
};

type Props = {
  branches: Branch[];
  activeBranchId: string | null;
};

export default function BranchSwitcher({ branches, activeBranchId }: Props) {
  const router = useRouter();
  const initialBranchId = activeBranchId ?? branches[0]?.id ?? '';
  const [selectedBranchId, setSelectedBranchId] = useState(initialBranchId);

  useEffect(() => {
    if (!activeBranchId && branches.length > 0) {
      void switchActiveBranch(branches[0].id).then((result) => {
        if (result.success) router.refresh();
      });
    }
  }, [activeBranchId, branches, router]);

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const nextBranchId = e.target.value;
    setSelectedBranchId(nextBranchId);
    const result = await switchActiveBranch(nextBranchId);
    if (result.success) {
      router.refresh();
    } else if (activeBranchId) {
      setSelectedBranchId(activeBranchId);
    }
  }

  if (branches.length === 0) return null;

  // Fix 13: Show branch name as static label when only one branch
  if (branches.length === 1) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 10px',
          fontSize: '.85rem',
          marginRight: '10px',
          color: 'var(--text)',
          background: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-sm)',
        }}
      >
        <span className="material-icons-outlined" style={{ fontSize: '16px' }}>store</span>
        {branches[0].name}
      </div>
    );
  }

  return (
    <select
      value={selectedBranchId}
      onChange={handleChange}
      className="form-control"
      style={{ width: 'auto', minWidth: '160px', padding: '4px 8px', fontSize: '.85rem', marginRight: '10px' }}
      aria-label="Switch active branch"
    >
      {branches.map((branch) => (
        <option key={branch.id} value={branch.id}>
          {branch.name}
        </option>
      ))}
    </select>
  );
}
