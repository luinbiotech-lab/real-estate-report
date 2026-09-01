import type { ImportJob } from '../services/importAutomation/types';
import { database as dbp } from './database';

export const importJobRepository = {
  async save(job: ImportJob) { await (await dbp).put('importJobs', { ...job, updatedAt: new Date().toISOString() }); return job; },
  async get(id: string) { return (await dbp).get('importJobs', id) as Promise<ImportJob | undefined>; },
  async getLatest() { const jobs = await (await dbp).getAll('importJobs') as ImportJob[]; return jobs.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]; },
  async delete(id: string) { await (await dbp).delete('importJobs', id); },
};
