import type { Facts } from './facts.js';

export type VerifyItem = { clause: string; title: string };

/** Judgment items static analysis cannot decide. Sized by facts; never scored. */
export function verifyItems(facts: Facts): VerifyItem[] {
  const items: VerifyItem[] = [
    { clause: '2.1', title: 'A reviewer can reach every feature with what the review notes give' },
    { clause: '2.3.1', title: 'Metadata describes the app accurately and nothing is hidden or dormant' },
    { clause: '2.3.3', title: 'Screenshots show the app in use, not a login, splash or title screen' },
    { clause: '4.2', title: 'The app offers more than a repackaged website or a thin wrapper' },
    { clause: '5.1.1(ii)', title: 'Each permission string tells the truth about what the data is used for' },
    { clause: '5.2', title: 'The app has the rights to every photo, video, font and sound it ships' },
    { clause: 'Before You Submit', title: 'The demo account in the review notes signs in and reaches every paid feature' },
  ];
  if (facts.bundle.status === 'ok') {
    const b = facts.bundle.value;
    if (b.hasAppClip) items.push({ clause: 'App Clips', title: 'The App Clip launches from its invocation URL on a device without the app installed' });
    if (!b.deviceFamilies.includes('ipad')) items.push({ clause: '2.1', title: 'One pass on an iPad in iPhone compatibility mode: sign-in, main flow, any pay sheet' });
  }
  return items;
}
