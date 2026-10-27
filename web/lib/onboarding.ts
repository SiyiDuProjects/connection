export type OnboardingStatus = {
  complete: boolean;
  missingFields: string[];
  completedFields: number;
  totalFields: number;
};

export { getOnboardingStatus } from './contacts/onboarding.js';
