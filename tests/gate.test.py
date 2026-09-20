"""The deployment guard itself must reject missing/false/skipped evidence."""
import importlib.util,json,tempfile,unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('gate','tools/check_release.py');gate=importlib.util.module_from_spec(spec);spec.loader.exec_module(gate)
class GateTests(unittest.TestCase):
    def fixture(self,path):
        for browser in ['chromium','webkit']:
            for suffix,count in gate.SUITES.items():
                name=browser+'-'+(suffix+'-' if suffix else '')+'report.json'
                (path/name).write_text(json.dumps({'browser':browser,'passed':True,'checks':{str(i):True for i in range(count)},'errors':[]}))
        for name,count in [('unit.txt',240),('model-tests.txt',6)]:
            (path/name).write_text(f'# tests {count}\n# pass {count}\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n')
    def test_gate_fails_closed(self):
        with tempfile.TemporaryDirectory() as directory:
            p=Path(directory);self.assertFalse(gate.inspect(p)['passed']);self.fixture(p);self.assertTrue(gate.inspect(p)['passed'])
            f=p/'webkit-release-report.json';f.unlink();self.assertFalse(gate.inspect(p)['passed']);self.fixture(p)
            d=json.loads(f.read_text());d['checks']['0']=False;f.write_text(json.dumps(d));self.assertFalse(gate.inspect(p)['passed']);self.fixture(p)
            f=p/'unit.txt';f.write_text(f.read_text().replace('# skipped 0','# skipped 1'));self.assertFalse(gate.inspect(p)['passed'])
if __name__=='__main__':unittest.main()
