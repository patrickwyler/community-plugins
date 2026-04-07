/*
 * Copyright 2026 The Backstage Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { CatalogApi } from '@backstage/catalog-client';
import { Entity } from '@backstage/catalog-model';
import { EntityService } from './Service';

describe('EntityService', () => {
  const queryEntities = jest.fn();
  const getEntities = jest.fn();

  const catalogApi = {
    queryEntities,
    getEntities,
  } as unknown as CatalogApi;

  const service = new EntityService(catalogApi);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches entities without fullTextFilter for empty search term', async () => {
    const items = [{ metadata: { name: 'alice' } }] as Entity[];
    queryEntities.mockResolvedValue({ items, totalItems: 1 });

    const response = await service.fetchEntities('   ', 20, 40);

    expect(queryEntities).toHaveBeenCalledWith({
      filter: [{ kind: 'group' }, { kind: 'user' }],
      limit: 20,
      offset: 40,
      orderFields: { field: 'metadata.name', order: 'asc' },
    });
    expect(response).toEqual({ items, totalItems: 1 });
  });

  it('fetches entities with fullTextFilter when search term is provided', async () => {
    const items = [{ metadata: { name: 'team-a' } }] as Entity[];
    queryEntities.mockResolvedValue({ items, totalItems: 1 });

    const response = await service.fetchEntities('team', 10, 0);

    expect(queryEntities).toHaveBeenCalledWith({
      filter: [{ kind: 'group' }, { kind: 'user' }],
      limit: 10,
      offset: 0,
      orderFields: { field: 'metadata.name', order: 'asc' },
      fullTextFilter: {
        term: 'team',
        fields: [
          'metadata.name',
          'kind',
          'spec.profile.displayName',
          'metadata.title',
        ],
      },
    });
    expect(response).toEqual({ items, totalItems: 1 });
  });

  it('fetches group members for a group name', async () => {
    const items = [{ metadata: { name: 'jane' } }] as Entity[];
    getEntities.mockResolvedValue({ items });

    const response = await service.fetchGroupMembers('platform');

    expect(getEntities).toHaveBeenCalledWith({
      filter: {
        kind: 'User',
        'relations.memberOf': ['group:default/platform'],
      },
    });
    expect(response).toEqual(items);
  });
});
