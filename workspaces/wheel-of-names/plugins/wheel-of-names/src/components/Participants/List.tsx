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
import { Fragment } from 'react';
import { Text, Button } from '@backstage/ui';
import { RiDeleteBin6Line } from '@remixicon/react';
import classes from './Participants.module.css';

interface Participant {
  id: string;
  name: string;
  displayName?: string;
  fromGroup?: string;
}

interface ParticipantsListProps {
  participants: Participant[];
  onRemoveParticipant: (id: string) => void;
  onClearAll: () => void;
  isProcessing: boolean;
}

export const ParticipantsList = ({
  participants,
  onRemoveParticipant,
  onClearAll,
  isProcessing,
}: ParticipantsListProps) => {
  const getParticipantClassName = (participant: Participant) => {
    return participant.fromGroup
      ? classes.groupMemberItem
      : classes.selectedParticipantItem;
  };

  if (participants.length === 0) {
    return null;
  }

  return (
    <div className={classes.selectedParticipantsContainer}>
      <div className={classes.participantsHeader}>
        <Text weight="bold">Selected Participants ({participants.length})</Text>

        <Button onClick={onClearAll} isDisabled={isProcessing}>
          Clear All
        </Button>
      </div>

      <div className={classes.selectedParticipantsList}>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {participants.map(participant => (
            <Fragment key={participant.id}>
              <li
                className={getParticipantClassName(participant)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '12px 16px',
                  borderBottom: '1px solid var(--bui-border)',
                }}
              >
                <div style={{ flex: 1 }}>
                  <Text>{participant.displayName || participant.name}</Text>
                  {participant.fromGroup && (
                    <Text
                      variant="body-small"
                      className={classes.groupInfoText}
                    >
                      From group: {participant.fromGroup}
                    </Text>
                  )}
                </div>
                <Button
                  variant="secondary"
                  aria-label="Remove participant"
                  onClick={() => onRemoveParticipant(participant.id)}
                  isDisabled={isProcessing}
                >
                  <RiDeleteBin6Line size={18} />
                </Button>
              </li>
            </Fragment>
          ))}
        </ul>
      </div>
    </div>
  );
};
