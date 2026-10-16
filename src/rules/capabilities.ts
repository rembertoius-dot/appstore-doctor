import type { Capability } from '../facts.js';

/** Any one of these keys satisfies the capability's usage-description requirement. */
export const REQUIRED_KEYS: Record<Capability, string[]> = {
  camera: ['NSCameraUsageDescription'],
  microphone: ['NSMicrophoneUsageDescription'],
  location: ['NSLocationWhenInUseUsageDescription', 'NSLocationAlwaysAndWhenInUseUsageDescription'],
  contacts: ['NSContactsUsageDescription'],
  photos: ['NSPhotoLibraryUsageDescription', 'NSPhotoLibraryAddUsageDescription'],
  bluetooth: ['NSBluetoothAlwaysUsageDescription'],
  health: ['NSHealthShareUsageDescription', 'NSHealthUpdateUsageDescription'],
  tracking: ['NSUserTrackingUsageDescription'],
  faceId: ['NSFaceIDUsageDescription'],
  calendar: ['NSCalendarsFullAccessUsageDescription', 'NSCalendarsWriteOnlyAccessUsageDescription', 'NSCalendarsUsageDescription'],
  motion: ['NSMotionUsageDescription'],
  speech: ['NSSpeechRecognitionUsageDescription'],
  localNetwork: ['NSLocalNetworkUsageDescription'],
};

/** Pod names (from Podfile.lock) that link a capability. Conservative: only pods whose purpose is the capability. */
export const POD_CAPABILITIES: Record<string, Capability> = {
  VisionCamera: 'camera',
  'react-native-vision-camera': 'camera',
  EXCamera: 'camera',
  RNCamera: 'camera',
  EXLocation: 'location',
  'react-native-geolocation-service': 'location',
  RNCGeolocation: 'location',
  EXContacts: 'contacts',
  RNContacts: 'contacts',
  'react-native-ble-plx': 'bluetooth',
  MultiplatformBleAdapter: 'bluetooth',
  RNBluetoothClassic: 'bluetooth',
  RNAppleHealthKit: 'health',
  'react-native-health': 'health',
  EXTrackingTransparency: 'tracking',
  'react-native-tracking-transparency': 'tracking',
  RNVoice: 'speech',
  EXCalendar: 'calendar',
};

/** iOS API symbols in Swift or Objective-C source that imply a capability. */
export const SYMBOL_PATTERNS: Array<{ capability: Capability; pattern: RegExp; name: string }> = [
  { capability: 'camera', pattern: /\bAVCaptureDevice\b.*\b(for:\s*\.video|AVMediaType\.video)\b|\bAVCapture(PhotoOutput|VideoDataOutput|MovieFileOutput)\b|\.builtIn\w*Camera\b/, name: 'AVCaptureDevice' },
  { capability: 'microphone', pattern: /\bAVAudioRecorder\b/, name: 'AVAudioRecorder' },
  { capability: 'location', pattern: /\bCLLocationManager\b/, name: 'CLLocationManager' },
  { capability: 'contacts', pattern: /\bCNContactStore\b/, name: 'CNContactStore' },
  { capability: 'photos', pattern: /\bPHPhotoLibrary\b/, name: 'PHPhotoLibrary' },
  { capability: 'bluetooth', pattern: /\bCB(Central|Peripheral)Manager\b/, name: 'CBCentralManager' },
  { capability: 'health', pattern: /\bHKHealthStore\b/, name: 'HKHealthStore' },
  { capability: 'tracking', pattern: /\bATTrackingManager\b/, name: 'ATTrackingManager' },
  { capability: 'calendar', pattern: /\bEKEventStore\b/, name: 'EKEventStore' },
  { capability: 'motion', pattern: /\bCMMotion(Manager|ActivityManager)\b/, name: 'CMMotionManager' },
  { capability: 'speech', pattern: /\bSFSpeechRecognizer\b/, name: 'SFSpeechRecognizer' },
  { capability: 'localNetwork', pattern: /\bNWBrowser\b|\bNetServiceBrowser\b|\bMCNearbyServiceBrowser\b/, name: 'NWBrowser' },
];
