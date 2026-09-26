import hashlib,importlib.util,json,unittest
spec=importlib.util.spec_from_file_location('pages','tools/verify_pages.py');pages=importlib.util.module_from_spec(spec);spec.loader.exec_module(pages)
class PagesTests(unittest.TestCase):
    def setUp(self):
        self.base='https://lys20001205.github.io/m1ce/';self.sha='a'*40
        self.data={f:b'approved site bytes' for f in pages.FILES};self.data['build.json']=json.dumps({'commit':self.sha}).encode()
        self.gate={'passed':True,'commit':self.sha,'distSHA256':{k:hashlib.sha256(v).hexdigest() for k,v in self.data.items()}}
    def fetch(self,url):return self.data[url.split('/m1ce/')[1].split('?')[0]]
    def test_same_public_bytes_pass(self):self.assertTrue(pages.verify(self.base,self.gate,self.fetch)['passed'])
    def test_stale_or_corrupt_site_fails(self):
        self.data['index.html']=b'stale v10';
        with self.assertRaises(ValueError):pages.verify(self.base,self.gate,self.fetch)
    def test_new_presentation_files_are_mandatory_and_verified(self):
        for name in ['src/design_ui.js','src/design.css','src/control_ui.js','src/mobile_art.css','src/polish3d.js']:
            self.assertIn(name,pages.FILES)
            old=self.data[name];self.data[name]=b'stale presentation'
            with self.assertRaises(ValueError):pages.verify(self.base,self.gate,self.fetch)
            self.data[name]=old
    def test_wrong_origin_or_failed_gate_fails(self):
        with self.assertRaises(ValueError):pages.verify('https://unrelated.invalid/',self.gate,self.fetch)
        self.gate['passed']=False
        with self.assertRaises(ValueError):pages.verify(self.base,self.gate,self.fetch)
if __name__=='__main__':unittest.main()
