import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Input } from '../input';

const meta: Meta<typeof Input> = {
  title: 'UI/Input',
  component: Input,
  argTypes: {
    type: {
      control: 'select',
      options: ['text', 'email', 'password', 'number', 'search', 'tel', 'url'],
    },
    disabled: { control: 'boolean' },
    placeholder: { control: 'text' },
  },
};

export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = {
  args: { placeholder: 'Enter text...' },
};

export const Email: Story = {
  args: { type: 'email', placeholder: 'admin@wow.local' },
};

export const Password: Story = {
  args: { type: 'password', placeholder: 'Password' },
};

export const Disabled: Story = {
  args: { disabled: true, placeholder: 'Disabled', value: 'Cannot edit' },
};

export const WithValue: Story = {
  args: { value: 'REF-2024-00123', readOnly: true },
};
