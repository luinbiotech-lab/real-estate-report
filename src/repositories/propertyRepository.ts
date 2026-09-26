import type { Property, Settings } from '../types';
import { REMOTE_OPERATIONAL_MODE } from '../services/operationalDataMode';
import { remoteDataGateway } from '../services/remoteDataGateway';
import { database as dbp } from './database';

export interface PropertyRepository {
  create(p: Property): Promise<Property>;
  update(p: Property): Promise<Property>;
  delete(id: string): Promise<void>;
  getById(id: string): Promise<Property | undefined>;
  getAll(): Promise<Property[]>;
  bulkCreate(items: Property[]): Promise<Property[]>;
  search(query: string): Promise<Property[]>;
}

export const propertyRepository: PropertyRepository = {
  async create(property) {
    if (REMOTE_OPERATIONAL_MODE) return remoteDataGateway.upsertProperty(property);
    await (await dbp).put('properties', property);
    return property;
  },
  async update(property) {
    if (REMOTE_OPERATIONAL_MODE) return remoteDataGateway.upsertProperty(property);
    await (await dbp).put('properties', property);
    return property;
  },
  async delete(id) {
    if (REMOTE_OPERATIONAL_MODE) return remoteDataGateway.deleteProperty(id);
    await (await dbp).delete('properties', id);
  },
  async getById(id) {
    if (REMOTE_OPERATIONAL_MODE) return remoteDataGateway.getProperty(id);
    return (await dbp).get('properties', id);
  },
  async getAll() {
    if (REMOTE_OPERATIONAL_MODE) return remoteDataGateway.listProperties();
    return (await dbp).getAll('properties');
  },
  async bulkCreate(items) {
    if (REMOTE_OPERATIONAL_MODE) {
      for (const item of items) await remoteDataGateway.upsertProperty(item);
      return items;
    }
    const tx = (await dbp).transaction('properties', 'readwrite');
    await Promise.all([...items.map((property) => tx.store.put(property)), tx.done]);
    return items;
  },
  async search(query) {
    const search = query.toLowerCase();
    return (await this.getAll()).filter((property) =>
      [property.name, property.address, property.buildingName, property.propertyNumber, property.managerName]
        .some((value) => value.toLowerCase().includes(search)),
    );
  },
};

export const settingsRepository = {
  async get(): Promise<Settings | undefined> {
    if (REMOTE_OPERATIONAL_MODE) return remoteDataGateway.getCompanySettings();
    return (await dbp).get('settings', 'main');
  },
  async save(value: Settings) {
    if (REMOTE_OPERATIONAL_MODE) {
      await remoteDataGateway.saveCompanySettings(value);
      return;
    }
    await (await dbp).put('settings', value, 'main');
  },
};
