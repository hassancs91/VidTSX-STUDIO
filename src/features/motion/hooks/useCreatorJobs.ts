import { useCallback, useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import { useToast } from '@renderer/contexts/ToastContext';
import { useTsxJobs } from '../contexts/TsxJobsContext';
import {
  centreBuildJob,
  isJobFinished,
  jobOutcome,
  openProjectJob,
  pendingProjectJobs,
  waitingFor,
} from '../services/creator-jobs';
import { versionNumberOf } from '../services/edit-job-request';
import type { useMotionProject } from './useMotionProject';

interface Options {
  projectManagerRef: MutableRefObject<ReturnType<typeof useMotionProject>>;
  openFolderPath: string | null;
  /** The open version's path: any change of it leaves the build view. */
  openVersion: string | null;
  scheduleLibraryRefresh: () => void;
}

/**
 * The Creator's side of the job engine (P3 parts 2-3): which jobs show where,
 * which build the centre panel watches, and what a finished job does. The
 * rules are services/creator-jobs.ts; this hook holds the watched build and
 * runs the side effects (open, toast, library refresh).
 */
export function useCreatorJobs({ projectManagerRef, openFolderPath, openVersion, scheduleLibraryRefresh }: Options) {
  const { jobs, otherBuildActive } = useTsxJobs();
  const { showToast } = useToast();
  const [watchedBuildId, setWatchedBuildId] = useState<string | null>(null);
  const watchedRef = useRef(watchedBuildId);
  watchedRef.current = watchedBuildId;

  // Opening any version — the library, a toast, the watched build's own
  // result — leaves the build view, as it leaves Templates mode.
  const lastOpenVersionRef = useRef(openVersion);
  useEffect(() => {
    if (openVersion === lastOpenVersionRef.current) return;
    lastOpenVersionRef.current = openVersion;
    if (openVersion) setWatchedBuildId(null);
  }, [openVersion]);

  // Job completion side effects. First sightings (the initial list, a fresh
  // job) do nothing; a status change runs the job's outcome once.
  const jobStatusesRef = useRef(new Map<string, string>());
  useEffect(() => {
    for (const job of jobs) {
      const prev = jobStatusesRef.current.get(job.id);
      if (prev === job.status) continue;
      jobStatusesRef.current.set(job.id, job.status);
      if (prev === undefined) continue;

      const pm = projectManagerRef.current;
      const outcome = jobOutcome(job, { openFolderPath: pm.project?.folderPath ?? null, watchedJobId: watchedRef.current });
      if (outcome.type === 'open' || outcome.type === 'offer') {
        const { versionPath, folderPath } = outcome;
        // A Studio shot folder (append-only): its section rescans, and the toast says where the version went.
        const studioNotice = pm.studioSaveNoticeFor(folderPath, versionNumberOf(versionPath));
        scheduleLibraryRefresh();
        if (outcome.type === 'open') {
          void pm.loadVersion(versionPath, folderPath);
          if (studioNotice) showToast(studioNotice, 'success');
        } else {
          showToast(studioNotice ?? outcome.message, 'success', {
            label: 'Open',
            onClick: () => { void projectManagerRef.current.loadVersion(versionPath, folderPath); },
          });
        }
        if (outcome.notice) showToast(outcome.notice, 'info');
      } else if (outcome.type === 'error') {
        showToast(outcome.message, 'error');
      }
    }
  }, [jobs, showToast, scheduleLibraryRefresh, projectManagerRef]);

  const watchBuild = useCallback((jobId: string | null) => setWatchedBuildId(jobId), []);

  const centreBuild = centreBuildJob(jobs, watchedBuildId, openFolderPath);
  // The open folder's thread re-reads when a job that wrote to it ends.
  const endedHere = openFolderPath
    ? jobs.filter((j) => isJobFinished(j) && (j.folderPath === openFolderPath || j.targetFolderPath === openFolderPath)).length
    : 0;
  return {
    /** Running jobs that will add a project: placeholder rows in the library. */
    pendingJobs: pendingProjectJobs(jobs),
    /** The open project's builder edit in flight. */
    openProjectJob: openProjectJob(jobs, openFolderPath),
    /** The build the centre panel shows instead of the preview. */
    centreBuild,
    centreBuildWaiting: centreBuild ? waitingFor(centreBuild, jobs, otherBuildActive) : null,
    /** Changes when a job on the open folder ends: the thread re-reads its chat.json. */
    threadKey: `${openFolderPath ?? ''}:${endedHere}`,
    watchedBuildId,
    watchBuild,
  };
}
