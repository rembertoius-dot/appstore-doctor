import { evidenceAt, type Rule } from '../types.js';

export const atsArbitraryLoads: Rule = {
  id: 'network.ats-arbitrary-loads',
  clauses: ['2.1'],
  kind: 'confirmed-capable',
  severity: 'P2',
  confirmsFail: 'NSAppTransportSecurity.NSAllowsArbitraryLoads is true in the resolved Info.plist. Exception domains do not narrow it.',
  confirmsPass: 'The key is absent or false.',
  verify: 'Whether a justification exists that the review notes can state, if the setting is needed.',
  reviewedOn: '2026-10-15',
  evaluate(facts) {
    if (facts.bundle.status !== 'ok') return { kind: 'skipped', reason: facts.bundle.reason };
    const ats = facts.bundle.value.ats;
    if (!ats || !ats.allowsArbitraryLoads) return { kind: 'pass' };
    return {
      kind: 'confirmed',
      severity: 'P2',
      title: 'App Transport Security allows arbitrary loads',
      explanation: 'NSAllowsArbitraryLoads is true, so the app may talk to any server over plain HTTP. App Review can ask you to justify this setting, and the justification has to be in the review notes.' + (ats.exceptionDomains.length ? ` The exception domains (${ats.exceptionDomains.join(', ')}) do not narrow it.` : ''),
      evidence: [evidenceAt(ats.provenance, 'NSAppTransportSecurity.NSAllowsArbitraryLoads: true')],
      fix: 'Remove NSAllowsArbitraryLoads (or set it to false) and, if a specific insecure host is needed, add only that host under NSExceptionDomains. In Expo, set ios.infoPlist.NSAppTransportSecurity in app.json. If only local networking or web content needs the exemption, use NSAllowsLocalNetworking or NSAllowsArbitraryLoadsInWebContent instead.',
      check: 'Re-run appstore-doctor; confirm the app still loads its content over HTTPS.',
    };
  },
};
