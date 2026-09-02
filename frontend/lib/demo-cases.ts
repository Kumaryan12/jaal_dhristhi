import type { RiskLevel } from './types';

export interface DemoCasePreset {
  id: string;
  title: string;
  description: string;
  riskLevel: RiskLevel;
}

export const investigationDemoCases: DemoCasePreset[] = [
  {
    id: 'APP-S-005001',
    title: 'Shared device ring',
    description: 'Eight applicants reuse one device.',
    riskLevel: 'HIGH',
  },
  {
    id: 'APP-S-005013',
    title: 'Shared account burst',
    description: 'Account reuse combines with rapid activity.',
    riskLevel: 'HIGH',
  },
  {
    id: 'APP-S-005021',
    title: 'Dealer velocity spike',
    description: 'Five applications arrive through one dealer.',
    riskLevel: 'HIGH',
  },
  {
    id: 'APP-S-005024',
    title: 'Mixed identity ring',
    description: 'Device and account signals overlap.',
    riskLevel: 'HIGH',
  },
  {
    id: 'APP-N-000031',
    title: 'Clean control',
    description: 'A low-risk application for comparison.',
    riskLevel: 'LOW',
  },
];

export const networkDemoCases: DemoCasePreset[] = investigationDemoCases.map((item) => ({
  ...item,
  id: item.id.replace(/^APP-/, 'CUS-'),
}));
