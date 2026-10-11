import ZoloFundsShell, { zoloFundsMetadata } from '@/components/zolofunds/ZoloFundsShell';

export const metadata = zoloFundsMetadata;

export default function ZoloFundsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ZoloFundsShell>{children}</ZoloFundsShell>;
}
