import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Textarea } from '../textarea';

const meta: Meta<typeof Textarea> = {
  title: 'UI/Textarea',
  component: Textarea,
  argTypes: {
    disabled: { control: 'boolean' },
    placeholder: { control: 'text' },
  },
};

export default meta;
type Story = StoryObj<typeof Textarea>;

export const Default: Story = {
  args: { placeholder: 'Add a note about this refund case...' },
};

export const Disabled: Story = {
  args: { disabled: true, value: 'Read-only notes' },
};

export const WithValue: Story = {
  args: {
    value: 'Customer requested refund due to duplicate charge on card ending 4242. Verified with bank statement.',
    rows: 4,
  },
};
