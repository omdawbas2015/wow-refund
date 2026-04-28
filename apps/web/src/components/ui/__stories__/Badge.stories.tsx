import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Badge } from '../badge';

const meta: Meta<typeof Badge> = {
  title: 'UI/Badge',
  component: Badge,
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'secondary', 'destructive', 'success', 'warning', 'outline'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Badge>;

export const Default: Story = {
  args: { children: 'Badge' },
};

export const Success: Story = {
  args: { variant: 'success', children: 'Approved' },
};

export const Destructive: Story = {
  args: { variant: 'destructive', children: 'Rejected' },
};

export const Warning: Story = {
  args: { variant: 'warning', children: 'Pending' },
};

export const Outline: Story = {
  args: { variant: 'outline', children: 'Draft' },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge>Default</Badge>
      <Badge variant="secondary">Secondary</Badge>
      <Badge variant="success">Approved</Badge>
      <Badge variant="destructive">Rejected</Badge>
      <Badge variant="warning">Pending</Badge>
      <Badge variant="outline">Draft</Badge>
    </div>
  ),
};
