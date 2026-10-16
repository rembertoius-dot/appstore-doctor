import type { Confidence, Evidence, Severity } from '../rules/types.js';
import type { Coverage } from '../score.js';
import type { VerifyItem } from '../verify.js';

export type ReportFinding = {
  rule: string;
  clauses: string[];
  severity: Severity;
  confidence?: Confidence;
  exceptions?: string[];
  title: string;
  explanation: string;
  evidence: Evidence[];
  fix: string;
  check: string;
  guideline?: { id: string; title: string; url: string; excerpt: string };
};

export type Report = {
  tool: { name: 'appstore-doctor'; version: string; guidelinesReviewedOn: string };
  app: { name?: string; bundleId?: string; project: string };
  score: number;
  label: string;
  coverage: Coverage;
  confirmed: ReportFinding[];
  potential: ReportFinding[];
  verify: VerifyItem[];
  passed: string[];
  notApplicable: string[];
};
