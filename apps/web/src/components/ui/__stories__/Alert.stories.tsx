import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Alert, AlertTitle, AlertDescription } from '../alert';
import { AlertCircle, CheckCircle2, Info as InfoIcon, AlertTriangle } from 'lucide-react';

const meta: Meta<typeof Alert> = {
  title: 'UI/Alert',
  component: Alert,
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'info', 'success', 'warning', 'destructive'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Alert>;

export const Default: Story = {
  render: () => (
    <Alert className="w-[450px]">
      <AlertTitle>Notice</AlertTitle>
      <AlertDescription>This is a default alert.</AlertDescription>
    </Alert>
  ),
};

export const InfoVariant: Story = {
  render: () => (
    <Alert variant="info" className="w-[450px]">
      <InfoIcon className="h-4 w-4" />
      <AlertTitle>Information</AlertTitle>
      <AlertDescription>PII encryption is active. Customer data is encrypted at rest.</AlertDescription>
    </Alert>
  ),
};

export const Success: Story = {
  render: () => (
    <Alert variant="success" className="w-[450px]">
      <CheckCircle2 className="h-4 w-4" />
      <AlertTitle>Approved</AlertTitle>
      <AlertDescription>Refund REF-2024-00123 has been approved and queued for processing.</AlertDescription>
    </Alert>
  ),
};

export const Warning: Story = {
  render: () => (
    <Alert variant="warning" className="w-[450px]">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>SLA Warning</AlertTitle>
      <AlertDescription>3 cases are approaching their SLA deadline.</AlertDescription>
    </Alert>
  ),
};

export const Destructive: Story = {
  render: () => (
    <Alert variant="destructive" className="w-[450px]">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Error</AlertTitle>
      <AlertDescription>Failed to process refund. Please try again.</AlertDescription>
    </Alert>
  ),
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-col gap-3 w-[450px]">
      <Alert>
        <AlertTitle>Default</AlertTitle>
        <AlertDescription>Standard notification.</AlertDescription>
      </Alert>
      <Alert variant="info">
        <InfoIcon className="h-4 w-4" />
        <AlertTitle>Info</AlertTitle>
        <AlertDescription>Informational message.</AlertDescription>
      </Alert>
      <Alert variant="success">
        <CheckCircle2 className="h-4 w-4" />
        <AlertTitle>Success</AlertTitle>
        <AlertDescription>Operation completed.</AlertDescription>
      </Alert>
      <Alert variant="warning">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Warning</AlertTitle>
        <AlertDescription>Needs attention.</AlertDescription>
      </Alert>
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>Something went wrong.</AlertDescription>
      </Alert>
    </div>
  ),
};
