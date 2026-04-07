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
import { useState } from 'react';
import { Content } from '@backstage/core-components';
import { Header } from '@backstage/ui';
import { Wheel } from '../../components/Wheel';
import { Participants } from '../../components/Participants';
import classes from './WheelOfNamesPage.module.css';

export const WheelOfNamesPage = () => {
  const [participants, setParticipants] = useState<
    Array<{ id: string; name: string }>
  >([]);
  return (
    <>
      <Header title="Wheel of Names" />
      <Content>
        <div className={classes.contentDescription}>
          Spin the wheel to randomly select a team member. Perfect for choosing
          who goes first in meetings, who brings snacks next time, or any other
          fun team decisions!
        </div>
        <div className={classes.container}>
          <div className={classes.leftColumn}>
            <Participants onParticipantsChange={setParticipants} />
          </div>
          <div className={classes.rightColumn}>
            {participants.length > 0 && <Wheel participants={participants} />}
          </div>
        </div>
      </Content>
    </>
  );
};
