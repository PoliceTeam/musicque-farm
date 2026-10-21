'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { performanceRecorder, performanceReport } from '@/application/performance-log';
import './performance-panel.css';

export default function PerformancePanel() {
  const { t } = useTranslation('common');
  const [runs, setRuns] = useState(() => performanceRecorder()?.snapshot() ?? []);
  useEffect(() => performanceRecorder()?.subscribe(() => setRuns(performanceRecorder()?.snapshot() ?? [])), []);
  const current = runs.at(-1);

  function exportReport() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(performanceReport(), null, 2)], { type: 'application/json' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `ice-city-performance-${Date.now()}.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <details className="game-performance-panel" open>
      <summary>{t('performance.title')}</summary>
      <p>{t('performance.localOnly')}</p>
      <strong>{current ? `${current.id}: ${current.route}` : t('performance.waiting')}</strong>
      <table>
        <thead>
          <tr>
            <th>{t('performance.phase')}</th>
            <th>{t('performance.elapsed')}</th>
            <th>{t('performance.duration')}</th>
          </tr>
        </thead>
        <tbody>
          {current?.entries.map((entry) => (
            <tr key={`${current.id}-${entry.id}`}>
              <td>{entry.phase}</td>
              <td>{entry.atMs} ms</td>
              <td>{entry.durationMs === undefined ? '—' : `${entry.durationMs} ms`}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" onClick={exportReport}>
        {t('performance.export')}
      </button>
    </details>
  );
}
