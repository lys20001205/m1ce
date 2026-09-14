"""Apply hash-checked C source, then fix sub-pixel camera settling; no deployment."""
from pathlib import Path
import runpy
runpy.run_path('tests/_stage_payload.py')
p=Path('src/view.js');s=p.read_text();old='if(Math.abs(this.cameraX-desiredX)>8)this.cameraX=desiredX;';assert old in s;s=s.replace(old,'if(Math.abs(this.cameraX-desiredX)>8||Math.abs(this.cameraX-desiredX)<.001)this.cameraX=desiredX;');p.write_text(s)
p=Path('tests/browser_v11.py');s=p.read_text();old="await page.click('#brake')";assert old in s;s=s.replace(old,"await page.click('#brake');await page.wait_for_timeout(800)");p.write_text(s)
Path('tests/_stage_payload.py').unlink()
