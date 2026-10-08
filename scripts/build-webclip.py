"""Export a removable, shortcut-only iPhone profile; never an MDM enrollment."""
from pathlib import Path
import plistlib
from uuid import NAMESPACE_URL, uuid5

root = Path(__file__).resolve().parents[1]
url = 'https://studdybuddyapp.com/'
description = 'Adds only the StudyGram home-screen shortcut. No device management, certificates, VPN, accounts or permissions. This unsigned profile can be removed in Settings.'
clip = {
    'PayloadType': 'com.apple.webClip.managed',
    'PayloadVersion': 1,
    'PayloadIdentifier': 'com.studygram.webclip',
    'PayloadUUID': str(uuid5(NAMESPACE_URL, url + '#webclip')).upper(),
    'PayloadDisplayName': 'StudyGram shortcut',
    'Label': 'StudyGram',
    'URL': url,
    'Icon': (root / 'public' / 'brand' / 'studygram-180.png').read_bytes(),
    'IsRemovable': True,
    'FullScreen': True,
    'Precomposed': True,
    'IgnoreManifestScope': False,
}
profile = {
    'PayloadType': 'Configuration',
    'PayloadVersion': 1,
    'PayloadIdentifier': 'com.studygram.webclip.profile',
    'PayloadUUID': str(uuid5(NAMESPACE_URL, url + '#webclip-profile')).upper(),
    'PayloadDisplayName': 'StudyGram home-screen shortcut',
    'PayloadDescription': description,
    'PayloadOrganization': 'StudyGram',
    'PayloadRemovalDisallowed': False,
    'ConsentText': {'default': description},
    'PayloadContent': [clip],
}
output = root / 'public' / 'downloads' / 'StudyGram.mobileconfig'
output.parent.mkdir(parents=True, exist_ok=True)
output.write_bytes(plistlib.dumps(profile, fmt=plistlib.FMT_XML, sort_keys=True))
# Verify the exported asset, including the exact one-payload scope.
checked = plistlib.loads(output.read_bytes())
assert checked['PayloadContent'] == [clip]
assert checked['PayloadRemovalDisallowed'] is False
print('Validated shortcut-only profile:', output.name)
