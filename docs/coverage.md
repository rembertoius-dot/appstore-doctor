# Coverage map

Every clause of the App Store Review Guidelines (index reviewed 2026-10-15) and what AppStore Doctor does with it.

- **machine**: decided from collected facts; scores. At least one rule is implemented.
- **potential**: evidence shown with named exceptions; never scores.
- **planned**: a rule is promised (named with `(planned)`) but not implemented yet; nothing is checked.
- **agent**: needs judgment; listed under "Needs a reviewer" and in the agent prompt.
- **n/a**: category-specific, needs a running device, or not observable from a project. Reason in Note.

Regenerate the skeleton with `npm run coverage-map`; it keeps bins set by hand.

| Clause | Title | Bin | Rule | Note |
| --- | --- | --- | --- | --- |
| 1.1 | Objectionable Content | agent |  |  |
| 1.1.1 | Defamatory, discriminatory, or mean-spirited content, including references or… | agent |  |  |
| 1.1.2 | Realistic portrayals of people or animals being killed, maimed, tortured, or… | agent |  |  |
| 1.1.3 | Depictions that encourage illegal or reckless use of weapons and dangerous… | agent |  |  |
| 1.1.4 | Overtly sexual or pornographic material, defined as “explicit descriptions or… | agent |  |  |
| 1.1.5 | Inflammatory religious commentary or inaccurate or misleading quotations of… | agent |  |  |
| 1.1.6 | False information and features, including inaccurate device data or trick/joke… | agent |  |  |
| 1.1.7 | Harmful concepts which capitalize or seek to profit on recent or current… | agent |  |  |
| 1.2 | User-Generated Content | planned | ugc.report-and-block (planned) | potential-only rule planned |
| 1.2.1 | Creator Content | agent |  |  |
| 1.2.1(a) | Creator apps must provide a way for users to identify content that exceeds the… | agent |  |  |
| 1.3 | Kids Category | n/a |  | Kids category only |
| 1.4 | Physical Harm | n/a |  | Needs a human read of the content |
| 1.4.1 | Medical apps that could provide inaccurate data or information, or that could… | n/a |  | Needs a human read of the content |
| 1.4.2 | Drug dosage calculators must come from the drug manufacturer, a hospital… | n/a |  | Needs a human read of the content |
| 1.4.3 | Apps that encourage consumption of tobacco and vape products, illegal drugs… | n/a |  | Needs a human read of the content |
| 1.4.4 | Apps may only display DUI checkpoints that are published by law enforcement… | n/a |  | Needs a human read of the content |
| 1.4.5 | Apps should not urge customers to participate in activities (like bets… | n/a |  | Needs a human read of the content |
| 1.5 | Developer Information | planned | store.urls-reachable (planned) | Support and privacy URLs reachable |
| 1.6 | Data Security | agent |  |  |
| 1.7 | Reporting Criminal Activity | agent |  |  |
| 2.1 | App Completeness | machine | permissions.usage-string-present, network.ats-arbitrary-loads, expo.prebuild-drift, store.aasa-reachable (planned), store.app-clip-experience (planned), store.demo-account (planned) | Usage strings for linked capabilities; ATS arbitrary loads; ios/ vs Expo config drift. permissions.usage-string-present and permissions.usage-string-empty return potential, not confirmed, in the Clip/extension and unlinked-key cases. Planned: AASA reachability, App Clip experience, demo account. |
| 2.1(a) | Submissions to App Review, including apps you make available for pre-order… | agent |  |  |
| 2.1(b) | If you offer in-app purchases in your app, make sure they are complete… | agent |  |  |
| 2.2 | Beta Testing | agent |  |  |
| 2.3 | Accurate Metadata | agent |  |  |
| 2.3.1 | Don’t include any hidden, dormant, or undocumented features in your app; your… | agent |  | metadata accuracy; hidden features |
| 2.3.1(a) | Don’t include any hidden, dormant, or undocumented features in your app; your… | agent |  |  |
| 2.3.1(b) | Egregious or repeated behavior is grounds for removal from the Apple Developer… | agent |  |  |
| 2.3.2 | If your app includes in-app purchases, make sure your app description… | agent |  |  |
| 2.3.3 | Screenshots should show the app in use, and not merely the title art, login… | planned | store.screenshots-required (planned) | Screenshots from App Store Connect |
| 2.3.4 | Previews are a great way for customers to see what your app looks like and… | agent |  |  |
| 2.3.5 | Select the most appropriate category for your app, and check out the App Store… | agent |  |  |
| 2.3.6 | Answer the age rating questions in App Store Connect honestly so that your app… | agent |  |  |
| 2.3.7 | Choose a unique app name, assign keywords that accurately describe your app… | planned | store.listing-limits (planned) | Listing field limits |
| 2.3.8 | Metadata should be appropriate for all audiences, so make sure your app and… | planned | store.listing-limits (planned) | Listing field limits |
| 2.3.9 | You are responsible for securing the rights to use all materials in your app… | agent |  |  |
| 2.3.10 | Make sure your app is focused on the experience of the Apple platforms it… | agent |  |  |
| 2.3.11 | Apps you submit for pre-order on the App Store must be complete and… | agent |  |  |
| 2.3.12 | Apps must clearly describe new features and product changes in their “What’s… | agent |  |  |
| 2.3.13 | In-app events are timely events that happen within your app. | agent |  |  |
| 2.4 | Hardware Compatibility | agent |  |  |
| 2.4.1 | To ensure people get the most out of your app, iPhone apps should run on iPad… | agent |  |  |
| 2.4.2 | Design your app to use power efficiently and be used in a way that does not… | agent |  |  |
| 2.4.3 | People should be able to use your Apple TV app without the need for hardware… | agent |  |  |
| 2.4.4 | Apps should never suggest or require a restart of the device or modifications… | agent |  |  |
| 2.4.5 | Apps distributed via the Mac App Store have some additional requirements to… | agent |  |  |
| 2.4.5(i) | They must be appropriately sandboxed, and follow macOS File System… | agent |  |  |
| 2.4.5(ii) | They must be packaged and submitted using technologies provided in Xcode; no… | agent |  |  |
| 2.4.5(iii) | They may not auto-launch or have other code run automatically at startup or… | agent |  |  |
| 2.4.5(iv) | They may not download or install standalone apps, kexts, additional code, or… | agent |  |  |
| 2.4.5(ix) | Apps must contain all language and localization support in a single app bundle. | agent |  |  |
| 2.4.5(v) | They may not request escalation to root privileges or use setuid attributes. | agent |  |  |
| 2.4.5(vi) | They may not present a license screen at launch, require license keys, or… | agent |  |  |
| 2.4.5(vii) | They must use the Mac App Store to distribute updates; other update mechanisms… | agent |  |  |
| 2.4.5(viii) | Apps should run on the currently shipping OS and may not use deprecated or… | agent |  |  |
| 2.5 | Software Requirements | agent |  |  |
| 2.5.1 | Apps may only use public APIs and must run on the currently shipping OS. | agent |  |  |
| 2.5.2 | Apps should be self-contained in their bundles, and may not read or write data… | agent |  |  |
| 2.5.3 | Apps that transmit viruses, files, computer code, or programs that may harm or… | agent |  |  |
| 2.5.4 | Multitasking apps may only use background services for their intended… | agent |  |  |
| 2.5.5 | Apps must be fully functional on IPv6-only networks. | agent |  |  |
| 2.5.6 | Apps that browse the web must use the appropriate WebKit framework and WebKit… | agent |  |  |
| 2.5.7 | Intentionally omitted. | n/a |  | Apple marks this clause intentionally omitted |
| 2.5.8 | Apps that create alternate desktop/home screen environments will be rejected. | agent |  |  |
| 2.5.9 | Apps that alter or disable the functions of standard switches, such as the… | agent |  |  |
| 2.5.10 | Intentionally omitted. | n/a |  | Apple marks this clause intentionally omitted |
| 2.5.11 | SiriKit and Shortcuts | agent |  |  |
| 2.5.11(i) | Apps integrating SiriKit and Shortcuts should only sign up for intents they… | agent |  |  |
| 2.5.11(ii) | Ensure that the vocabulary and phrases in your plist pertains to your app and… | agent |  |  |
| 2.5.11(iii) | Resolve the Siri request or Shortcut in the most direct way possible and do… | agent |  |  |
| 2.5.12 | Apps using CallKit or including an SMS Fraud Extension should only block phone… | agent |  |  |
| 2.5.13 | Apps using facial recognition for account authentication must use… | agent |  |  |
| 2.5.14 | Apps must request explicit user consent and provide a clear visual and/or… | agent |  |  |
| 2.5.15 | Apps that enable users to view and select files should include items from the… | agent |  |  |
| 2.5.16 | Widgets, extensions, and notifications should be related to the content and… | agent |  |  |
| 2.5.16(a) | Additionally, all App Clip features and functionality must be included in the… | agent |  |  |
| 2.5.17 | Apps that support Matter must use Apple’s support framework for Matter to… | agent |  |  |
| 2.5.18 | Display advertising should be limited to your main app binary, and should not… | agent |  |  |
| 3.1 | Payments | agent |  |  |
| 3.1.1 | In-App Purchase | planned | store.iap-submittable (planned) | In-app purchases in a submittable state |
| 3.1.1(a) | Link to Other Purchase Methods | agent |  |  |
| 3.1.2 | Subscriptions | agent |  |  |
| 3.1.2(a) | Permissible uses | agent |  |  |
| 3.1.2(b) | Upgrades and Downgrades | agent |  |  |
| 3.1.2(c) | Subscription Information | n/a |  | Category-specific (subscription detail) |
| 3.1.3 | Other Purchase Methods | planned | purchases.external-payment (planned) | potential-only rule planned |
| 3.1.3(a) | “Reader” Apps | agent |  |  |
| 3.1.3(b) | Multiplatform Services | agent |  |  |
| 3.1.3(c) | Enterprise Services | agent |  |  |
| 3.1.3(d) | Person-to-Person Services | agent |  |  |
| 3.1.3(e) | Goods and Services Outside of the App | agent |  |  |
| 3.1.3(f) | Free Stand-alone Apps | agent |  |  |
| 3.1.3(g) | Advertising Management Apps | agent |  |  |
| 3.1.4 | Hardware-Specific Content | agent |  |  |
| 3.1.5 | Cryptocurrencies | agent |  |  |
| 3.1.5(i) | Wallets | agent |  |  |
| 3.1.5(ii) | Mining | agent |  |  |
| 3.1.5(iii) | Exchanges | agent |  |  |
| 3.1.5(iv) | Initial Coin Offerings | agent |  |  |
| 3.1.5(v) | Cryptocurrency apps may not offer currency for completing tasks, such as… | agent |  |  |
| 3.2 | Other Business Model Issues | agent |  |  |
| 3.2.1 | Acceptable | agent |  |  |
| 3.2.1(i) | Displaying your own apps for purchase or promotion within your app, provided… | agent |  |  |
| 3.2.1(ii) | Displaying or recommending a collection of third-party apps that are designed… | agent |  |  |
| 3.2.1(iii) | Disabling access to specific approved rental content (e.g. | agent |  |  |
| 3.2.1(iv) | Wallet passes can be used to make or receive payments, transmit offers, or… | agent |  |  |
| 3.2.1(v) | Insurance apps must be free, in legal compliance in the regions distributed… | agent |  |  |
| 3.2.1(vi) | Approved nonprofits may fundraise directly within their own apps or… | agent |  |  |
| 3.2.1(vii) | Apps may enable individual users to give a monetary gift to another individual… | agent |  |  |
| 3.2.1(viii) | Apps used for financial trading, investing, or money management should be… | agent |  |  |
| 3.2.2 | Unacceptable | n/a |  | financial or category-specific |
| 3.2.2(i) | Creating an interface for displaying third-party apps, extensions, or plug-ins… | n/a |  | financial or category-specific |
| 3.2.2(ii) | Intentionally omitted. | n/a |  | Apple marks this clause intentionally omitted |
| 3.2.2(iii) | Artificially increasing the number of impressions or click-throughs of ads, as… | agent |  |  |
| 3.2.2(iv) | Unless you are an approved nonprofit or otherwise permitted under Section… | n/a |  | financial or category-specific |
| 3.2.2(ix) | Apps offering personal loans must clearly and conspicuously disclose all loan… | n/a |  | financial or category-specific |
| 3.2.2(v) | Arbitrarily restricting who may use the app, such as by location or carrier. | agent |  |  |
| 3.2.2(vi) | Intentionally omitted. | n/a |  | Apple marks this clause intentionally omitted |
| 3.2.2(vii) | Artificially manipulating a user’s visibility, status, or rank on other… | n/a |  | financial or category-specific |
| 3.2.2(viii) | Apps that facilitate binary options trading are not permitted on the App Store. | n/a |  | financial or category-specific |
| 3.2.2(x) | Apps must not force users to rate the app, review the app, download other… | agent |  |  |
| 4.1 | Copycats | agent |  |  |
| 4.1(a) | Come up with your own ideas. | agent |  |  |
| 4.1(b) | Submitting apps which impersonate other apps or services is considered a… | agent |  |  |
| 4.1(c) | You cannot use another developer’s icon, brand, or product name in your app’s… | agent |  |  |
| 4.2 | Minimum Functionality | planned | design.web-view-only (planned) | potential-only rule planned |
| 4.2.1 | Apps using ARKit should provide rich and integrated augmented reality… | agent |  |  |
| 4.2.2 | Other than catalogs, apps shouldn’t primarily be marketing materials… | agent |  |  |
| 4.2.3 | Your app should work on its own without requiring installation of another app… | agent |  | works on its own; extra downloads disclosed |
| 4.2.3(i) | Your app should work on its own without requiring installation of another app… | agent |  |  |
| 4.2.3(ii) | If your app needs to download additional resources in order to function on… | agent |  |  |
| 4.2.4 | Intentionally omitted. | n/a |  | Apple marks this clause intentionally omitted |
| 4.2.5 | Intentionally omitted. | n/a |  | Apple marks this clause intentionally omitted |
| 4.2.6 | Apps created from a commercialized template or app generation service will be… | agent |  |  |
| 4.2.7 | Remote Desktop Clients | agent |  |  |
| 4.2.7(a) | The app must only connect to a user-owned host device that is a personal… | agent |  |  |
| 4.2.7(b) | Any software or services appearing in the client are fully executed on the… | agent |  |  |
| 4.2.7(c) | All account creation and management must be initiated from the host device. | agent |  |  |
| 4.2.7(d) | The UI appearing on the client does not resemble an iOS or App Store view… | agent |  |  |
| 4.2.7(e) | Thin clients for cloud-based apps are not appropriate for the App Store. | agent |  |  |
| 4.3 | Spam | agent |  |  |
| 4.3(a) | Don’t create multiple Bundle IDs of the same app (for example, submitting a… | agent |  |  |
| 4.3(b) | Don’t submit apps that are indistinguishable from what's already widely… | agent |  |  |
| 4.4 | Extensions | n/a |  | Extensions; not observable from a project |
| 4.4.1 | Keyboard extensions have some additional rules. | n/a |  | Extensions; not observable from a project |
| 4.4.2 | Safari extensions must run on the current version of Safari on the relevant… | n/a |  | Extensions; not observable from a project |
| 4.4.3 | Intentionally omitted. | n/a |  | Apple marks this clause intentionally omitted |
| 4.5 | Apple Sites and Services | n/a |  | Apple services usage; not observable from a project |
| 4.5.1 | Apps may use approved Apple RSS feeds such as the iTunes Store RSS feed, but… | n/a |  | Apple services usage; not observable from a project |
| 4.5.2 | Apple Music | n/a |  | Apple services usage; not observable from a project |
| 4.5.2(i) | MusicKit on iOS lets users play Apple Music and their local music library… | n/a |  | Apple services usage; not observable from a project |
| 4.5.2(ii) | Using the MusicKit APIs is not a replacement for securing the licenses you… | n/a |  | Apple services usage; not observable from a project |
| 4.5.2(iii) | Apps that access Apple Music user data, such as playlists and favorites, must… | n/a |  | Apple services usage; not observable from a project |
| 4.5.3 | Do not use Apple Services to spam, phish, or send unsolicited messages to… | n/a |  | Apple services usage; not observable from a project |
| 4.5.4 | Push Notifications must not be required for the app to function, and should… | n/a |  | Apple services usage; not observable from a project |
| 4.5.5 | Only use Game Center Player IDs in a manner approved by the Game Center terms… | n/a |  | Apple services usage; not observable from a project |
| 4.5.6 | Apps may use Unicode characters that render as Apple emoji in their app and… | n/a |  | Apple services usage; not observable from a project |
| 4.6 | Intentionally omitted. | n/a |  | Apple marks this clause intentionally omitted |
| 4.7 | Mini apps, mini games, streaming games, chatbots, plug-ins, and game emulators | n/a |  | Mini apps; category-specific |
| 4.7.1 | Software offered in apps under this rule must | n/a |  | Mini apps; category-specific |
| 4.7.2 | Your app may not extend or expose native platform APIs or technologies to the… | n/a |  | Mini apps; category-specific |
| 4.7.3 | Your app may not share data or privacy permissions to any individual software… | n/a |  | Mini apps; category-specific |
| 4.7.4 | You must provide an index of software and metadata available in your app. | n/a |  | Mini apps; category-specific |
| 4.7.5 | Your app must provide a way for users to identify software that exceeds the… | n/a |  | Mini apps; category-specific |
| 4.8 | Login Services | planned | accounts.sign-in-with-apple (planned) | potential-only rule planned |
| 4.9 | Apple Pay | agent |  |  |
| 4.10 | Monetizing Built-In Capabilities | agent |  |  |
| 5.1 | Privacy | agent |  |  |
| 5.1.1 | Data Collection and Storage | agent |  |  |
| 5.1.1(i) | Privacy Policies | planned | store.urls-reachable (planned) | privacy policy link present and reachable |
| 5.1.1(ii) | Permission | machine | permissions.usage-string-present, permissions.usage-string-empty, permissions.usage-string-template | Usage-description keys: missing for a linked capability, empty or non-string, developer-tool or placeholder text. permissions.usage-string-present and permissions.usage-string-empty return potential, not confirmed, in the Clip/extension and unlinked-key cases. |
| 5.1.1(iii) | Data Minimization | agent |  |  |
| 5.1.1(iv) | Access | agent |  |  |
| 5.1.1(ix) | Apps that provide services in highly regulated fields (such as banking and… | agent |  |  |
| 5.1.1(v) | Account Sign-In | planned | accounts.deletion-path (planned) | potential-only rule planned |
| 5.1.1(vi) | Developers that use their apps to surreptitiously discover passwords or other… | agent |  |  |
| 5.1.1(vii) | SafariViewController must be used to visibly present information to users; the… | agent |  |  |
| 5.1.1(viii) | Apps that compile personal information from any source that is not directly… | agent |  |  |
| 5.1.1(x) | Apps may request basic contact information (such as name and email address) so… | agent |  |  |
| 5.1.2 | Data Use and Sharing | planned | privacy.tracking-string (planned) | potential-only rule planned |
| 5.1.2(i) | Unless otherwise permitted by law, you may not use, transmit, or share… | agent |  |  |
| 5.1.2(ii) | Data collected for one purpose may not be repurposed without further consent… | agent |  |  |
| 5.1.2(iii) | Apps should not attempt to surreptitiously build a user profile based on… | agent |  |  |
| 5.1.2(iv) | Do not use information from Contacts, Photos, or other APIs that access user… | agent |  |  |
| 5.1.2(v) | Do not contact people using information collected via a user’s Contacts or… | agent |  |  |
| 5.1.2(vi) | Data gathered from the HomeKit API, HealthKit, Clinical Health Records API… | agent |  |  |
| 5.1.2(vii) | Apps using Apple Pay may only share user data acquired via Apple Pay with… | agent |  |  |
| 5.1.3 | Health and Health Research | n/a |  | Health data; category-specific |
| 5.1.3(i) | Apps may not use or disclose to third parties data gathered in the health… | n/a |  | Health data; category-specific |
| 5.1.3(ii) | Apps must not write false or inaccurate data into HealthKit or any other… | n/a |  | Health data; category-specific |
| 5.1.3(iii) | Apps conducting health-related human subject research must obtain consent from… | n/a |  | Health data; category-specific |
| 5.1.3(iv) | Apps conducting health-related human subject research must secure approval… | n/a |  | Health data; category-specific |
| 5.1.4 | Kids | n/a |  | Kids; category-specific |
| 5.1.5 | Location Services | agent |  |  |
| 5.2 | Intellectual Property | agent |  |  |
| 5.2.1 | Generally | agent |  |  |
| 5.2.2 | Third-Party Sites/Services | agent |  |  |
| 5.2.3 | Audio/Video Downloading | agent |  |  |
| 5.2.4 | Apple Endorsements | agent |  |  |
| 5.2.4(a) | Don’t suggest or imply that Apple is a source or supplier of the App, or that… | agent |  |  |
| 5.2.4(b) | If your app is selected as an “Editor’s Choice,” Apple will apply the badge… | agent |  |  |
| 5.2.5 | Apple Products | agent |  |  |
| 5.3 | Gaming, Gambling, and Lotteries | n/a |  | Gaming and gambling; category-specific |
| 5.3.1 | Sweepstakes and contests must be sponsored by the developer of the app. | n/a |  | Gaming and gambling; category-specific |
| 5.3.2 | Official rules for sweepstakes, contests, and raffles must be presented in the… | n/a |  | Gaming and gambling; category-specific |
| 5.3.3 | Apps may not use in-app purchase to purchase credit or currency for use in… | n/a |  | Gaming and gambling; category-specific |
| 5.3.4 | Apps that offer real money gaming (e.g. | n/a |  | Gaming and gambling; category-specific |
| 5.4 | VPN Apps | n/a |  | VPN apps; category-specific |
| 5.5 | Mobile Device Management | n/a |  | MDM; category-specific |
| 5.6 | Developer Code of Conduct | n/a |  | Developer conduct; human judgment |
| 5.6.1 | App Store Reviews | n/a |  | Developer conduct; human judgment |
| 5.6.2 | Developer Identity | n/a |  | Developer conduct; human judgment |
| 5.6.3 | Discovery Fraud | n/a |  | Developer conduct; human judgment |
| 5.6.4 | App Quality | n/a |  | Developer conduct; human judgment |
