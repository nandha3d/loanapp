export { default as FestivalOfferPage } from './FestivalOfferPage';
export { default as FeatureShowcasePage } from './FeatureShowcasePage';
export { default as ComplianceNoticePage } from './ComplianceNoticePage';
export { default as MaintenanceDowntimePage } from './MaintenanceDowntimePage';
export { default as CustomEmbedPage } from './CustomEmbedPage';

export interface AnnouncementTemplateMeta {
  id: string;
  name: string;
  category: string;
  description: string;
  previewColor: string;
}

export const ANNOUNCEMENT_TEMPLATES: AnnouncementTemplateMeta[] = [
  {
    id: 'festival_offer',
    name: 'Festival Celebration & Offers',
    category: 'Commercial',
    description: 'Gold & Purple celebration theme with coupon codes, bonus limits, and festive countdown badges.',
    previewColor: '#7D287E'
  },
  {
    id: 'feature_showcase',
    name: 'Major Product Update Showcase',
    category: 'Product',
    description: 'Dark-mode feature grid showcasing new releases, badges, and version highlights.',
    previewColor: '#4F46E5'
  },
  {
    id: 'compliance_notice',
    name: 'Statutory & RBI Compliance Notice',
    category: 'Regulatory',
    description: 'Formal advisory layout with circular reference, mandatory operational checklist, and digital signature acknowledgment.',
    previewColor: '#D97706'
  },
  {
    id: 'maintenance_downtime',
    name: 'Scheduled Maintenance Downtime',
    category: 'System',
    description: 'Maintenance alert with countdown time window, services status table, and support helpline.',
    previewColor: '#DC2626'
  }
];
