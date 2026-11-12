import { screen } from '@testing-library/react-native';

import { renderScreen } from '../testing/render-screen';
import { VerdictBar, verdictSummary } from './VoteChips';

describe('verdictSummary', () => {
  it('has no leader, and so no percentage, when nobody has voted', () => {
    expect(verdictSummary({ too_high: 0, just_right: 0, too_low: 0 })).toEqual({
      total: 0,
      leader: null,
    });
  });

  it('names the leading choice and its share of the votes', () => {
    expect(verdictSummary({ too_high: 1, just_right: 3, too_low: 0 })).toMatchObject({
      total: 4,
      leader: { choice: 'just_right', label: 'Just Right', share: 75 },
    });
  });

  it('breaks a tie towards Too High, Just Right, then Too Low', () => {
    expect(verdictSummary({ too_high: 2, just_right: 2, too_low: 2 }).leader?.choice).toBe(
      'too_high',
    );
    expect(verdictSummary({ too_high: 0, just_right: 2, too_low: 2 }).leader?.choice).toBe(
      'just_right',
    );
  });
});

describe('VerdictBar', () => {
  it('says "No votes yet" instead of "33% Too High | 0 votes"', () => {
    renderScreen(<VerdictBar tally={{ too_high: 0, just_right: 0, too_low: 0 }} />);

    expect(screen.getByText('No votes yet')).toBeOnTheScreen();
    expect(screen.queryByText(/%/)).toBeNull();
    expect(screen.queryByText(/0 votes/)).toBeNull();
    expect(screen.getByLabelText('No votes yet')).toBeOnTheScreen();
  });

  it('shows the leader and the count once there are votes', () => {
    renderScreen(<VerdictBar tally={{ too_high: 1, just_right: 3, too_low: 0 }} />);

    expect(screen.getByText('75% Just Right')).toBeOnTheScreen();
    expect(screen.getByText('4 votes')).toBeOnTheScreen();
  });
});
