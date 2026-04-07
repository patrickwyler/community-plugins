/*
 * Copyright 2025 The Backstage Authors
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
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Entity } from '@backstage/catalog-model';
import { useApi, configApiRef } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import {
  Card,
  CardHeader,
  CardBody,
  Avatar,
  TextField,
  Text,
  Box,
  Skeleton,
  Button,
} from '@backstage/ui';
import { RiUserLine, RiTeamLine, RiAddLine } from '@remixicon/react';
import { ParticipantsList } from './List';
import { EntityService } from './Service';
import classes from './Participants.module.css';

export interface Participant {
  id: string;
  name: string;
  displayName?: string;
  fromGroup?: string;
}

interface EntitySpec {
  profile?: {
    displayName?: string;
  };
  [key: string]: any;
}

export interface ParticipantsProps {
  onParticipantsChange: (participants: Participant[]) => void;
  initialParticipants?: Participant[];
}

export const Participants = ({
  onParticipantsChange,
  initialParticipants = [],
}: ParticipantsProps) => {
  const catalogApi = useApi(catalogApiRef);
  const configApi = useApi(configApiRef);
  const searchLimit =
    configApi.getOptionalNumber('wheelOfNames.searchLimit') || 10;
  const [entities, setEntities] = useState<Entity[]>([]);
  const [excludedUsers, setExcludedUsers] = useState<Set<string>>(new Set());
  const [resolvedParticipants, setResolvedParticipants] = useState<
    Array<{
      id: string;
      name: string;
      displayName?: string;
      fromGroup?: string;
    }>
  >(initialParticipants);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [processingGroups, setProcessingGroups] = useState(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [inputValue, setInputValue] = useState<string>('');
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(
    null,
  );

  // New state variables for pagination
  const [page, setPage] = useState<number>(0);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadingRef = useRef<HTMLLIElement | null>(null);

  // Create service instance
  const entityService = useMemo(
    () => new EntityService(catalogApi),
    [catalogApi],
  );

  const visibleEntities = useMemo(() => {
    const selectedIds = new Set(resolvedParticipants.map(p => p.id));

    return entities.filter(entity => {
      if (!entity.metadata.uid) {
        return false;
      }

      if (selectedIds.has(entity.metadata.uid)) {
        return false;
      }

      if (entity.kind === 'User' && excludedUsers.has(entity.metadata.uid)) {
        return false;
      }

      return true;
    });
  }, [entities, excludedUsers, resolvedParticipants]);

  // Handle intersection observer for infinite scrolling
  const lastElementRef = useCallback(
    (node: HTMLLIElement | null) => {
      if (loading) return;
      if (observerRef.current) observerRef.current.disconnect();

      observerRef.current = new IntersectionObserver(entries => {
        if (entries[0].isIntersecting && hasMore && searchTerm) {
          setPage(prevPage => prevPage + 1);
        }
      });

      if (node) observerRef.current.observe(node);
    },
    [loading, hasMore, searchTerm],
  );

  // Effect to fetch entities based on search term
  useEffect(() => {
    if (!searchTerm) {
      setEntities([]);
      setHasMore(true);
      setPage(0);
      return;
    }

    // Reset when search term changes
    if (page === 0) {
      setEntities([]);
    }

    const loadEntities = async () => {
      setLoading(true);
      try {
        const offset = page * searchLimit;
        const fetchedEntities = await entityService.fetchEntities(
          searchTerm,
          searchLimit,
          offset,
        );

        // If fewer entries are returned than requested, we've reached the end
        if (fetchedEntities.items.length < searchLimit) {
          setHasMore(false);
        } else {
          setHasMore(true);
        }

        // Append entries instead of replacing them
        setEntities(prevEntities =>
          page === 0
            ? fetchedEntities.items
            : [...prevEntities, ...fetchedEntities.items],
        );
      } catch (err) {
        setError(
          err instanceof Error ? err : new Error('Failed to load entities'),
        );
        setHasMore(false);
      } finally {
        setLoading(false);
      }
    };

    loadEntities();
  }, [entityService, searchTerm, searchLimit, page]);

  // Handle search input with debounce
  const handleSearchChange = (valueOrEvent: unknown) => {
    const value =
      typeof valueOrEvent === 'string'
        ? valueOrEvent
        : (valueOrEvent as { target?: { value?: string } })?.target?.value ??
          '';
    setInputValue(value); // Update input value immediately for responsiveness

    // Clear any existing timeout
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    // Set a new timeout to update search term after user stops typing
    const timeout = setTimeout(() => {
      // Reset when search term changes
      setPage(0);
      setEntities([]);
      setHasMore(true);
      setSearchTerm(value);
    }, 300); // 300ms debounce

    setSearchTimeout(timeout);
  };

  // Add entity to participants (either a user directly or members of a group)
  const handleAddEntity = async (entity: Entity) => {
    if (!entity.metadata.uid) return;

    setProcessingGroups(true);

    try {
      if (entity.kind === 'Group') {
        // If it's a group, fetch its members
        const groupMembers = await entityService.fetchGroupMembers(
          entity.metadata.name,
        );

        // Process all members of the group that aren't already excluded
        const newParticipants = [];

        for (const member of groupMembers) {
          if (!member.metadata.uid || excludedUsers.has(member.metadata.uid))
            continue;

          // Skip if already in participants
          if (resolvedParticipants.some(p => p.id === member.metadata.uid))
            continue;

          newParticipants.push({
            id: member.metadata.uid,
            name: member.metadata.name,
            displayName:
              // Type assertion to handle potential undefined values
              (member.spec as EntitySpec)?.profile?.displayName ||
              member.metadata.title ||
              member.metadata.name,
            fromGroup: entity.metadata.name,
          });
        }

        // Add new participants to existing ones
        const updatedParticipants = [
          ...resolvedParticipants,
          ...newParticipants,
        ];
        setResolvedParticipants(updatedParticipants);
        onParticipantsChange(updatedParticipants);
      } else {
        // Skip if already in participants
        if (resolvedParticipants.some(p => p.id === entity.metadata.uid))
          return;

        const newParticipant: Participant = {
          id: entity.metadata.uid,
          name: entity.metadata.name,
          displayName:
            // Type assertion to handle potential undefined values
            (entity.spec as EntitySpec)?.profile?.displayName ||
            entity.metadata.title ||
            entity.metadata.name,
        };

        const updatedParticipants = [...resolvedParticipants, newParticipant];
        setResolvedParticipants(updatedParticipants);
        onParticipantsChange(updatedParticipants);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to add entity'));
    } finally {
      setProcessingGroups(false);
    }
  };

  // Handle removal of a participant
  const handleRemoveParticipant = (participantId: string) => {
    // Find the participant to determine if it was from a group
    const participant = resolvedParticipants.find(p => p.id === participantId);

    if (participant && participant.fromGroup) {
      // If from a group, add to excluded users to prevent re-adding when group is selected again
      setExcludedUsers(prev => new Set([...prev, participantId]));
    }

    // Remove from participants list
    const updatedParticipants = resolvedParticipants.filter(
      p => p.id !== participantId,
    );

    setResolvedParticipants(updatedParticipants);
    onParticipantsChange(updatedParticipants);
  };

  // Clear all participants
  const handleClearSelection = () => {
    setResolvedParticipants([]);
    setExcludedUsers(new Set());
    onParticipantsChange([]);
  };

  return (
    <Card>
      <CardHeader title="Participants" />
      <CardBody>
        {error && (
          <Box
            style={{
              padding: '16px',
              marginBottom: '16px',
              backgroundColor: '#fee',
              border: '1px solid #fcc',
              borderRadius: '4px',
              color: '#c33',
            }}
          >
            <Text>{error.message}</Text>
          </Box>
        )}

        {/* Search field */}
        <Box style={{ marginBottom: '16px' }}>
          <TextField
            label="Search users and groups"
            value={inputValue}
            onChange={handleSearchChange}
            placeholder="Search users and groups"
          />
        </Box>

        {/* Search Results */}
        {searchTerm && (visibleEntities.length > 0 || loading) && (
          <Card className={classes.searchResults}>
            <div>
              <Text weight="bold" className={classes.resultsHeader}>
                {visibleEntities.length} results
              </Text>
              <hr />
            </div>
            <ul className={classes.searchResultsList}>
              {visibleEntities.map((entity, index) => {
                const displayName =
                  // Type assertion to handle potential undefined values
                  (entity.spec as EntitySpec)?.profile?.displayName ||
                  entity.metadata.title ||
                  entity.metadata.name;

                return (
                  <li
                    key={entity.metadata.uid}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '8px 16px',
                      borderBottom: '1px solid var(--bui-border)',
                      cursor: 'pointer',
                    }}
                    ref={
                      index === visibleEntities.length - 1
                        ? lastElementRef
                        : undefined
                    }
                  >
                    <Avatar
                      src=""
                      name={displayName}
                      className={
                        entity.kind === 'Group'
                          ? classes.groupAvatar
                          : classes.userAvatar
                      }
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '40px',
                        height: '40px',
                        color: 'white',
                        fontSize: '20px',
                      }}
                    >
                      {entity.kind === 'Group' ? (
                        <RiTeamLine size={20} />
                      ) : (
                        <RiUserLine size={20} />
                      )}
                    </Avatar>
                    <div style={{ flex: 1 }}>
                      <Text>{displayName}</Text>
                      <Text
                        style={{
                          fontSize: '12px',
                          color: '#666',
                          paddingLeft: '8px',
                        }}
                      >
                        {entity.kind}
                      </Text>
                    </div>
                    <Button
                      aria-label="Add participant"
                      onClick={() => handleAddEntity(entity)}
                      isDisabled={processingGroups}
                    >
                      <RiAddLine />
                    </Button>
                  </li>
                );
              })}
              {/* Loading indicator for infinite scrolling */}
              {loading && (
                <li
                  ref={loadingRef}
                  style={{ padding: '8px', textAlign: 'center' }}
                >
                  <Skeleton width="100%" height={24} />
                </li>
              )}
            </ul>
          </Card>
        )}

        {searchTerm && !loading && visibleEntities.length === 0 && (
          <Text style={{ padding: '16px', textAlign: 'center', color: '#666' }}>
            {entities.length === 0
              ? 'No users or groups found. Try a different search term.'
              : 'All matching users and groups are already selected.'}
          </Text>
        )}

        {processingGroups && (
          <div className={classes.processingContainer}>
            <Skeleton width={24} height={24} />
            <Text>Processing group members...</Text>
          </div>
        )}

        {/* Current participants list */}
        <div className={classes.participantsContainer}>
          <ParticipantsList
            participants={resolvedParticipants}
            onRemoveParticipant={handleRemoveParticipant}
            onClearAll={handleClearSelection}
            isProcessing={processingGroups}
          />
        </div>
      </CardBody>
    </Card>
  );
};
