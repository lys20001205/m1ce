"""The deployment guard itself must reject missing/false/skipped evidence."""
import importlib.util,json,tempfile,unittest,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
spec=importlib.util.spec_from_file_location('gate','tools/check_release.py');gate=importlib.util.module_from_spec(spec);spec.loader.exec_module(gate)
class GateTests(unittest.TestCase):
    def test_authored_build_identity_is_strict(self):
        with tempfile.TemporaryDirectory() as directory:
            p=Path(directory);(p/'src').mkdir();f=p/'src'/'balance.js'
            f.write_text("export const BUILD = 'V11-PLAYABILITY-R5-20260930';\n")
            self.assertEqual(gate.expected_build(p),'V11-PLAYABILITY-R5-20260930')
            f.write_text("export const BUILD = 'V13-MOBILE-HUD-TRAIN-R1-20261002';\n")
            self.assertEqual(gate.expected_build(p),'V13-MOBILE-HUD-TRAIN-R1-20261002')
            for text in ["export const BUILD = 'wrong';",'missing',"export const BUILD = 'V11-OTHER';\nexport const BUILD = 'V11-DUPLICATE';"]:
                f.write_text(text)
                with self.assertRaises(ValueError):gate.expected_build(p)
    def fixture(self,path):
        for browser in ['chromium','webkit']:
            for suffix,count in gate.SUITES.items():
                name=browser+'-'+(suffix+'-' if suffix else '')+'report.json'
                (path/name).write_text(json.dumps({'browser':browser,'passed':True,'checks':{str(i):True for i in range(count)},'errors':[]}))
        for name,count in [('unit.txt',339),('model-tests.txt',16)]:
            (path/name).write_text(f'# tests {count}\n# pass {count}\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n')
    def test_gate_fails_closed(self):
        with tempfile.TemporaryDirectory() as directory:
            p=Path(directory);self.assertFalse(gate.inspect(p)['passed']);self.fixture(p);self.assertTrue(gate.inspect(p)['passed'])
            f=p/'webkit-release-report.json';f.unlink();self.assertFalse(gate.inspect(p)['passed']);self.fixture(p)
            d=json.loads(f.read_text());d['checks']['0']=False;f.write_text(json.dumps(d));self.assertFalse(gate.inspect(p)['passed']);self.fixture(p)
            f=p/'unit.txt';f.write_text(f.read_text().replace('# skipped 0','# skipped 1'));self.assertFalse(gate.inspect(p)['passed'])
if __name__=='__main__':unittest.main()
