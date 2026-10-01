"""Read the single authored build identity; malformed/missing identities fail closed."""
import re
from pathlib import Path

def expected_build(root=Path('.')):
    source=(Path(root)/'src'/'balance.js').read_text(encoding='utf-8')
    matches=re.findall(r"^export const BUILD = '([^']+)';\s*$",source,re.M)
    if len(matches)!=1 or not re.fullmatch(r'V(?:11|12)-[A-Z0-9-]+',matches[0]):
        raise ValueError('missing, ambiguous or malformed authored BUILD')
    return matches[0]
