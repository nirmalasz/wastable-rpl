import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { auth, testUser } from '@/test/auth';
import { EditProfileModal } from './edit-profile-modal';

vi.mock('@/features/auth', async () => (await import('@/test/auth')).authModule);

const onClose = vi.fn();
const onSaved = vi.fn();
// Two controls are named "Close" (the corner × and the footer button); use the footer one.
const closeButton = () => screen.getByText('Close', { selector: 'button' });
const open = () => render(<EditProfileModal user={testUser} onClose={onClose} onSaved={onSaved} />);

beforeEach(() => {
  auth.signIn();
  auth.call.mockResolvedValue({ user: testUser });
});

describe('EditProfileModal', () => {
  it('closes straight away when nothing changed, and Save starts disabled', async () => {
    open();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    await userEvent.setup().click(closeButton());
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(auth.call).not.toHaveBeenCalled();
  });

  it('reminds about unsaved changes, and Keep editing keeps them', async () => {
    const user = userEvent.setup();
    open();
    const name = screen.getByDisplayValue('Sari Wulandari');
    await user.clear(name);
    await user.type(name, 'Sari W.');
    await user.click(closeButton());

    expect(screen.getByRole('alert')).toHaveTextContent('You have unsaved changes');
    expect(onClose).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Keep editing' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByDisplayValue('Sari W.')).toBeInTheDocument();
  });

  it('Discard changes closes without saving', async () => {
    const user = userEvent.setup();
    open();
    await user.type(screen.getByDisplayValue(testUser.contactPreference!), ' (sore)');
    await user.click(closeButton());
    await user.click(screen.getByRole('button', { name: 'Discard changes' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(auth.call).not.toHaveBeenCalled();
  });

  it('saves every edited field in one request', async () => {
    const user = userEvent.setup();
    open();
    const name = screen.getByDisplayValue('Sari Wulandari');
    await user.clear(name);
    await user.type(name, 'Sari W.');
    await user.selectOptions(screen.getByDisplayValue('3 km'), '5');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(auth.call).toHaveBeenCalledWith('/users/me', {
      method: 'PATCH',
      body: {
        name: 'Sari W.',
        locationRadiusKm: 5,
        contactPreference: testUser.contactPreference,
        avatarUrl: null,
        homeLat: null,
        homeLng: null,
      },
    });
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(auth.refreshUser).toHaveBeenCalled();
  });

  it('shows the server error and stays open when saving fails', async () => {
    auth.call.mockRejectedValueOnce(new Error('Name is too long'));
    const user = userEvent.setup();
    open();
    await user.type(screen.getByDisplayValue('Sari Wulandari'), '!');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Name is too long');
    expect(onSaved).not.toHaveBeenCalled();
  });
});
